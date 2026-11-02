import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

/** One request/reply at a time. Success includes EOF, drained stdout and
 * process close(0), rather than merely observing the last expected reply. */
export function createNativeProcess(command, args, options = {}) {
  const { requestTimeoutMs = 60_000, closeTimeoutMs = 5_000, ...spawnOptions } = options;
  const child = spawn(command, args, { ...spawnOptions, stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout });
  let pending,
    failure,
    closing = false,
    didClose = false,
    stderr = "",
    replies = 0;
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  function fail(error) {
    failure ??= error;
    pending?.reject(failure);
    // This child belongs to this session; termination is failure cleanup only.
    if (!didClose && child.pid && !child.killed) child.kill("SIGKILL");
  }
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("error", (error) => fail(new Error(`native_spawn_error: ${error.message}`)));
  child.stdin.on("error", (error) => fail(new Error(`native_stdin_error: ${error.message}`)));
  lines.on("line", (line) => {
    if (!pending) {
      fail(new Error("native_unexpected_stdout"));
      return;
    }
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      fail(new Error("native_invalid_json_reply"));
      return;
    }
    replies++;
    pending.resolve(value);
  });
  child.on("close", (code, signal) => {
    didClose = true;
    if (code !== 0 || signal !== null)
      fail(new Error(`native_exit_${code}: signal=${signal ?? "none"}; ${stderr}`));
    else if (pending) fail(new Error("native_closed_before_reply"));
    lines.close();
    resolveClosed({ code, signal, replies, stderr });
  });

  function waitForClose() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error("native_close_timeout");
        fail(error);
        reject(error);
      }, closeTimeoutMs);
      closed.then((result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  async function abort(error) {
    fail(error ?? new Error("native_aborted"));
    try {
      await waitForClose();
    } catch {
      /* The original failure remains authoritative after bounded cleanup. */
    } finally {
      lines.close();
    }
  }

  return {
    request(raw) {
      if (failure) return Promise.reject(failure);
      if (closing || didClose) return Promise.reject(new Error("native_request_after_close"));
      if (pending) return Promise.reject(new Error("native_concurrent_request"));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => fail(new Error("native_request_timeout")), requestTimeoutMs);
        pending = {
          resolve(value) {
            clearTimeout(timer);
            pending = undefined;
            resolve(value);
          },
          reject(error) {
            clearTimeout(timer);
            pending = undefined;
            reject(error);
          },
        };
        child.stdin.write(raw + "\n", (error) => {
          if (error) fail(new Error(`native_stdin_error: ${error.message}`));
        });
      });
    },
    async finish() {
      closing = true;
      try {
        if (failure) throw failure;
        child.stdin.end();
        const result = await waitForClose();
        if (failure) throw failure;
        return result;
      } catch (error) {
        await abort(error);
        throw failure;
      }
    },
    abort,
    get stderr() {
      return stderr;
    },
  };
}
