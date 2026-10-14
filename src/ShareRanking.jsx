import React, { useEffect, useState } from "react";
import {
  canShareImage,
  copyRankingImage,
  createRankingImage,
  imageShareData,
  rankingAltText,
  SHARE_FILENAME,
  SHARE_WIDTH,
  SHARE_HEIGHT,
} from "./lib/share.js";

export default function ShareRanking({ articles, Dialog, onNewRound }) {
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl;
    setError("");
    setImage(null);
    // Prepare on completion, before the click, to preserve clipboard activation.
    createRankingImage(articles)
      .then((result) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(result.blob);
        setImage({ ...result, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled)
          setError("The image could not be created. Please try again.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [articles, attempt]);

  async function copyImage() {
    if (!image) {
      setOpen(true);
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await copyRankingImage(image);
      setMessage("Image copied.");
    } catch {
      setMessage(
        "Copying isn’t available in this browser. Save or share the image instead.",
      );
      setOpen(true);
    } finally {
      setWorking(false);
    }
  }

  async function shareImage() {
    setWorking(true);
    setMessage("");
    try {
      await navigator.share(imageShareData(image.file));
    } catch (failure) {
      if (failure.name !== "AbortError")
        setMessage(
          "Sharing isn’t available right now. Copy or save the image instead.",
        );
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="completion-actions">
        <button
          className="standard-button primary"
          disabled={working || (!image && !error)}
          onClick={copyImage}
        >
          {working
            ? "Copying…"
            : !image && !error
              ? "Preparing image…"
              : "Share results"}
        </button>
        <button className="standard-button" onClick={onNewRound}>
          New round
        </button>
        <button className="text-button" onClick={() => setOpen(true)}>
          Image options
        </button>
        {!open && (
          <p className="share-status" role="status">
            {message}
          </p>
        )}
      </div>
      {open && (
        <Dialog
          title="Share results"
          onClose={() => setOpen(false)}
          className="share-modal"
        >
          {error ? (
            <div>
              <p role="alert">{error}</p>
              <button
                className="standard-button"
                onClick={() => setAttempt(attempt + 1)}
              >
                Try again
              </button>
            </div>
          ) : !image ? (
            <p role="status">Creating image…</p>
          ) : (
            <div className="share-ranking">
              <img
                className="share-preview"
                src={image.url}
                alt={rankingAltText(articles)}
                width={SHARE_WIDTH}
                height={SHARE_HEIGHT}
              />
              <div className="share-actions">
                <button
                  className="standard-button primary"
                  disabled={working}
                  onClick={copyImage}
                >
                  Copy image
                </button>
                <a
                  className="standard-button"
                  href={image.url}
                  download={SHARE_FILENAME}
                >
                  Save image
                </a>
                {canShareImage(image.file) && (
                  <button
                    className="text-button"
                    disabled={working}
                    onClick={shareImage}
                  >
                    Share image…
                  </button>
                )}
              </div>
              {image.missingImages > 0 && (
                <p className="fine-print">
                  Some thumbnails were unavailable. All ten titles are included.
                </p>
              )}
              <p className="share-message" role="status">
                {message}
              </p>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
