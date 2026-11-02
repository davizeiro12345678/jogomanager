import assert from "node:assert/strict";
import { test } from "node:test";
import { createNativeProcess } from "./dotnet-native-process.mjs";

const reader = `const rl=require('node:readline').createInterface({input:process.stdin});`;
const answer = `rl.on('line',line=>process.stdout.write(JSON.stringify({echo:JSON.parse(line)})+'\\n'));`;
function session(body, options = {}) {
  return createNativeProcess(process.execPath, ["-e", reader + body], {
    requestTimeoutMs: 2_000,
    closeTimeoutMs: 2_000,
    ...options,
  });
}
async function withSession(native, action) {
  try {
    return await action(native);
  } catch (error) {
    await native.abort(error);
    throw error;
  }
}

test("success waits for EOF and a clean delayed process close", async () => {
  const native = session(
    answer +
      `rl.on('close',()=>setTimeout(()=>{process.stderr.write('closed cleanly');process.exit(0)},60));`,
  );
  await withSession(native, async () => {
    assert.deepEqual(await native.request('{"tick":1}'), { echo: { tick: 1 } });
    assert.deepEqual(await native.request('{"tick":2}'), { echo: { tick: 2 } });
    const result = await native.finish();
    assert.deepEqual(result, { code: 0, signal: null, replies: 2, stderr: "closed cleanly" });
  });
});

test("a nonzero exit after the final valid reply fails the proof", async () => {
  const native = session(answer + `rl.on('close',()=>setTimeout(()=>process.exit(7),30));`);
  await withSession(native, async () => {
    assert.deepEqual(await native.request("1"), { echo: 1 });
    await assert.rejects(native.finish(), /native_exit_7/);
  });
});

test("an extra JSON reply after EOF fails even if the child would exit zero", async () => {
  const native = session(
    answer +
      `rl.on('close',()=>setTimeout(()=>{process.stdout.write('{"extra":true}\\n');process.exit(0)},30));`,
  );
  await withSession(native, async () => {
    assert.deepEqual(await native.request("1"), { echo: 1 });
    await assert.rejects(native.finish(), /native_unexpected_stdout/);
  });
});

test("an extra reply in the same stdout chunk cannot disappear between requests", async () => {
  const native = session(`rl.on('line',()=>process.stdout.write('1\\n2\\n'));`);
  await withSession(native, async () => {
    assert.equal(await native.request("1"), 1);
    await assert.rejects(native.finish(), /native_unexpected_stdout/);
  });
});

test("a child that answers but never closes fails the close timeout", async () => {
  const native = session(answer + `rl.on('close',()=>setInterval(()=>{},1000));`, {
    closeTimeoutMs: 120,
  });
  await withSession(native, async () => {
    assert.deepEqual(await native.request("1"), { echo: 1 });
    await assert.rejects(native.finish(), /native_close_timeout/);
  });
});

test("a child that never replies fails the request timeout", async () => {
  const native = session(`rl.on('line',()=>{});`, { requestTimeoutMs: 300 });
  await withSession(native, async () => {
    await assert.rejects(native.request("1"), /native_request_timeout/);
    await native.abort(new Error("expected request timeout"));
  });
});

test("malformed reply JSON fails and closes the owned child", async () => {
  const native = session(`rl.on('line',()=>process.stdout.write('bad-json\\n'));`);
  await withSession(native, async () => {
    await assert.rejects(native.request("1"), /native_invalid_json_reply/);
    await native.abort(new Error("expected malformed reply"));
  });
});
