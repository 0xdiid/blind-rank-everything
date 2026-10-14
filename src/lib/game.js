import { topicFor } from "./topics.js";

export const ROUND_SIZE = 10;
export const ROUND_POLICY_VERSION = 2;
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

export function createRound(catalog, seenIds = [], random = Math.random) {
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
  if (unique.length < ROUND_SIZE)
    throw new Error("At least ten eligible articles are needed for a round.");
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
  for (const { topics, count } of ROUND_MIX) {
    for (const article of candidates
      .filter(
        (article) => topics.includes(article.topic) && !picked.has(article.id),
      )
      .slice(0, count)) {
      deck.push(article);
      picked.add(article.id);
    }
  }
  // Small or incomplete libraries can fall back to other recognized topics, never people.
  for (const article of candidates) {
    if (deck.length === ROUND_SIZE) break;
    if (!picked.has(article.id)) {
      deck.push(article);
      picked.add(article.id);
    }
  }
  return {
    policyVersion: ROUND_POLICY_VERSION,
    deck: shuffle(deck, random),
    slots: Array(ROUND_SIZE).fill(null),
    placed: 0,
  };
}

export function placeCard(round, index) {
  if (
    !round ||
    round.placed >= ROUND_SIZE ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= ROUND_SIZE ||
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
  if (
    !value ||
    value.policyVersion !== ROUND_POLICY_VERSION ||
    !Array.isArray(value.deck) ||
    value.deck.length !== ROUND_SIZE ||
    !value.deck.every(isArticle) ||
    !value.deck.every((article) => topicFor(article)) ||
    new Set(value.deck.map((a) => a.id)).size !== ROUND_SIZE ||
    !Array.isArray(value.slots) ||
    value.slots.length !== ROUND_SIZE ||
    !value.slots.every((slot) => slot === null || isArticle(slot)) ||
    !Number.isInteger(value.placed) ||
    value.placed < 0 ||
    value.placed > ROUND_SIZE
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
