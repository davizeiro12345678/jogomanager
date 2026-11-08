import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MAX_NO_NAVSTART_RETRIES, runLighthouseWithRetries } from "./trace-mobile-startup.mjs";

async function withOutputDirectory(run) {
  const output = await mkdtemp(path.join(tmpdir(), "trace-mobile-startup-"));
  try {
    return await run(output);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}

function reportWithRuntimeError(code) {
  return {
    audits: {},
    categories: {},
    runtimeError: { code, message: `${code} fixture` },
  };
}

async function writeAttemptReport(jsonPath, report) {
  await writeFile(jsonPath, JSON.stringify(report));
}

test("retries NO_NAVSTART and keeps every attempt artifact", async () => {
  await withOutputDirectory(async (output) => {
    const calls = [];
    const outcomes = [
      { exitCode: 1, report: reportWithRuntimeError("NO_NAVSTART") },
      {
        exitCode: 0,
        report: {
          audits: {
            "largest-contentful-paint": { numericValue: 1200 },
            "total-blocking-time": { numericValue: 80 },
            "cumulative-layout-shift": { numericValue: 0.02 },
          },
          categories: { performance: { score: 0.95 } },
          lighthouseVersion: "12.6.1",
        },
      },
    ];
    const result = await runLighthouseWithRetries({
      id: "melhores-formacoes-1",
      output,
      spawnAttempt: async ({ attempt, jsonPath }) => {
        calls.push({ attempt, jsonPath });
        const outcome = outcomes[attempt - 1];
        await writeAttemptReport(jsonPath, outcome.report);
        return { exitCode: outcome.exitCode, log: `attempt ${attempt}\n` };
      },
    });

    assert.equal(MAX_NO_NAVSTART_RETRIES, 2);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map(({ jsonPath }) => path.basename(jsonPath)),
      ["melhores-formacoes-1.json", "melhores-formacoes-1.retry-1.json"],
    );
    assert.equal(result.attempts[0].runtimeErrorCode, "NO_NAVSTART");
    assert.equal(result.attempts[0].willRetry, true);
    assert.equal(result.attempts[1].exitCode, 0);
    assert.equal(result.attempts[1].willRetry, false);
    assert.equal(
      await readFile(path.join(output, "melhores-formacoes-1.log"), "utf8"),
      "attempt 1\n",
    );
    assert.equal(
      await readFile(path.join(output, "melhores-formacoes-1.retry-1.log"), "utf8"),
      "attempt 2\n",
    );
    assert.match(
      await readFile(path.join(output, "melhores-formacoes-1.json"), "utf8"),
      /NO_NAVSTART/,
    );
  });
});

test("stops after two extra NO_NAVSTART attempts and remains failed", async () => {
  await withOutputDirectory(async (output) => {
    const calls = [];
    const result = await runLighthouseWithRetries({
      id: "melhores-formacoes-1",
      output,
      spawnAttempt: async ({ attempt, jsonPath }) => {
        calls.push(attempt);
        await writeAttemptReport(jsonPath, reportWithRuntimeError("NO_NAVSTART"));
        return { exitCode: 1, log: `attempt ${attempt}\n` };
      },
    });

    assert.equal(result.ok, false);
    assert.deepEqual(calls, [1, 2, 3]);
    assert.match(result.failure, /melhores-formacoes-1/);
    assert.match(result.failure, /NO_NAVSTART/);
    assert.match(result.failure, /3 attempts/);
    for (const filename of [
      "melhores-formacoes-1.json",
      "melhores-formacoes-1.retry-1.json",
      "melhores-formacoes-1.retry-2.json",
      "melhores-formacoes-1.log",
      "melhores-formacoes-1.retry-1.log",
      "melhores-formacoes-1.retry-2.log",
    ]) {
      await assert.doesNotReject(readFile(path.join(output, filename)));
    }
  });
});

test("does not retry a non-transient runtime error or a budget-style exit", async () => {
  await withOutputDirectory(async (output) => {
    const runtimeErrorCalls = [];
    const runtimeErrorResult = await runLighthouseWithRetries({
      id: "home-1",
      output,
      spawnAttempt: async ({ attempt, jsonPath }) => {
        runtimeErrorCalls.push(attempt);
        await writeAttemptReport(jsonPath, reportWithRuntimeError("PROTOCOL_TIMEOUT"));
        return { exitCode: 1, log: "NO_NAVSTART appears only in an unrelated diagnostic line\n" };
      },
    });

    assert.equal(runtimeErrorResult.ok, false);
    assert.deepEqual(runtimeErrorCalls, [1]);
    assert.match(runtimeErrorResult.failure, /PROTOCOL_TIMEOUT/);
    assert.match(runtimeErrorResult.failure, /no retry/i);

    const budgetCalls = [];
    const budgetResult = await runLighthouseWithRetries({
      id: "guias-1",
      output,
      spawnAttempt: async ({ attempt, jsonPath }) => {
        budgetCalls.push(attempt);
        await writeAttemptReport(jsonPath, {
          categories: { performance: { score: 0.5 } },
          audits: { "largest-contentful-paint": { numericValue: 5000 } },
        });
        return { exitCode: 1, log: "performance budget exceeded\n" };
      },
    });

    assert.equal(budgetResult.ok, false);
    assert.deepEqual(budgetCalls, [1]);
    assert.match(budgetResult.failure, /no retry/i);
  });
});

test("does not retry a crashed Lighthouse process and preserves its diagnostic log", async () => {
  await withOutputDirectory(async (output) => {
    const calls = [];
    const result = await runLighthouseWithRetries({
      id: "crashed-1",
      output,
      spawnAttempt: async ({ attempt }) => {
        calls.push(attempt);
        throw new Error("Chrome crashed before Lighthouse wrote a report");
      },
    });

    assert.equal(result.ok, false);
    assert.deepEqual(calls, [1]);
    assert.match(result.failure, /exitCode=unknown/);
    assert.match(result.failure, /no retry/i);
    assert.match(
      await readFile(path.join(output, "crashed-1.log"), "utf8"),
      /Chrome crashed before Lighthouse wrote a report/,
    );
  });
});

test("does not treat exit code zero without a valid report as success", async () => {
  await withOutputDirectory(async (output) => {
    const result = await runLighthouseWithRetries({
      id: "missing-report-1",
      output,
      spawnAttempt: async () => ({ exitCode: 0, log: "Lighthouse wrote no report\n" }),
    });

    assert.equal(result.ok, false);
    assert.match(result.failure, /reportValid=false/);
  });
});

test("does not accept arbitrary JSON as a Lighthouse report", async () => {
  await withOutputDirectory(async (output) => {
    const result = await runLighthouseWithRetries({
      id: "incomplete-report-1",
      output,
      spawnAttempt: async ({ jsonPath }) => {
        await writeAttemptReport(jsonPath, { lighthouseVersion: "12.6.1" });
        return { exitCode: 0, log: "exit 0 with incomplete JSON\n" };
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.failure, /reportValid=false/);
  });
});

test("rejects structurally shaped but unusable Lighthouse reports", async () => {
  await withOutputDirectory(async (output) => {
    const result = await runLighthouseWithRetries({
      id: "empty-audits-1",
      output,
      spawnAttempt: async ({ jsonPath }) => {
        await writeAttemptReport(jsonPath, { audits: {}, categories: {} });
        return { exitCode: 0, log: "empty report\n" };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.attempts[0].reportValid, false);
  });
});
