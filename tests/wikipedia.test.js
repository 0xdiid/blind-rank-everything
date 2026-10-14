import test from "node:test";
import assert from "node:assert/strict";
import {
  recentMonths,
  isPlayableTitle,
  normalizePage,
  fetchArticles,
  fetchTopTitles,
  fetchJson,
  mergeArticles,
} from "../src/lib/wikipedia.js";

const page = {
  pageid: 6776,
  ns: 0,
  title: "Capybara",
  thumbnail: {
    source:
      "https://upload.wikimedia.org/wikipedia/commons/7/71/Capybaracropped.jpg",
  },
  pageimage: "Capybaracropped.jpg",
  extract: "The capybara is a rodent.\n It is native to South America.",
  canonicalurl: "https://en.wikipedia.org/wiki/Capybara",
  pageprops: { "wikibase-shortdesc": "Largest living rodent" },
};

test("monthly popularity windows exclude partial months and handle year boundaries", () => {
  assert.deepEqual(recentMonths(3, new Date("2026-01-01T00:00:00Z")), [
    "2025/12",
    "2025/11",
    "2025/10",
  ]);
});

test("utility, list, and date pages are excluded while regular article titles remain", () => {
  for (const title of [
    "Main_Page",
    "Special:Search",
    "List_of_dogs",
    "Deaths in 2026",
    "2026_in_film",
    "Wikipedia:About",
    "File:Earth.jpg",
    "User talk:Example",
    "",
  ])
    assert.equal(isPlayableTitle(title), false);
  for (const title of [
    "Capybara",
    "Coffee",
    "The Beatles",
    "2001: A Space Odyssey",
    "2026 Winter Olympics",
    "1906 San Francisco earthquake",
  ]) {
    assert.equal(isPlayableTitle(title), true);
  }
});

test("article metadata is normalized and unusable cards are dropped", () => {
  const article = normalizePage(page);
  assert.equal(article.id, 6776);
  assert.equal(
    article.extract,
    "The capybara is a rodent. It is native to South America.",
  );
  assert.equal(article.imageFile, "Capybaracropped.jpg");
  for (const change of [
    { missing: true },
    { ns: 4 },
    { thumbnail: null },
    { extract: "" },
    { pageprops: { disambiguation: "" } },
    { canonicalurl: "https://example.com" },
    { thumbnail: { source: "javascript:alert(1)" } },
  ])
    assert.equal(normalizePage({ ...page, ...change }), null);
});

test("batched API requests include CORS, redirects, summaries, thumbnails, and safe limits", async () => {
  const result = await fetchArticles(
    Array.from({ length: 50 }, (_, i) => `Title ${i}`),
    async (url) => {
      const params = new URL(url).searchParams;
      assert.equal(params.get("origin"), "*");
      assert.equal(params.get("redirects"), "1");
      assert.equal(params.get("titles").split("|").length, 20);
      assert.ok(params.get("prop").includes("extracts"));
      return Response.json({ query: { pages: [page, { missing: true }] } });
    },
  );
  assert.equal(result.length, 1);
});

test("bulk catalog cards retain real short descriptions when full extracts are limited", async () => {
  const shortPage = { ...page, extract: undefined };
  assert.equal(normalizePage(shortPage), null);
  const result = await fetchArticles(
    Array.from({ length: 60 }, (_, i) => `Title ${i}`),
    async (url) => {
      assert.equal(
        new URL(url).searchParams.get("titles").split("|").length,
        50,
      );
      return Response.json({ query: { pages: [shortPage] } });
    },
    { allowShortDescriptions: true },
  );
  assert.equal(result[0].extract, "Largest living rodent");
  assert.equal(result[0].summaryComplete, false);
});

test("top lists filter utility pages and merge redirected articles by page id", async () => {
  const titles = await fetchTopTitles("2026/09", async (url) => {
    assert.ok(url.endsWith("/2026/09/all-days"));
    return Response.json({
      items: [
        { articles: [{ article: "Main_Page" }, { article: "Capybara" }] },
      ],
    });
  });
  assert.deepEqual(titles, ["Capybara"]);
  assert.equal(
    mergeArticles([normalizePage(page)], [normalizePage(page)]).length,
    1,
  );
});

test("large imports can request short descriptions without expensive lead extracts", async () => {
  const result = await fetchArticles(
    ["Capybara"],
    async (url) => {
      assert.ok(!new URL(url).searchParams.get("prop").includes("extracts"));
      assert.equal(new URL(url).searchParams.has("exlimit"), false);
      return Response.json({
        query: { pages: [{ ...page, extract: undefined }] },
      });
    },
    { allowShortDescriptions: true, includeExtracts: false },
  );
  assert.equal(result[0].extract, "Largest living rodent");
  assert.equal(result[0].summaryComplete, false);
});

test("rate limits and API errors reject cleanly for the caller to use its bundled fallback", async () => {
  await assert.rejects(
    fetchJson(
      "https://example.com",
      async () =>
        new Response("", { status: 429, headers: { "retry-after": "60" } }),
    ),
    (error) => error.status === 429 && error.retryAfter === "60",
  );
  await assert.rejects(
    fetchArticles(["Capybara"], async () =>
      Response.json({ error: { info: "Try later" } }),
    ),
    /Try later/,
  );
});

test("live metadata updates retain the curated topic assignment", () => {
  const original = { ...normalizePage(page), topic: "nature" };
  const updated = { ...normalizePage(page), extract: "An updated excerpt." };
  const merged = mergeArticles([original], [updated]);
  assert.equal(merged[0].topic, "nature");
  assert.equal(merged[0].extract, "An updated excerpt.");
});
