import { CATEGORIES, wordsFor } from "./words.js";

export const MAX_NAME_LENGTH = 40;
export const TIMER_OPTIONS = [0, 60, 120, 180, 300];
export const ACTIVE_PHASES = ["handoff", "reveal", "play", "vote"];

export function getMaxImposters(count) {
  return count >= 10 ? 3 : count >= 7 ? 2 : 1;
}

export function playerNames(values) {
  if (!Array.isArray(values) || values.length < 3 || values.length > 15) {
    throw new Error("Velg mellom 3 og 15 spillere.");
  }
  const names = values.map((value, index) => {
    const name =
      String(value ?? "")
        .trim()
        .replace(/\s+/gu, " ") || `Spiller ${index + 1}`;
    if (name.length > MAX_NAME_LENGTH)
      throw new Error(`Navn kan ha maksimalt ${MAX_NAME_LENGTH} tegn.`);
    return name;
  });
  const unique = new Set(names.map((name) => name.normalize("NFKC").toLocaleLowerCase("nb-NO")));
  if (unique.size !== names.length) throw new Error("Bruk ulike navn på spillerne.");
  return names;
}

export function createRound(
  { players, imposterCount, category, word, number = 1 },
  random = Math.random
) {
  const names = playerNames(players);
  if (
    !Number.isInteger(imposterCount) ||
    imposterCount < 1 ||
    imposterCount > getMaxImposters(names.length)
  ) {
    throw new Error(`Velg mellom 1 og ${getMaxImposters(names.length)} impostorer.`);
  }
  if (!CATEGORIES.includes(category) || !wordsFor(category).includes(word)) {
    throw new Error("Velg en gyldig kategori og et ord fra kategorien.");
  }
  const indexes = names.map((_, index) => index);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return {
    players: names,
    imposterCount,
    category,
    word,
    number,
    imposterIndexes: indexes.slice(0, imposterCount),
    starterIndex: Math.min(names.length - 1, Math.floor(random() * names.length)),
    currentIndex: 0,
    phase: "handoff",
    suspects: []
  };
}

export function roundResult(round, suspects = round.suspects) {
  if (
    !Array.isArray(suspects) ||
    suspects.length !== round.imposterCount ||
    new Set(suspects).size !== suspects.length ||
    suspects.some((index) => !Number.isInteger(index) || index < 0 || index >= round.players.length)
  ) {
    throw new Error(
      `Velg nøyaktig ${round.imposterCount} ${round.imposterCount === 1 ? "mistenkt" : "mistenkte"}.`
    );
  }
  return {
    playersWin: round.imposterIndexes.every((index) => suspects.includes(index)),
    imposters: round.imposterIndexes.map((index) => round.players[index]),
    suspects: suspects.map((index) => round.players[index])
  };
}

export function createTimer(duration) {
  return { duration, remainingMs: duration * 1000, deadline: null, notified: false };
}

export function secondsLeft(timer, now = Date.now()) {
  return Math.ceil(
    Math.max(0, timer.deadline === null ? timer.remainingMs : timer.deadline - now) / 1000
  );
}

export function startTimer(timer, now = Date.now()) {
  return { ...timer, deadline: now + timer.remainingMs, notified: false };
}

export function pauseTimer(timer, now = Date.now()) {
  return {
    ...timer,
    remainingMs: Math.max(0, timer.deadline === null ? timer.remainingMs : timer.deadline - now),
    deadline: null
  };
}

export function restoreSession(value) {
  try {
    if (!value || value.schema !== 1 || !value.round) return null;
    const saved = value.round;
    const round = createRound({ ...saved, players: saved.players }, () => 0);
    const validIndex = (index) =>
      Number.isInteger(index) && index >= 0 && index < round.players.length;
    if (
      !Number.isInteger(saved.number) ||
      saved.number < 1 ||
      saved.number > 1_000_000 ||
      !Array.isArray(saved.imposterIndexes) ||
      saved.imposterIndexes.length !== round.imposterCount ||
      new Set(saved.imposterIndexes).size !== round.imposterCount ||
      !saved.imposterIndexes.every(validIndex) ||
      !validIndex(saved.starterIndex) ||
      !validIndex(saved.currentIndex) ||
      ![...ACTIVE_PHASES, "result"].includes(saved.phase)
    )
      return null;
    round.imposterIndexes = [...saved.imposterIndexes];
    round.starterIndex = saved.starterIndex;
    round.currentIndex = saved.currentIndex;
    // Never reopen a secret after a refresh, even if it was visible before it.
    round.phase = saved.phase === "reveal" ? "handoff" : saved.phase;
    round.suspects = Array.isArray(saved.suspects)
      ? [...new Set(saved.suspects.filter(validIndex))].slice(0, round.imposterCount)
      : [];
    if (round.phase === "result") roundResult(round);
    const timer = value.timer;
    if (
      !timer ||
      !TIMER_OPTIONS.includes(timer.duration) ||
      !Number.isFinite(timer.remainingMs) ||
      timer.remainingMs < 0 ||
      timer.remainingMs > timer.duration * 1000 ||
      !(timer.deadline === null || (Number.isFinite(timer.deadline) && timer.deadline >= 0))
    )
      return null;
    return { round, timer: { ...timer, notified: timer.notified === true } };
  } catch {
    return null;
  }
}
