export const API = "https://en.wikipedia.org/w/api.php";
export const METRICS =
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access";
export const CATALOG_VERSION = 1;

export function isPlayableTitle(title) {
  return (
    typeof title === "string" &&
    title.trim().length > 0 &&
    !/^(?:Special|Wikipedia|Portal|File|Category|Help|Talk|Template|User|Draft|Module|MediaWiki)(?:_talk)?:/i.test(
      title.replaceAll(" ", "_"),
    ) &&
    !/^(Main_Page$|List_of_|Lists_of_|Deaths_in_|\d{4}(?:_in_|$)|Index_of_)/i.test(
      title.replaceAll(" ", "_"),
    )
  );
}

export async function fetchJson(url, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    const error = new Error(`Wikipedia returned ${response.status}`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }
  const data = await response.json();
  if (data.error)
    throw new Error(data.error.info || "Wikipedia is unavailable");
  return data;
}

export function recentMonths(count = 6, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index - 1, 1),
    );
    return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function fetchTopTitles(month, fetcher = fetch) {
  const data = await fetchJson(`${METRICS}/${month}/all-days`, fetcher);
  const articles = data.items?.[0]?.articles;
  if (!Array.isArray(articles))
    throw new Error("Unexpected Wikipedia popularity response");
  return articles.map((entry) => entry.article).filter(isPlayableTitle);
}

export function normalizePage(page, { allowShortDescriptions = false } = {}) {
  const description = page?.pageprops?.["wikibase-shortdesc"];
  const extract =
    page?.extract?.trim() || (allowShortDescriptions ? description : "");
  if (
    !page ||
    page.missing ||
    page.ns !== 0 ||
    !page.pageid ||
    !isPlayableTitle(page.title) ||
    page.pageprops?.disambiguation !== undefined ||
    !page.thumbnail?.source ||
    !extract ||
    /^(none|disambiguation page)$/i.test(extract)
  )
    return null;
  const image = page.thumbnail.source;
  const url = page.canonicalurl || page.fullurl;
  if (
    !/^https:\/\/[^/]*wikimedia\.org\//.test(image) ||
    !/^https:\/\/en\.wikipedia\.org\/wiki\//.test(url)
  )
    return null;
  return {
    id: page.pageid,
    title: page.title,
    description: description || "From the free encyclopedia",
    extract: extract.replace(/\s+/g, " "),
    summaryComplete: Boolean(page.extract?.trim()),
    image,
    imageFile: page.pageimage || "",
    url,
  };
}

export async function fetchArticles(
  titles,
  fetcher = fetch,
  { allowShortDescriptions = false, includeExtracts = true } = {},
) {
  if (!titles.length) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    prop: includeExtracts
      ? "pageimages|extracts|info|pageprops"
      : "pageimages|info|pageprops",
    inprop: "url",
    piprop: "thumbnail|name",
    pithumbsize: "800",
    ...(includeExtracts
      ? {
          exintro: "1",
          explaintext: "1",
          exsentences: "3",
          exlimit: "max",
        }
      : {}),
    redirects: "1",
    titles: titles.slice(0, allowShortDescriptions ? 50 : 20).join("|"),
  });
  const data = await fetchJson(`${API}?${params}`, fetcher);
  return (data.query?.pages || [])
    .map((page) => normalizePage(page, { allowShortDescriptions }))
    .filter(Boolean);
}

export function mergeArticles(...collections) {
  const merged = new Map();
  for (const article of collections.flat())
    merged.set(article.id, { ...merged.get(article.id), ...article });
  return [...merged.values()];
}
