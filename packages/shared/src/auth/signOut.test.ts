import { test } from "node:test";
import assert from "node:assert/strict";
import { signOutAndReset } from "./signOut";

test("signOutAndReset runs callbacks in order", async () => {
  const calls: string[] = [];

  await signOutAndReset({
    signOut: async () => {
      calls.push("signOut");
    },
    clearLocalSessionArtifacts: async () => {
      calls.push("clearLocal");
    },
    onReset: async () => {
      calls.push("reset");
    },
    onNavigate: () => {
      calls.push("navigate");
    },
  });

  assert.deepEqual(calls, ["signOut", "clearLocal", "reset", "navigate"]);
});
