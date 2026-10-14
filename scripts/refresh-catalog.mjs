import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import {
  fetchTopTitles,
  fetchArticles,
  recentMonths,
  mergeArticles,
  CATALOG_VERSION,
} from "../src/lib/wikipedia.js";

// Fetch Wikipedia politely: one request at a time, bounded timeouts, and a descriptive User-Agent.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetcher = async (url, options) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pause(1500);
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent":
          "BlindRankEverything/1.0 (Wikipedia discovery game; local catalog builder)",
      },
    });
    if (response.status !== 429 && response.status !== 503) return response;
    const retryAfter = response.headers.get("retry-after");
    const delay = Math.max(
      5000 * 2 ** attempt,
      Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now() || 0,
    );
    console.warn(
      `Rate limited; backing off for ${Math.ceil(delay / 1000)} seconds.`,
    );
    await pause(delay);
  }
  throw new Error(
    "Wikipedia is rate limiting requests. Try the refresh later.",
  );
};
const catalogPath = new URL("../public/catalog.json", import.meta.url);
const months = recentMonths(12);
const titles = new Set();
const successfulMonths = [];
for (const month of months) {
  try {
    for (const title of await fetchTopTitles(month, fetcher)) titles.add(title);
    successfulMonths.push(month);
    console.log(`${month}: ${titles.size} unique popular articles`);
  } catch (error) {
    console.warn(`Skipping ${month}: ${error.message}`);
  }
}
if (!successfulMonths.length)
  throw new Error("No popularity data available; existing catalog preserved.");
let existing;
try {
  existing = JSON.parse(await readFile(catalogPath, "utf8"));
} catch {
  /* First build. */
}
let articles = existing?.articles || [];
const known = new Set(
  articles.map((article) => article.title.replaceAll(" ", "_")),
);
const allTitles = [...titles].filter((title) => !known.has(title));
async function save() {
  const catalog = {
    version: CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    months: [...new Set([...(existing?.months || []), ...successfulMonths])],
    articles,
  };
  await mkdir(new URL("../public/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../public/catalog.tmp.json", import.meta.url),
    JSON.stringify(catalog),
  );
  await rename(
    new URL("../public/catalog.tmp.json", import.meta.url),
    catalogPath,
  );
}
for (let i = 0; i < allTitles.length; i += 50) {
  try {
    articles = mergeArticles(
      articles,
      await fetchArticles(allTitles.slice(i, i + 50), fetcher, {
        allowShortDescriptions: true,
      }),
    );
  } catch (error) {
    if (articles.length >= 100) await save();
    throw error;
  }
  if (i % 200 === 0) {
    console.log(`${articles.length} playable cards collected`);
    if (articles.length >= 100) await save();
  }
}
if (articles.length < 100)
  throw new Error("Too few cards; existing catalog preserved.");
await save();
console.log(`Saved ${articles.length} illustrated Wikipedia cards.`);
