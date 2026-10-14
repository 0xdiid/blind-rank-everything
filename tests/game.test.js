import test from "node:test";
import assert from "node:assert/strict";
import { createRound, placeCard, isValidRound } from "../src/lib/game.js";
import { isConflictTopic } from "../src/lib/topics.js";

const cards = Array.from({ length: 30 }, (_, id) => ({
  id,
  title: `Article ${id}`,
  topic: "ideas",
  extract: `Summary ${id}`,
  image: `https://upload.wikimedia.org/wikipedia/commons/${id}.jpg`,
  url: `https://en.wikipedia.org/wiki/Article_${id}`,
}));

const conflicts = cards.map((card) => ({
  ...card,
  id: card.id + 100,
  title: `Battle ${card.id}`,
  topic: "events",
  description: "Military battle",
}));

test("fallback selection also respects conflict limits, even when only wars are unseen", () => {
  for (const [mode, size, limit] of [
    ["standard", 10, 1],
    ["expert", 30, 3],
  ]) {
    const round = createRound(
      [...conflicts, ...cards],
      cards.map((a) => a.id),
      () => 0.5,
      mode,
    );
    assert.equal(round.deck.length, size);
    assert.equal(round.deck.filter(isConflictTopic).length, limit);
    assert.ok(isValidRound(round));
    assert.throws(
      () => createRound(conflicts, [], Math.random, mode),
      /eligible articles/,
    );
  }
});

test("new saved rounds enforce the conflict limit while older rounds remain resumable", () => {
  const round = { ...createRound(cards), deck: conflicts.slice(0, 10) };
  assert.equal(isValidRound(round), false);
  assert.ok(isValidRound({ ...round, policyVersion: 2 }));
});

test("expert rounds rank all thirty unique cards, including slots beyond ten", () => {
  let round = createRound([...cards, ...cards], [], Math.random, "expert");
  assert.equal(round.deck.length, 30);
  assert.equal(round.slots.length, 30);
  for (const invalid of [-1, 30, 100, 1.5, "1"])
    assert.equal(placeCard(round, invalid), round);
  for (let index = 29; index >= 0; index--) {
    const current = round.deck[round.placed];
    round = placeCard(round, index);
    assert.equal(round.slots[index].id, current.id);
    assert.equal(placeCard(round, index), round);
    assert.ok(isValidRound(JSON.parse(JSON.stringify(round))));
  }
  assert.equal(round.placed, 30);
  assert.equal(new Set(round.slots.map((card) => card.id)).size, 30);
  assert.equal(placeCard(round, 0), round);
  assert.throws(
    () => createRound(cards.slice(0, 29), [], Math.random, "expert"),
    /At least 30/,
  );
});

test("saved rounds must match their mode while legacy ten-card rounds remain valid", () => {
  const standard = createRound(cards);
  const legacy = { ...standard };
  delete legacy.mode;
  assert.ok(isValidRound(legacy));
  assert.equal(isValidRound({ ...standard, mode: "expert" }), false);
  const expert = createRound(cards, [], Math.random, "expert");
  assert.equal(isValidRound({ ...expert, mode: "standard" }), false);
  assert.equal(isValidRound({ ...expert, mode: undefined }), false);
  assert.equal(isValidRound({ ...expert, placed: 31 }), false);
  assert.equal(
    isValidRound({ ...expert, slots: expert.slots.slice(0, 10) }),
    false,
  );
  for (const mode of ["unknown", "__proto__", ["expert"], null]) {
    assert.equal(isValidRound({ ...expert, mode }), false);
    assert.throws(
      () => createRound(cards, [], Math.random, mode),
      /Unknown game mode/,
    );
  }
});

test("new rounds contain ten unique articles and prioritize unseen cards", () => {
  const round = createRound(
    [...cards, ...cards],
    cards.slice(0, 20).map((card) => card.id),
  );
  assert.equal(round.deck.length, 10);
  assert.equal(new Set(round.deck.map((card) => card.id)).size, 10);
  assert.ok(round.deck.every((card) => card.id >= 20));
  assert.ok(isValidRound(round));
});

test("nearly exhausted libraries use every remaining fresh card before recycling", () => {
  const round = createRound(
    cards,
    cards.slice(0, 28).map((card) => card.id),
  );
  assert.ok(round.deck.some((card) => card.id === 28));
  assert.ok(round.deck.some((card) => card.id === 29));
  assert.equal(new Set(round.deck.map((card) => card.id)).size, 10);
});

test("placement is permanent, preserves the original state, and reveals only the next card", () => {
  const original = createRound(cards);
  const ranked = placeCard(original, 4);
  assert.equal(original.placed, 0);
  assert.equal(original.slots[4], null);
  assert.equal(ranked.slots[4], original.deck[0]);
  assert.equal(ranked.placed, 1);
  assert.equal(placeCard(ranked, 4), ranked);
  for (const invalid of [-1, 10, 1.5, "1", null, undefined])
    assert.equal(placeCard(ranked, invalid), ranked);
});

test("a full round has exactly ten cards, cannot be changed, and can be restored", () => {
  let round = createRound(cards);
  for (const index of [4, 9, 2, 0, 8, 1, 3, 5, 7, 6])
    round = placeCard(round, index);
  assert.equal(round.placed, 10);
  assert.equal(new Set(round.slots.map((card) => card.id)).size, 10);
  assert.ok(isValidRound(JSON.parse(JSON.stringify(round))));
  assert.equal(placeCard(round, 0), round);
});

test("malformed, unsafe, duplicated, or inconsistent saved rounds are rejected", () => {
  const round = createRound(cards);
  assert.equal(isValidRound(null), false);
  assert.equal(isValidRound({ ...round, placed: 1 }), false);
  assert.equal(
    isValidRound({ ...round, deck: Array(10).fill(cards[0]) }),
    false,
  );
  assert.equal(
    isValidRound({
      ...round,
      placed: 1,
      slots: [
        cards.find((c) => !round.deck.some((d) => d.id === c.id)),
        ...Array(9).fill(null),
      ],
    }),
    false,
  );
  const unsafe = structuredClone(round);
  unsafe.deck[0].url = "javascript:alert(1)";
  assert.equal(isValidRound(unsafe), false);
  assert.throws(() => createRound(cards.slice(0, 9)), /At least 10/);
});
