import test from "node:test";
import assert from "node:assert/strict";
import { loadRound, saveRound, savedMode } from "../src/lib/round-storage.js";
import { placeCard } from "../src/lib/game.js";

const cards = Array.from({ length: 70 }, (_, id) => ({
  id,
  title: `Card ${id}`,
  topic: "ideas",
  extract: "A concept",
  image: `https://upload.wikimedia.org/wikipedia/commons/${id}.jpg`,
  url: `https://en.wikipedia.org/wiki/Card_${id}`,
}));

test("switching modes and restarting preserve the other saved round", (t) => {
  const previous = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  t.after(() => {
    globalThis.localStorage = previous;
  });
  assert.equal(savedMode(), "standard");
  const standard = placeCard(loadRound(cards, "standard"), 9);
  delete standard.mode; // A round saved before Expert mode was introduced.
  data.set("blindrank:round:v2", JSON.stringify(standard));
  assert.deepEqual(loadRound(cards, "standard"), standard);
  const expert = placeCard(loadRound(cards, "expert"), 29);
  saveRound(expert);
  assert.equal(savedMode(), "expert");
  assert.deepEqual(loadRound(cards, "standard"), standard);
  assert.deepEqual(loadRound(cards, savedMode()), expert);
  const fresh = loadRound(cards, "expert", { fresh: true });
  assert.equal(fresh.placed, 0);
  assert.equal(fresh.slots.length, 30);
  saveRound(fresh);
  assert.deepEqual(loadRound(cards, "standard"), standard);
  data.set("blindrank:mode:v1", JSON.stringify(["expert"]));
  assert.equal(savedMode(), "standard");
  data.set("blindrank:round:expert:v1", JSON.stringify(standard));
  assert.equal(loadRound(cards, "expert").slots.length, 30);
});

test("both modes remain playable when storage is unavailable", (t) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("Blocked");
    },
    setItem() {
      throw new Error("Full");
    },
  };
  t.after(() => {
    globalThis.localStorage = previous;
  });
  for (const mode of ["standard", "expert"]) {
    const round = loadRound(cards, mode);
    assert.equal(round.mode, mode);
    assert.doesNotThrow(() => saveRound(round));
  }
});
