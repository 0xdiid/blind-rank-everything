import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isArticle, createRound } from "../src/lib/game.js";
import { playableArticles, topicFor } from "../src/lib/topics.js";

test("the shipped library has at least five times the original cards in every topic", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"),
  );
  assert.ok(
    playableArticles(catalog.articles).length >= 5360,
    "Refresh the catalog before shipping.",
  );
  const originalCounts = {
    events: 275,
    ideas: 173,
    culture: 143,
    food: 190,
    nature: 104,
    places: 187,
  };
  for (const [topic, count] of Object.entries(originalCounts)) {
    assert.ok(
      catalog.articles.filter((article) => topicFor(article) === topic)
        .length >=
        count * 5,
      `${topic} needs at least five times its original ${count} cards.`,
    );
  }
  assert.equal(
    new Set(catalog.articles.map((article) => article.id)).size,
    catalog.articles.length,
  );
  assert.ok(
    catalog.articles.every(
      (article) => isArticle(article) && article.extract.trim().length > 0,
    ),
  );
  assert.ok(catalog.months.length >= 6);
  assert.ok(Number.isFinite(Date.parse(catalog.updatedAt)));
  const round = createRound(catalog.articles);
  assert.equal(new Set(round.deck.map((article) => article.id)).size, 10);
});
