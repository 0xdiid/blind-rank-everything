import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { topicFor, playableArticles } from "../src/lib/topics.js";
import { createRound, isValidRound } from "../src/lib/game.js";

const catalog = JSON.parse(
  await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"),
).articles;

test("biographies, including people described by events, do not enter the deck", () => {
  const examples = [
    ["Taylor Swift", "American singer-songwriter (born 1989)"],
    ["Ulysses S. Grant", "Civil War general, U.S. president from 1869 to 1877"],
    [
      "Abdelbaset al-Megrahi",
      "Libyan convicted of the Lockerbie bombing (1952–2012)",
    ],
    [
      "Francesco Schettino",
      "Italian sea captain responsible for the 2012 Costa Concordia disaster",
    ],
    ["Ilse Koch", "German war criminal (1906–1967)"],
    ["Sinon", "Mythical Greek soldier of the Trojan War"],
    ["Kuku Kohli", "Indian film director (1949–2026)"],
    ["Gene Shalit", "American film critic (1926–2026)"],
    [
      "Lana Rhoades",
      "American internet personality and former adult film star",
    ],
    ["Raj & DK", "Indian film-making duo"],
  ];
  for (const [title, description] of examples)
    assert.equal(topicFor({ title, description }), null, title);
  assert.equal(
    topicFor({
      title: "Unknown subject",
      description: "From the free encyclopedia",
    }),
    null,
  );
});

test("event locations and company subject areas do not determine their category", () => {
  const examples = [
    ["Google", "American multinational technology company", null],
    ["FIFA World Cup Trophy", "Award for victors of the FIFA World Cup", null],
    [
      "Chief Minister of Bihar",
      "Leader of the executive branch of the Government of Bihar",
      null,
    ],
    ["New Zealand", "Island country in the Pacific Ocean", "places"],
    ["Met Gala", "Annual fundraising gala held in New York City", "events"],
    [
      "The Station nightclub fire",
      "2003 deadly fire at a rock concert in West Warwick, Rhode Island, USA",
      "events",
    ],
    ["Winter Olympic Games", "Major international multi-sport event", "events"],
    [
      "Eurovision Song Contest",
      "Annual international song competition",
      "events",
    ],
  ];
  for (const [title, description, expected] of examples)
    assert.equal(topicFor({ title, description }), expected, title);
});

test("films about events stay in culture, and event-related objects are not events", () => {
  assert.equal(
    topicFor({
      title: "War of the Worlds",
      description: "2005 American science fiction film",
    }),
    "culture",
  );
  assert.equal(
    topicFor({
      title: "F-15E Strike Eagle",
      description: "American all-weather multirole fighter aircraft",
    }),
    null,
  );
  assert.equal(
    topicFor({
      title: "Thucydides Trap",
      description:
        "Theorised tendency towards war between emerging and existing powers",
    }),
    "ideas",
  );
});

test("the shipped library supports the requested mix across 1,000 shuffled rounds", () => {
  const playable = playableArticles(catalog);
  assert.ok(playable.length >= 1000);
  let state = 4291;
  const random = () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const firstIds = new Set();
  for (let i = 0; i < 1000; i++) {
    // Include an exhausted-history case; the category mix must survive recycling.
    const seen = i % 2 ? playable.map((article) => article.id) : [];
    const round = createRound(catalog, seen, random);
    const count = (topic) =>
      round.deck.filter((article) => topicFor(article) === topic).length;
    assert.equal(count("events"), 4);
    assert.equal(count("ideas"), 3);
    assert.equal(count("culture"), 1);
    assert.equal(count("food"), 1);
    assert.equal(count("nature") + count("places"), 1);
    assert.equal(new Set(round.deck.map((article) => article.id)).size, 10);
    assert.ok(isValidRound(round));
    firstIds.add(round.deck[0].id);
  }
  assert.ok(firstIds.size > 100, "The reveal order must also be shuffled.");
});

test("unseen cards are preferred within each topic before reusing that topic", () => {
  const round = createRound(catalog);
  const seen = new Set(round.deck.map((article) => article.id));
  const next = createRound(catalog, [...seen]);
  assert.ok(next.deck.every((article) => !seen.has(article.id)));
});

test("person-heavy saved rounds and the previous selection policy are rejected", () => {
  const round = createRound(catalog);
  assert.equal(isValidRound({ ...round, policyVersion: 1 }), false);
  const biography = catalog.find((article) => article.title === "Taylor Swift");
  assert.ok(biography);
  assert.equal(
    isValidRound({ ...round, deck: [biography, ...round.deck.slice(1)] }),
    false,
  );
});
