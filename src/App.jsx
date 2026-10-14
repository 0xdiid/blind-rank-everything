import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Info, X } from "lucide-react";
import ShareRanking from "./ShareRanking.jsx";
import { placeCard, ROUND_MODES, roundMode, roundSize } from "./lib/game.js";
import { loadCatalog, refreshCatalog } from "./lib/catalog.js";
import { readStorage, writeStorage } from "./lib/storage.js";
import { useArticleSummary } from "./lib/useArticleSummary.js";

import {
  loadRound,
  saveRound,
  savedMode,
  SEEN_KEY,
} from "./lib/round-storage.js";

function Modal({ title, onClose, children, className = "" }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

function WikiImage({ article, className = "", ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [article.image]);
  return failed ? (
    <div className={`image-fallback ${className}`}>
      <span>Image unavailable</span>
    </div>
  ) : (
    <img
      className={className}
      src={article.image}
      alt={article.title}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}

function ArticleLinks({ article }) {
  return (
    <div className="article-links">
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        Read on Wikipedia <ArrowUpRight size={14} />
      </a>
      {article.imageFile && (
        <a
          className="image-credit"
          href={`https://en.wikipedia.org/wiki/File:${encodeURIComponent(article.imageFile)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Image source and license
        </a>
      )}
    </div>
  );
}

function RevealCard({ article, leaving }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const summary = useArticleSummary(article, expanded || hovered);
  return (
    <article
      className={`reveal-card ${expanded ? "details-open" : ""} ${leaving ? "card-leaving" : ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
    >
      <div className="card-photo">
        <WikiImage article={article} fetchPriority="high" />
        <button
          className="card-expand"
          aria-label={expanded ? "Hide description" : `About ${article.title}`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <Info size={18} />
        </button>
        <div className="card-details">
          <p>{summary.extract}</p>
          <ArticleLinks article={article} />
        </div>
      </div>
      <h2 className="card-title">
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
          <ArrowUpRight size={17} aria-label="Open on Wikipedia" />
        </a>
      </h2>
    </article>
  );
}

function ArticleModal({ article, onClose }) {
  const summary = useArticleSummary(article, true);
  return (
    <Modal title={article.title} onClose={onClose} className="article-modal">
      <WikiImage article={article} className="article-modal-image" />
      <p>{summary.extract}</p>
      <ArticleLinks article={article} />
      <p className="fine-print">Text from Wikipedia, CC BY-SA 4.0.</p>
    </Modal>
  );
}

function App() {
  const [catalog, setCatalog] = useState(null);
  const [round, setRound] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [rankInput, setRankInput] = useState("");
  const [rankError, setRankError] = useState("");
  const mode = roundMode(round);
  const size = roundSize(round);
  const expert = mode === "expert";
  const busy = useRef(false);
  const timer = useRef(null);
  const startup = useRef(null);
  const reveal = useRef(null);

  async function boot() {
    setLoading(true);
    setError("");
    try {
      const data = await loadCatalog();
      setCatalog(data);
      setRound(loadRound(data.articles, savedMode()));
      refreshCatalog(data)
        .then(setCatalog)
        .catch(() => {
          /* Play from the bundled library. */
        });
    } catch (failure) {
      setError(failure.message || "The articles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!startup.current) startup.current = boot();
    return () => clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!round) return;
    saveRound(round);
    const savedSeen = readStorage(SEEN_KEY, []);
    const seen = Array.isArray(savedSeen) ? savedSeen : [];
    writeStorage(
      SEEN_KEY,
      [
        ...new Set([
          ...seen,
          ...round.deck
            .slice(0, Math.min(round.placed + 1, size))
            .map((article) => article.id),
        ]),
      ].slice(-15000),
    );
  }, [round]);

  useEffect(() => {
    if (!round || round.placed >= size - 1) return;
    const image = new Image();
    image.src = round.deck[round.placed + 1].image;
  }, [round]);

  function rank(index) {
    if (!round || busy.current || round.slots[index] || round.placed >= size)
      return;
    setRankInput("");
    setRankError("");
    busy.current = true;
    setLeaving(true);
    const title = round.deck[round.placed].title;
    timer.current = setTimeout(() => {
      setRound((current) => placeCard(current, index));
      setLastPlaced(index);
      setLeaving(false);
      busy.current = false;
      setAnnouncement(
        `${title} ranked ${index + 1}. ${round.placed === size - 1 ? "Ranking complete." : `Article ${round.placed + 2} of ${size}.`}`,
      );
      if (window.matchMedia("(max-width: 700px)").matches)
        reveal.current?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
    }, 140);
  }

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      if (
        expert ||
        modal ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        (target instanceof HTMLElement &&
          (target.matches("input, textarea, select") ||
            target.isContentEditable))
      )
        return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        rank(event.key === "0" ? 9 : Number(event.key) - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function newRound() {
    if (!catalog || busy.current) return;
    setRound(loadRound(catalog.articles, mode, { fresh: true }));
    setRankInput("");
    setRankError("");
    setLastPlaced(null);
    setModal(null);
    setAnnouncement(`New round. Article 1 of ${size}.`);
  }

  function switchMode(nextMode) {
    if (!catalog || busy.current || nextMode === mode) return;
    const next = loadRound(catalog.articles, nextMode);
    setRound(next);
    setLastPlaced(null);
    setRankInput("");
    setRankError("");
    setModal(null);
    setAnnouncement(
      `${ROUND_MODES[nextMode].label} mode. ${next.placed} of ${roundSize(next)} ranked.`,
    );
  }

  function submitRank(event) {
    event.preventDefault();
    const index = Number(rankInput) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= size) return;
    if (round.slots[index]) {
      setRankError(`Rank ${index + 1} is already filled.`);
      return;
    }
    rank(index);
  }

  function requestNewRound() {
    if (round?.placed > 0 && round.placed < size) setModal({ type: "restart" });
    else newRound();
  }

  const complete = round?.placed === size;
  const current = round && !complete ? round.deck[round.placed] : null;

  return (
    <div className={`page ${expert ? "expert-mode" : ""}`}>
      <header className="site-header">
        <a
          href={import.meta.env.BASE_URL}
          className="wordmark"
          aria-label="Blindrank home"
        >
          Blindrank
        </a>
        <nav aria-label="Help">
          <button
            className="text-button"
            onClick={() => setModal({ type: "rules" })}
          >
            How to play
          </button>
          <button
            className="text-button"
            onClick={() => setModal({ type: "library" })}
          >
            About
          </button>
        </nav>
      </header>
      <main>
        <h1>Blind rank everything</h1>
        <div className="page-tools">
          <div className="mode-switch" role="group" aria-label="Game mode">
            {Object.entries(ROUND_MODES).map(([key, option]) => (
              <button
                key={key}
                className={`mode-button ${mode === key ? "current-tab" : ""}`}
                aria-pressed={mode === key}
                disabled={!round || leaving}
                onClick={() => switchMode(key)}
              >
                {option.label} <span>{option.size}</span>
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={requestNewRound}
            disabled={!round || leaving}
          >
            New round
          </button>
        </div>
        <p className="page-description">
          {expert ? "Thirty" : "Ten"} Wikipedia articles. Rank them before you
          know what comes next.
        </p>
        <section
          className="game"
          aria-label="Blind ranking game"
          aria-busy={loading}
        >
          {loading ? (
            <p className="loading-state" role="status">
              Loading articles…
            </p>
          ) : error ? (
            <div className="loading-state">
              <p>{error}</p>
              <button className="standard-button" onClick={boot}>
                Try again
              </button>
            </div>
          ) : (
            <div className="game-content" key={mode}>
              <div className="reveal-column" ref={reveal}>
                <div className="column-heading">
                  {complete
                    ? "Round complete"
                    : `Article ${round.placed + 1} of ${size}`}
                </div>
                {complete ? (
                  <section className="completion-card">
                    <WikiImage
                      article={round.slots[0]}
                      className="winner-image"
                    />
                    <p className="winner-label">Ranked first</p>
                    <h2>
                      <a
                        href={round.slots[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {round.slots[0].title}
                      </a>
                    </h2>
                    <ShareRanking
                      articles={round.slots}
                      Dialog={Modal}
                      onNewRound={newRound}
                    />
                  </section>
                ) : (
                  <RevealCard
                    key={current.id}
                    article={current}
                    leaving={leaving}
                  />
                )}
                {expert && !complete && (
                  <form className="rank-entry" onSubmit={submitRank}>
                    <label htmlFor="rank-choice">Rank</label>
                    <input
                      id="rank-choice"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={size}
                      step="1"
                      required
                      placeholder="1–30"
                      value={rankInput}
                      onChange={(event) => {
                        setRankInput(event.target.value);
                        setRankError("");
                      }}
                      aria-describedby={rankError ? "rank-error" : undefined}
                      aria-invalid={Boolean(rankError)}
                    />
                    <button className="standard-button" disabled={leaving}>
                      Place
                    </button>
                    {rankError && (
                      <p id="rank-error" className="rank-error" role="alert">
                        {rankError}
                      </p>
                    )}
                  </form>
                )}
              </div>
              <div className="ranking-column">
                <div className="column-heading">
                  <span>Your ranking</span>
                  <span className="rank-endpoints">1 best · {size} worst</span>
                </div>
                <div className="ranking-slots" aria-label="Ranking slots">
                  {round.slots.map((article, index) => (
                    <button
                      key={index}
                      className={`rank-slot ${article ? "filled" : "empty"} ${index === lastPlaced ? "just-placed" : ""}`}
                      onClick={() =>
                        article
                          ? setModal({ type: "article", article })
                          : rank(index)
                      }
                      aria-label={
                        article
                          ? `Rank ${index + 1}: ${article.title}. View article.`
                          : `Place ${current?.title || "article"} at rank ${index + 1}`
                      }
                      aria-disabled={!article && leaving}
                    >
                      <span className="rank-number">{index + 1}</span>
                      {article ? (
                        <>
                          <WikiImage
                            article={article}
                            className="slot-thumbnail"
                          />
                          <span className="slot-title">{article.title}</span>
                          <ArrowUpRight className="slot-arrow" size={14} />
                        </>
                      ) : (
                        <>
                          <span className="slot-placeholder" aria-hidden="true">
                            —
                          </span>
                          <span className="slot-action" aria-hidden="true">
                            Select
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <div className="rank-status">
                  {round.placed} of {size} ranked
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <p>
          Articles from{" "}
          <a
            href="https://en.wikipedia.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikipedia
          </a>
          . Text under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
        <button
          className="text-button"
          onClick={() => setModal({ type: "library" })}
        >
          {catalog
            ? `${catalog.articles.length.toLocaleString()} articles`
            : "About the library"}
        </button>
      </footer>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      {modal?.type === "rules" && (
        <Modal title="How to play" onClose={() => setModal(null)}>
          <p>
            Place each article in an empty slot from 1 (best) to {size} (worst).
            Each choice is final. The next article appears after you choose.
          </p>
          <p>
            Hover over an image or tap its info button for the description.
            Click the title to read the full Wikipedia article.
          </p>
          <p>
            {expert
              ? "Enter a rank from 1 to 30 and press Enter, or choose a slot."
              : "Keyboard shortcuts: 1–9, and 0 for tenth place."}
          </p>
        </Modal>
      )}
      {modal?.type === "restart" && (
        <Modal title="Start a new round?" onClose={() => setModal(null)}>
          <p>This will replace your current ranking.</p>
          <div className="modal-actions">
            <button className="standard-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="standard-button primary" onClick={newRound}>
              New round
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "article" && (
        <ArticleModal article={modal.article} onClose={() => setModal(null)} />
      )}
      {modal?.type === "library" && (
        <Modal title="About this game" onClose={() => setModal(null)}>
          <p>
            Standard rounds contain four events, three ideas, one culture topic,
            one food or drink, and one article about nature or a place.
            Biographies are excluded. Expert mode triples this mix to 30
            articles.
          </p>
          <p>
            Wars, battles, and related conflict topics are limited to one per
            Standard round and three per Expert round.
          </p>
          <p>
            Articles come from Wikipedia’s most-read lists and a selection of
            topics added for this mix. Unseen articles are preferred within each
            category.
          </p>
          <p>
            Each mode saves its own round in this browser, along with the
            articles you’ve seen. The app checks for new popular articles when
            opened, at most once per day after a successful check.
          </p>
          <p>
            Article text is from{" "}
            <a
              href="https://en.wikipedia.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikipedia
            </a>{" "}
            under{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC BY-SA 4.0
            </a>
            . Each image links to its source and license. Popularity data is
            from the{" "}
            <a
              href="https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wikimedia Analytics API
            </a>
            .
          </p>
          <p className="fine-print">
            Independent project. Not affiliated with the Wikimedia Foundation.
          </p>
        </Modal>
      )}
    </div>
  );
}

export default App;
