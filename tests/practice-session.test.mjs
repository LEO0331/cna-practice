import test from "node:test";
import assert from "node:assert/strict";
import { defaultPracticeSession, restorePracticeSession, readPracticeSession, savePracticeSession, clearPracticeSession } from "../src/lib/practice-session.ts";
import { clearProgress } from "../src/lib/progress.ts";

const saved = { year:"2015", category:"transport-layer", topic:"tcp", count:"5", sessionIds:["a", "b", "c"], index:1 };

test("session round trip preserves filters, order, and current position", () => {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  try {
    assert.equal(readPracticeSession(["a", "b", "c"]), undefined);
    savePracticeSession(saved);
    assert.deepEqual(readPracticeSession(["a", "b", "c"]), saved);
    savePracticeSession({ ...saved, sessionIds:[], index:0 });
    assert.deepEqual(readPracticeSession(["a", "b", "c"]).sessionIds, []);
    savePracticeSession(saved);
    clearProgress();
    assert.equal(readPracticeSession(["a", "b", "c"]), undefined);
  } finally { globalThis.localStorage = previous; }
});

test("dataset changes preserve the current question or select a valid fallback", () => {
  assert.deepEqual(restorePracticeSession(saved, ["b", "c"]), { ...saved, sessionIds:["b", "c"], index:0 });
  assert.deepEqual(restorePracticeSession(saved, ["a", "c"]), { ...saved, sessionIds:["a", "c"], index:1 });
  assert.deepEqual(restorePracticeSession(saved, []), { ...saved, sessionIds:[], index:0 });
  assert.equal(restorePracticeSession({ ...saved, index:100 }, ["a"]).index, 0);
  assert.deepEqual(restorePracticeSession(defaultPracticeSession, []), defaultPracticeSession);
});

test("malformed saved sessions are rejected", () => {
  for (const value of [null, {}, { ...saved, index:-1 }, { ...saved, index:0.5 }, { ...saved, count:"999" }, { ...saved, sessionIds:[null] }, { ...saved, category:{} }]) {
    assert.equal(restorePracticeSession(value, ["a", "b", "c"]), undefined);
  }
});

test("corrupt or unavailable storage does not prevent practice", () => {
  const previous = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => "{broken" };
    assert.equal(readPracticeSession(["a"]), undefined);
    globalThis.localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("full"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.equal(readPracticeSession(["a"]), undefined);
    assert.doesNotThrow(() => savePracticeSession(saved));
    assert.doesNotThrow(() => clearPracticeSession());
  } finally { globalThis.localStorage = previous; }
});
