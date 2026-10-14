import { isConflictTopic, topicFor } from "./topics.js";

export const ROUND_SIZE = 10;
export const ROUND_MODES = {
  standard: { label: "Standard", size: 10 },
  expert: { label: "Expert", size: 30 },
};
export const roundMode = (round) => round?.mode ?? "standard";
export const roundSize = (round) => ROUND_MODES[roundMode(round)]?.size || 0;
export const ROUND_POLICY_VERSION = 3;
export const conflictLimit = (size) => size / ROUND_SIZE;
export const ROUND_MIX = [
  { topics: ["events"], count: 4 },
  { topics: ["ideas"], count: 3 },
  { topics: ["culture"], count: 1 },
  { topics: ["food"], count: 1 },
  { topics: ["nature", "places"], count: 1 },
];

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRound(
  catalog,
  seenIds = [],
  random = Math.random,
  mode = "standard",
) {
  if (typeof mode !== "string" || !Object.hasOwn(ROUND_MODES, mode))
    throw new Error("Unknown game mode.");
  const size = ROUND_MODES[mode].size;
  const unique = [
    ...new Map(
      catalog
        .filter((article) => topicFor(article))
        .map((article) => [
          article.id,
          { ...article, topic: topicFor(article) },
        ]),
    ).values(),
  ];
  const conflictIds = new Set(unique.filter(isConflictTopic).map((a) => a.id));
  const maxConflicts = conflictLimit(size);
  if (
    unique.length -
      conflictIds.size +
      Math.min(conflictIds.size, maxConflicts) <
    size
  )
    throw new Error(
      `At least ${size} eligible articles are needed for a round.`,
    );
  const seen = new Set(seenIds);
  const fresh = shuffle(
    unique.filter((article) => !seen.has(article.id)),
    random,
  );
  const recycled = shuffle(
    unique.filter((article) => seen.has(article.id)),
    random,
  );
  const candidates = [...fresh, ...recycled];
  const picked = new Set();
  const deck = [];
  let conflicts = 0;
  const canPick = (article) =>
    !picked.has(article.id) &&
    (!conflictIds.has(article.id) || conflicts < maxConflicts);
  function pick(article) {
    deck.push(article);
    picked.add(article.id);
    if (conflictIds.has(article.id)) conflicts++;
  }
  for (const { topics, count } of ROUND_MIX) {
    let remaining = count * (size / ROUND_SIZE);
    for (const article of candidates) {
      if (!remaining) break;
      if (topics.includes(article.topic) && canPick(article)) {
        pick(article);
        remaining--;
      }
    }
  }
  // Small or incomplete libraries can fall back to other recognized topics, never people.
  for (const article of candidates) {
    if (deck.length === size) break;
    if (canPick(article)) pick(article);
  }
  return {
    policyVersion: ROUND_POLICY_VERSION,
    mode,
    deck: shuffle(deck, random),
    slots: Array(size).fill(null),
    placed: 0,
  };
}

export function placeCard(round, index) {
  const size = roundSize(round);
  if (
    !round ||
    !size ||
    round.placed >= size ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= size ||
    round.slots[index]
  )
    return round;
  const slots = [...round.slots];
  slots[index] = round.deck[round.placed];
  return { ...round, slots, placed: round.placed + 1 };
}

export function isArticle(value) {
  return (
    value &&
    Number.isInteger(value.id) &&
    typeof value.title === "string" &&
    typeof value.extract === "string" &&
    typeof value.image === "string" &&
    /^https:\/\/[^/]*wikimedia\.org\//.test(value.image) &&
    typeof value.url === "string" &&
    /^https:\/\/en\.wikipedia\.org\/wiki\//.test(value.url)
  );
}

export function isValidRound(value) {
  const mode = value?.mode === undefined ? "standard" : value.mode;
  if (typeof mode !== "string" || !Object.hasOwn(ROUND_MODES, mode))
    return false;
  const size = ROUND_MODES[mode].size;
  if (
    !value ||
    ![2, ROUND_POLICY_VERSION].includes(value.policyVersion) ||
    !Array.isArray(value.deck) ||
    value.deck.length !== size ||
    !value.deck.every(isArticle) ||
    !value.deck.every((article) => topicFor(article)) ||
    new Set(value.deck.map((a) => a.id)).size !== size ||
    !Array.isArray(value.slots) ||
    value.slots.length !== size ||
    !value.slots.every((slot) => slot === null || isArticle(slot)) ||
    !Number.isInteger(value.placed) ||
    value.placed < 0 ||
    value.placed > size
  )
    return false;
  if (
    value.policyVersion === ROUND_POLICY_VERSION &&
    value.deck.filter(isConflictTopic).length > conflictLimit(size)
  )
    return false;
  const placed = value.slots.filter(Boolean);
  return (
    placed.length === value.placed &&
    placed.every(isArticle) &&
    new Set(placed.map((a) => a.id)).size === placed.length &&
    placed.every((article) =>
      value.deck.slice(0, value.placed).some((card) => card.id === article.id),
    )
  );
}
