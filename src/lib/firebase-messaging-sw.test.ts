import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(
  resolve(process.cwd(), "public/firebase-messaging-sw.js"),
  "utf8",
);

function executeWorker(url: string) {
  const addEventListener = vi.fn();
  const initializeApp = vi.fn();
  const onBackgroundMessage = vi.fn();
  const importScripts = vi.fn();
  const context = {
    firebase: {
      initializeApp,
      messaging: () => ({ onBackgroundMessage }),
    },
    importScripts,
    self: {
      addEventListener,
      location: { href: url, origin: new URL(url).origin },
    },
    URL,
  };

  vm.runInNewContext(workerSource, context);
  return { addEventListener, importScripts, initializeApp, onBackgroundMessage };
}

describe("Firebase messaging worker identity", () => {
  it("initializes only when app and messaging sender belong to one web project", () => {
    const result = executeWorker(
      "https://game.example/firebase-messaging-sw.js?apiKey=web-key&projectId=project-a&appId=1%3A123456%3Aweb%3Aappa&messagingSenderId=123456",
    );

    expect(result.initializeApp).toHaveBeenCalledWith({
      apiKey: "web-key",
      projectId: "project-a",
      appId: "1:123456:web:appa",
      messagingSenderId: "123456",
    });
    expect(result.onBackgroundMessage).toHaveBeenCalledTimes(1);
    expect(result.importScripts).toHaveBeenCalledTimes(2);
  });

  it("does not initialize a worker with a mismatched sender identity", () => {
    const result = executeWorker(
      "https://game.example/firebase-messaging-sw.js?apiKey=web-key&projectId=project-a&appId=1%3A123456%3Aweb%3Aappa&messagingSenderId=999999",
    );

    expect(result.initializeApp).not.toHaveBeenCalled();
    expect(result.onBackgroundMessage).not.toHaveBeenCalled();
  });
});
