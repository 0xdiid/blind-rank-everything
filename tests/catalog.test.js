import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isArticle, createRound } from "../src/lib/game.js";
import { playableArticles } from "../src/lib/topics.js";

test("the shipped library contains at least a thousand unique playable Wikipedia cards", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"),
  );
  assert.ok(
    playableArticles(catalog.articles).length >= 1000,
    "Refresh the catalog before shipping.",
  );
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
