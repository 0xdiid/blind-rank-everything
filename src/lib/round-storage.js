import { createRound, isValidRound, roundMode, ROUND_MODES } from "./game.js";
import { readStorage, writeStorage } from "./storage.js";

export const SEEN_KEY = "blindrank:seen:v1";
const MODE_KEY = "blindrank:mode:v1";
const ROUND_KEYS = {
  standard: "blindrank:round:v2",
  expert: "blindrank:round:expert:v1",
};

export function savedMode() {
  const mode = readStorage(MODE_KEY);
  return typeof mode === "string" && Object.hasOwn(ROUND_MODES, mode)
    ? mode
    : "standard";
}

export function loadRound(catalog, mode, { fresh = false } = {}) {
  if (typeof mode !== "string" || !Object.hasOwn(ROUND_MODES, mode))
    throw new Error("Unknown game mode.");
  const saved = readStorage(ROUND_KEYS[mode]);
  if (!fresh && isValidRound(saved) && roundMode(saved) === mode) return saved;
  const seen = readStorage(SEEN_KEY, []);
  return createRound(
    catalog,
    Array.isArray(seen) ? seen : [],
    Math.random,
    mode,
  );
}

export function saveRound(round) {
  writeStorage(ROUND_KEYS[roundMode(round)], round);
  writeStorage(MODE_KEY, roundMode(round));
}
