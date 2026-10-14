import { useEffect, useState } from "react";
import { fetchArticles } from "./wikipedia.js";

const summaries = new Map();

// Short descriptions render immediately. Longer lead excerpts are fetched only when requested.
export function useArticleSummary(article, enabled) {
  const [summary, setSummary] = useState(article);
  useEffect(() => {
    setSummary(article);
    if (!enabled || article.summaryComplete !== false) return;
    let active = true;
    if (!summaries.has(article.id)) {
      const request = fetchArticles([article.title]).then(
        (articles) =>
          articles.find((item) => item.id === article.id) || article,
      );
      summaries.set(article.id, request);
      if (summaries.size > 100) summaries.delete(summaries.keys().next().value);
      request.catch(() => summaries.delete(article.id));
    }
    summaries
      .get(article.id)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch(() => {
        /* The Wikidata description is already available. */
      });
    return () => {
      active = false;
    };
  }, [article, enabled]);
  return summary;
}
