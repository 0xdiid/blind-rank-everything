# Blindrank

A Wikipedia discovery game. Ten random articles, revealed one at a time. Expert mode raises it to thirty. Put each in an empty slot from 1 (best) to 10 or 30 (worst), without knowing what comes next.

[Play Blindrank](https://0xdiid.github.io/blind-rank-everything/)

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`.

```sh
npm test              # Game rules, persistence validation, and Wikipedia integration
npm run build        # Production files in dist/
npm run preview      # Preview the production build
npm run format       # Format source files
npm run refresh:catalog
npm run enrich:catalog
npm run expand:catalog
```

The app is a static React + Vite site. Deploy `dist/` to a static host. It requires no API keys, backend, account system, or database.

## GitHub Pages

Pushes to `main` run the tests, build the site, and deploy it through `.github/workflows/pages.yml`. Pull requests run the checks without deploying. The repository's **Settings → Pages → Source** must be **GitHub Actions**.

The workflow reads the site address and subdirectory from GitHub Pages and passes them to Vite. This keeps asset paths and the URL printed on shared images aligned with the deployment, including forks or custom domains.

To check the project-path build locally:

```sh
VITE_BASE_PATH=/blind-rank-everything/ npm run build
VITE_BASE_PATH=/blind-rank-everything/ npm run preview
```

Open `http://127.0.0.1:4173/blind-rank-everything/`. Other hosts can set `VITE_BASE_PATH` and `VITE_PUBLIC_URL` when building; the local development server continues to use `/`.

## How it plays

- Standard rounds draw four events, three ideas, one culture topic, one food or drink, and one place or nature topic. Expert mode triples the mix: twelve events, nine ideas, three culture topics, three foods or drinks, and three nature or place topics. The reveal order is shuffled, and each category favors articles you have not seen in this browser.
- Wars, battles, and related conflict topics are capped at one per Standard round and three per Expert round, including military ideas. The cap also applies when recycling seen cards or filling gaps in a small catalog. Earlier rounds already in progress keep their cards; unstarted rounds use the new balance.
- An image and title are visible first. Hover or tap the info button for a description and the Wikipedia link; the title also opens the full article in a new tab.
- Click a ranking slot. Standard mode also supports 1–9 / 0 for rank 10; in Expert mode, type a rank from 1 to 30 in the Rank field and press Enter. Placements cannot be moved.
- Each mode saves its own round, so switching modes preserves progress. Your selected mode and shared seen history also persist in local storage. If storage is unavailable, gameplay still works in memory.
- Complete a round to share a ranking image, inspect any placed article, or start again. Starting over mid-round asks for confirmation.
- The layout adapts to mobile, dialogs support keyboard focus and Escape, and animations respect reduced-motion preferences.

## Sharing

The results screen's **Share results** button copies a PNG directly to the clipboard. Standard results use 1600 × 900 pixels. Expert results use a 2400 × 1350 image with three columns: ranks 1–10, 11–20, and 21–30. Standard mode uses the two-column ranking table: ranks 1–5 on the left, 6–10 on the right, with thumbnails, blue titles, and the game's public URL beneath the table. The image is prepared when the round finishes so copying can run immediately from the click.

**Image options** opens the preview with copy, download, and native image sharing where supported. If clipboard access is unavailable, this panel opens automatically. Native shares include the game's public URL; no social account is required and nothing is posted automatically.

Links to the game include Open Graph and Twitter/X large-image metadata in the initial HTML. The preview is `public/social-preview.png` (1200 × 630), with editable artwork in `scripts/social-preview.svg`. The canonical and preview URLs in `index.html` point to GitHub Pages; update them if you move the site. This preview represents the game; individual results are shared through the copied ranking image.

PNG rendering runs locally in the browser. Cross-origin image failures time out after six seconds and use a letter placeholder, preserving every title. The preview, clipboard, and download use the same PNG. Canceling the native share sheet leaves the ranking intact.

## Wikipedia data

`public/catalog.json` combines twelve complete months of English Wikipedia's top-1,000 pageview lists with selected topics, Wikipedia's Vital Articles lists, and subject lists in history, science, philosophy, culture, food, and geography. The builder deduplicates redirects by page ID and excludes lists, utility pages, disambiguation pages, and articles without a main image or description.

The source file retains biographies from the popularity imports, but the game filters them out. Reviewed seed topics have explicit categories; other articles are classified conservatively from Wikipedia's descriptions. Unrecognized subjects are skipped. The playable library has more than 5,000 articles, with at least five times the original selection in every topic. If a small custom library cannot fill the category mix, the game fills the remaining slots from other eligible topics.

The bundled cards include main-image URLs, article links, short descriptions, and lead excerpts where available. When a card only has a short description, opening its details requests the longer Wikipedia excerpt and caches it for the session. The existing description remains usable if Wikipedia is slow or unavailable. Images are served by Wikimedia; a visual fallback appears if an image fails to load.

On application load, a background check supplements the bundle with up to 80 articles from the latest complete month's top list. Successful checks are cached for 24 hours. These checks run while the site is open; there is no scheduled background service. A live API failure never prevents playing from the bundled library.

### Refreshing the bundle

Run `npm run refresh:catalog` periodically to expand the bundle using the latest twelve complete months. The script makes sequential requests, respects `Retry-After`, retries rate limits with backoff, and saves progress atomically. It resumes from existing cards on the next run. Wikimedia can throttle a large import, so a complete refresh may take several minutes. Existing articles are retained; this command does not re-fetch every older article.

Run `npm run enrich:catalog` to import the topic lists in `scripts/topic-seeds.mjs`. This adds subjects that are underrepresented in the most-read lists and preserves their categories during later popularity refreshes. It also saves checkpoints and backs off when Wikimedia throttles requests.

Run `npm run expand:catalog` to draw additional candidates from the curated lists in `scripts/catalog-sources.mjs`. The importer interleaves sources, uses a stable shuffle to avoid alphabetical bias, and caps each topic separately. List membership does not assign a category: each card must pass the same topic and biography filters as the game. It saves after each batch and skips existing page IDs. Change the sources and targets in that file to expand the library further.

Expansion screens up to 500 linked pages per request using descriptions and main-image metadata, then fetches thumbnails for eligible cards in batches of 50. Full excerpts use the game's existing on-demand fetch. A local `.cache/` checkpoint, ignored by Git and valid for 24 hours, avoids repeating completed discovery and metadata requests after an interruption. Delete it to recheck candidates immediately.

Popularity and seed imports fetch up to fifty article records per call, requesting both excerpts and short descriptions. Wikipedia limits the number of full extracts in each batch; remaining cards use their real short descriptions until longer excerpts are requested in the app.

In development, catalog checkpoints do not trigger a page reload. Refresh the browser after the import completes to load the expanded library; your current round is preserved.

### Sources and attribution

- [Wikimedia Analytics API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/) — monthly most-read articles.
- [Wikipedia Vital Articles](https://en.wikipedia.org/wiki/Wikipedia:Vital_articles) — curated subjects across history, culture, science, and geography; biography lists are omitted.
- [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page) — article IDs, canonical links, summaries, descriptions, and main images.
- Wikipedia excerpts are available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app normalizes whitespace and uses short excerpts; article links lead to the source and contributor history.
- Images retain their individual licenses and attribution requirements. Every card's details link to its Wikipedia file page for the original image, author, and license. Images are hotlinked, not republished in this repository.

This is an independent project, not affiliated with the Wikimedia Foundation. The popular-article library is not editorially age-filtered.

## Source map

- `src/App.jsx`: responsive game, reveal cards, ranking board, and dialogs.
- `src/styles.css`: visual design and responsive layouts.
- The design uses Georgia headings, Arial body text, blue links, and thin gray borders inspired by Wikipedia. It loads no external fonts.
- `src/lib/game.js`: mode definitions, round generation, ranking, and saved-state validation.
- `src/lib/round-storage.js`: separate saved rounds and mode preference, including existing Standard rounds.
- `src/lib/topics.js`: category classification and biography filtering.
- `src/lib/wikipedia.js`: public Wikimedia API client and article normalization.
- `src/lib/catalog.js`: bundled library loading and daily browser cache.
- `src/lib/useArticleSummary.js`: on-demand excerpt enrichment.
- `scripts/refresh-catalog.mjs`: resumable catalog generation.
- `scripts/enrich-catalog.mjs`: topic-list imports for the round mix.
- `scripts/expand-catalog.mjs`: broader imports from Wikipedia's curated lists.
- `tests/`: Node's built-in test runner; no extra testing runtime needed.

## Contributing

Issues and pull requests are welcome. Run `npm test` and `npm run build` before submitting a change. Topic additions belong in `scripts/topic-seeds.mjs`; run `npm run enrich:catalog` to fetch their real Wikipedia metadata.

## License

Application code is licensed under [MIT](LICENSE). Wikipedia content and images retain their own licenses; see [NOTICE.md](NOTICE.md).
