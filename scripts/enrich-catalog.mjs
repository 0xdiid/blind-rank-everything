import { readFile, writeFile, rename } from "node:fs/promises";
import { topicSeeds } from "./topic-seeds.mjs";
import { wikiFetch } from "./wiki-fetch.mjs";
import { fetchArticles, mergeArticles } from "../src/lib/wikipedia.js";
import { topicFor } from "../src/lib/topics.js";

const path = new URL("../public/catalog.json", import.meta.url);
const catalog = JSON.parse(await readFile(path, "utf8"));
let articles = catalog.articles;
const counts = {};
async function save() {
  const tmp = new URL("../public/catalog.tmp.json", import.meta.url);
  await writeFile(
    tmp,
    JSON.stringify({
      ...catalog,
      enrichedAt: new Date().toISOString(),
      articles,
    }),
  );
  await rename(tmp, path);
}

for (const [topic, titles] of Object.entries(topicSeeds)) {
  const wanted = new Set(titles.map((title) => title.toLowerCase()));
  articles = articles.map((article) =>
    wanted.has(article.title.toLowerCase()) ? { ...article, topic } : article,
  );
  const known = new Set(articles.map((article) => article.title.toLowerCase()));
  const missing = titles.filter((title) => !known.has(title.toLowerCase()));
  for (let i = 0; i < missing.length; i += 50) {
    try {
      const incoming = await fetchArticles(
        missing.slice(i, i + 50),
        wikiFetch,
        { allowShortDescriptions: true },
      );
      const tagged = incoming.map((article) => ({ ...article, topic }));
      articles = mergeArticles(articles, tagged);
      await save();
    } catch (error) {
      await save();
      throw error;
    }
  }
  counts[topic] = articles.filter(
    (article) => topicFor(article) === topic,
  ).length;
  await save();
  console.log(`${topic}: ${counts[topic]} playable articles`);
}
console.log(
  `Saved ${articles.length} source articles; ${articles.filter((article) => topicFor(article)).length} available for the game.`,
);
