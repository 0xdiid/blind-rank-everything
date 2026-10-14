import {
  fetchTopTitles,
  fetchArticles,
  mergeArticles,
  recentMonths,
} from "./wikipedia.js";
import { isArticle, shuffle } from "./game.js";
import { readStorage, writeStorage } from "./storage.js";
import { playableArticles } from "./topics.js";

const CACHE_KEY = "blindrank:wiki-updates:v1";

export async function loadCatalog() {
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.json`);
  if (!response.ok) throw new Error("The card library could not be loaded.");
  const data = await response.json();
  const articles = data.articles?.filter(isArticle);
  if (!articles || articles.length < 10)
    throw new Error("The card library is incomplete.");
  const cache = readStorage(CACHE_KEY);
  return {
    ...data,
    articles: playableArticles(
      mergeArticles(
        articles,
        Array.isArray(cache?.articles) ? cache.articles.filter(isArticle) : [],
      ),
    ),
  };
}

// Supplement the bundled library once a day; never make an active round wait for Wikipedia.
export async function refreshCatalog(catalog) {
  const cache = readStorage(CACHE_KEY);
  if (cache?.checkedAt > Date.now() - 24 * 60 * 60 * 1000) return catalog;
  const titles = await fetchTopTitles(recentMonths(1)[0]);
  const existing = new Set(
    catalog.articles.map((article) => article.title.replaceAll(" ", "_")),
  );
  const candidates = shuffle(
    titles.filter((title) => !existing.has(title)),
  ).slice(0, 80);
  let additions = [];
  for (let i = 0; i < candidates.length; i += 20) {
    additions = mergeArticles(
      additions,
      await fetchArticles(candidates.slice(i, i + 20)),
    );
  }
  const cached = Array.isArray(cache?.articles)
    ? cache.articles.filter(isArticle)
    : [];
  writeStorage(CACHE_KEY, {
    checkedAt: Date.now(),
    articles: mergeArticles(cached, additions).slice(-400),
  });
  return {
    ...catalog,
    articles: playableArticles(mergeArticles(catalog.articles, additions)),
  };
}
