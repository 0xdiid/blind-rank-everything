import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { catalogSources, catalogTargets } from "./catalog-sources.mjs";
import { wikiFetch } from "./wiki-fetch.mjs";
import {
  API,
  fetchJson,
  fetchArticles,
  isPlayableTitle,
  mergeArticles,
} from "../src/lib/wikipedia.js";
import { topicFor } from "../src/lib/topics.js";

const path = new URL("../public/catalog.json", import.meta.url);
const catalog = JSON.parse(await readFile(path, "utf8"));
const cachePath = new URL("../.cache/catalog-expansion.json", import.meta.url);
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
let cache = { createdAt: Date.now(), checked: [], articles: [] };
try {
  const previous = JSON.parse(await readFile(cachePath, "utf8"));
  if (previous.createdAt > Date.now() - 24 * 60 * 60 * 1000) cache = previous;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
cache.screenedSources ||= {};
cache.candidates ||= {};
const checked = new Set(cache.checked);
let articles = catalog.articles;
const counts = Object.fromEntries(
  Object.keys(catalogTargets).map((topic) => [
    topic,
    articles.filter((article) => topicFor(article) === topic).length,
  ]),
);
const knownIds = new Set(articles.map((article) => article.id));
const complete = () =>
  Object.entries(catalogTargets).every(
    ([topic, target]) => counts[topic] >= target,
  );

async function saveCache() {
  const tmp = new URL("../.cache/catalog-expansion.tmp.json", import.meta.url);
  await writeFile(tmp, JSON.stringify({ ...cache, checked: [...checked] }));
  await rename(tmp, cachePath);
}
async function save() {
  const tmp = new URL("../public/catalog.tmp.json", import.meta.url);
  await writeFile(
    tmp,
    JSON.stringify({
      ...catalog,
      expandedAt: new Date().toISOString(),
      discoverySources: [
        ...new Set([
          ...(catalog.discoverySources || []),
          ...Object.keys(cache.screenedSources).filter(
            (page) =>
              cache.screenedSources[page].done &&
              cache.screenedSources[page].ids.length,
          ),
        ]),
      ],
      articles,
    }),
  );
  await rename(tmp, path);
}
function accept(incoming) {
  articles = mergeArticles(
    articles,
    incoming.filter((article) => {
      const topic = topicFor(article);
      if (
        !topic ||
        knownIds.has(article.id) ||
        counts[topic] >= catalogTargets[topic]
      )
        return false;
      knownIds.add(article.id);
      counts[topic]++;
      return true;
    }),
  );
}
accept(cache.articles);

// The links generator supports 500 pages of lightweight metadata per request.
// Screen those first; fetch actual thumbnails only for eligible, needed cards.
for (const source of catalogSources) {
  if (complete()) break;
  const progress = (cache.screenedSources[source] ||= { ids: [] });
  while (!progress.done) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "links",
      redirects: "1",
      titles: source,
      gplnamespace: "0",
      gpllimit: "500",
      prop: "pageprops",
      ...progress.continuation,
    });
    const data = await fetchJson(`${API}?${params}`, wikiFetch);
    for (const page of data.query?.pages || []) {
      if (
        page.missing ||
        page.ns !== 0 ||
        !isPlayableTitle(page.title) ||
        page.pageprops?.disambiguation !== undefined ||
        !page.pageprops?.page_image_free
      )
        continue;
      const candidate = {
        id: page.pageid,
        title: page.title,
        description: page.pageprops["wikibase-shortdesc"] || "",
      };
      if (!topicFor(candidate)) continue;
      cache.candidates[candidate.id] = candidate;
      progress.ids.push(candidate.id);
    }
    progress.continuation = data.continue;
    progress.done = !data.continue;
    await saveCache();
    console.log(
      `${source}: ${progress.ids.length} illustrated topic candidates${progress.done ? " (complete)" : ""}`,
    );
  }
}

const pools = catalogSources.map((source) =>
  [...new Set(cache.screenedSources[source]?.ids || [])]
    .map((id) => cache.candidates[id])
    .filter(
      (article) => !knownIds.has(article.id) && !checked.has(article.title),
    )
    .map((article) => ({
      ...article,
      order: createHash("sha256").update(article.title).digest("hex"),
    }))
    .sort((a, b) => a.order.localeCompare(b.order)),
);
const candidates = new Map();
// Interleaving prevents a long list (or its alphabetic order) dominating a pool.
for (let i = 0; pools.some((pool) => i < pool.length); i++) {
  for (const pool of pools) if (pool[i]) candidates.set(pool[i].id, pool[i]);
}
let queue = [...candidates.values()];
console.log(
  `Fetching thumbnails for up to ${queue.length} eligible candidates. Pools: ${JSON.stringify(counts)}`,
);
while (queue.length && !complete()) {
  queue = queue.filter((article) => {
    const topic = topicFor(article);
    return (
      topic &&
      counts[topic] < catalogTargets[topic] &&
      !knownIds.has(article.id)
    );
  });
  const titles = queue.splice(0, 50).map((article) => article.title);
  if (!titles.length) break;
  const incoming = await fetchArticles(titles, wikiFetch, {
    allowShortDescriptions: true,
    includeExtracts: false,
  });
  cache.articles = mergeArticles(cache.articles, incoming);
  titles.forEach((title) => checked.add(title));
  accept(incoming);
  await save();
  await saveCache();
  console.log(`${queue.length} candidates remain: ${JSON.stringify(counts)}`);
}
await save();
console.log(
  `Saved ${Object.values(counts).reduce((sum, count) => sum + count, 0)} playable cards: ${JSON.stringify(counts)}`,
);
if (!complete())
  console.log(
    "Some pools still need additional sources to reach their targets.",
  );
