import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Info, X } from "lucide-react";
import ShareRanking from "./ShareRanking.jsx";
import {
  createRound,
  isValidRound,
  placeCard,
  ROUND_SIZE,
} from "./lib/game.js";
import { loadCatalog, refreshCatalog } from "./lib/catalog.js";
import { readStorage, writeStorage } from "./lib/storage.js";
import { useArticleSummary } from "./lib/useArticleSummary.js";

const ROUND_KEY = "blindrank:round:v2";
const SEEN_KEY = "blindrank:seen:v1";

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
      const saved = readStorage(ROUND_KEY);
      const savedSeen = readStorage(SEEN_KEY, []);
      setRound(
        isValidRound(saved)
          ? saved
          : createRound(
              data.articles,
              Array.isArray(savedSeen) ? savedSeen : [],
            ),
      );
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
    writeStorage(ROUND_KEY, round);
    const savedSeen = readStorage(SEEN_KEY, []);
    const seen = Array.isArray(savedSeen) ? savedSeen : [];
    writeStorage(
      SEEN_KEY,
      [
        ...new Set([
          ...seen,
          ...round.deck
            .slice(0, Math.min(round.placed + 1, ROUND_SIZE))
            .map((article) => article.id),
        ]),
      ].slice(-15000),
    );
  }, [round]);

  useEffect(() => {
    if (!round || round.placed >= ROUND_SIZE - 1) return;
    const image = new Image();
    image.src = round.deck[round.placed + 1].image;
  }, [round]);

  function rank(index) {
    if (
      !round ||
      busy.current ||
      round.slots[index] ||
      round.placed >= ROUND_SIZE
    )
      return;
    busy.current = true;
    setLeaving(true);
    const title = round.deck[round.placed].title;
    timer.current = setTimeout(() => {
      setRound((current) => placeCard(current, index));
      setLastPlaced(index);
      setLeaving(false);
      busy.current = false;
      setAnnouncement(
        `${title} ranked ${index + 1}. ${round.placed === 9 ? "Ranking complete." : `Article ${round.placed + 2} of 10.`}`,
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
    const seen = readStorage(SEEN_KEY, []);
    setRound(createRound(catalog.articles, Array.isArray(seen) ? seen : []));
    setLastPlaced(null);
    setModal(null);
    setAnnouncement("New round. Article 1 of 10.");
  }

  function requestNewRound() {
    if (round?.placed > 0 && round.placed < ROUND_SIZE)
      setModal({ type: "restart" });
    else newRound();
  }

  const complete = round?.placed === ROUND_SIZE;
  const current = round && !complete ? round.deck[round.placed] : null;

  return (
    <div className="page">
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
          <span className="current-tab">{complete ? "Results" : "Rank"}</span>
          <button
            className="text-button"
            onClick={requestNewRound}
            disabled={!round || leaving}
          >
            New round
          </button>
        </div>
        <p className="page-description">
          Ten Wikipedia articles. Rank them before you know what comes next.
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
            <div className="game-content">
              <div className="reveal-column" ref={reveal}>
                <div className="column-heading">
                  {complete
                    ? "Round complete"
                    : `Article ${round.placed + 1} of 10`}
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
              </div>
              <div className="ranking-column">
                <div className="column-heading">
                  <span>Your ranking</span>
                  <span className="rank-endpoints">1 best · 10 worst</span>
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
                <div className="rank-status">{round.placed} of 10 ranked</div>
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
            Place each article in an empty slot from 1 (best) to 10 (worst).
            Each choice is final. The next article appears after you choose.
          </p>
          <p>
            Hover over an image or tap its info button for the description.
            Click the title to read the full Wikipedia article.
          </p>
          <p>Keyboard shortcuts: 1–9, and 0 for tenth place.</p>
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
            Each round contains four events, three ideas, one culture topic, one
            food or drink, and one article about nature or a place. Biographies
            are excluded.
          </p>
          <p>
            Articles come from Wikipedia’s most-read lists and a selection of
            topics added for this mix. Unseen articles are preferred within each
            category.
          </p>
          <p>
            Your round and the articles you’ve seen are saved in this browser.
            The app checks for new popular articles when opened, at most once
            per day after a successful check.
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
