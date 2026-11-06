import "./app-info.js";
import { CATEGORIES, drawWord, wordsFor } from "./words.js";
import {
  ACTIVE_PHASES,
  MAX_NAME_LENGTH,
  TIMER_OPTIONS,
  createRound,
  createTimer,
  getMaxImposters,
  pauseTimer,
  playerNames,
  restoreSession,
  roundResult,
  secondsLeft,
  startTimer
} from "./game.js";
import { safeStorage } from "./storage.js";
import { createAppShell } from "./app-shell.js";

const $ = (id) => document.getElementById(id);
const { name: APP_NAME, version: APP_VERSION } = globalThis.IMPOSTOR_INFO;
const local = safeStorage(() => window.localStorage);
const session = safeStorage(() => window.sessionStorage);
const SESSION_KEY = "imposter_session";
const validNumber = (value, fallback, max = 1_000_000) =>
  Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
let savedPlayers = [];
try {
  const saved = local.read("imposter_players", []);
  if (Array.isArray(saved) && saved.every((name) => typeof name === "string" && name.trim()))
    savedPlayers = playerNames(saved);
} catch {
  /* Ignore invalid data from an older or interrupted session. */
}
let draftNames = [...savedPlayers];
let defaultDuration = local.read("imposter_timer", 120);
if (!TIMER_OPTIONS.includes(defaultDuration)) defaultDuration = 120;
let round = null;
let timer = createTimer(defaultDuration);
let timerInterval;
let wakeLock = null;
let wakeLockPending = false;
let hasSeenSecret = false;
let secretVisible = false;
let revealMode = null;
let activePointer = null;
let secretTimeout;
let toastTimeout;

const isRoundActive = () => Boolean(round && ACTIVE_PHASES.includes(round.phase));
const shell = createAppShell({ local, isRoundActive, toast });

function toast(message) {
  clearTimeout(toastTimeout);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimeout = setTimeout(() => {
    $("toast").hidden = true;
  }, 3500);
}

function haptic(pattern = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* Optional device feedback. */
  }
}

async function syncWakeLock() {
  if (!isRoundActive() || document.visibilityState !== "visible") {
    const lock = wakeLock;
    wakeLock = null;
    try {
      await lock?.release();
    } catch {
      /* The browser may already have released it. */
    }
    return;
  }
  if (!navigator.wakeLock || wakeLock || wakeLockPending) return;
  wakeLockPending = true;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (isRoundActive() && document.visibilityState === "visible") {
      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      });
    } else await lock.release();
  } catch {
    /* Playing remains possible without a wake lock. */
  } finally {
    wakeLockPending = false;
  }
}

function saveSession() {
  if (round) session.write(SESSION_KEY, { schema: 1, round, timer });
  else session.remove(SESSION_KEY);
}

function showScreen(id, focus = true) {
  hideSecret();
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== id;
  });
  fitVisibleWords();
  window.scrollTo({ top: 0, behavior: "auto" });
  if (focus) $(id).querySelector("h1, h2")?.focus({ preventScroll: true });
  shell.stateChanged();
  syncWakeLock();
}

function updateSetup() {
  const count = Number($("playerCount").value);
  const max = getMaxImposters(count);
  $("imposterCount").max = String(max);
  if (Number($("imposterCount").value) > max) $("imposterCount").value = String(max);
  $("imposterHelp").textContent =
    max === 1
      ? "Med 3–6 spillere brukes én impostor."
      : `Med ${count} spillere kan dere bruke opptil ${max} impostorer.`;
  $("wordCount").textContent =
    `${wordsFor($("categorySelect").value).length} ord. Ingen gjentakelser før kategorien er brukt opp.`;
  const canQuickStart = savedPlayers.length === count && count >= 3;
  $("quickStartBtn").hidden = !canQuickStart;
  $("goToNamesBtn").textContent = canQuickStart ? "Endre spillere" : "Skriv inn navn";
  $("goToNamesBtn").classList.toggle("secondary", canQuickStart);
  const next = validNumber(local.read("imposter_round", 0), 0) + 1;
  $("roundBadge").textContent = next > 1 ? `Runde ${next}` : "Ny runde";
}

function goToNames() {
  const count = Number($("playerCount").value);
  const imposters = Number($("imposterCount").value);
  if (!Number.isInteger(count) || count < 3 || count > 15)
    return toast("Velg mellom 3 og 15 spillere.");
  if (!Number.isInteger(imposters) || imposters < 1 || imposters > getMaxImposters(count))
    return toast("Velg gyldig antall impostorer.");
  $("nameInputs").replaceChildren();
  for (let i = 0; i < count; i++) {
    const field = document.createElement("div");
    field.className = "name-field";
    const label = document.createElement("label");
    label.htmlFor = `player-${i}`;
    label.textContent = `Spiller ${i + 1}`;
    const input = document.createElement("input");
    input.id = label.htmlFor;
    input.name = `player-${i}`;
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = MAX_NAME_LENGTH;
    input.enterKeyHint = i === count - 1 ? "done" : "next";
    input.value = draftNames[i] || "";
    input.addEventListener("input", () => {
      draftNames[i] = input.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && i < count - 1) {
        event.preventDefault();
        $(`player-${i + 1}`).focus();
      }
    });
    field.append(label, input);
    $("nameInputs").append(field);
  }
  showScreen("names");
}

function startNewRound(players) {
  try {
    const category = $("categorySelect").value;
    const history = local.read("imposter_words", {});
    const used = history && typeof history === "object" && !Array.isArray(history) ? history : {};
    const drawn = drawWord(category, used[category]);
    const nextRound = createRound({
      players,
      category,
      word: drawn.word,
      imposterCount: Number($("imposterCount").value),
      number: validNumber(local.read("imposter_round", 0), 0) + 1
    });
    round = nextRound;
    savedPlayers = [...round.players];
    draftNames = [...round.players];
    timer = createTimer(defaultDuration);
    local.write("imposter_players", savedPlayers);
    local.write("imposter_category", category);
    local.write("imposter_imposter_count", round.imposterCount);
    local.write("imposter_round", round.number);
    local.write("imposter_words", { ...used, [category]: drawn.used });
    clearInterval(timerInterval);
    prepareHandoff();
    haptic();
  } catch (error) {
    toast(error.message);
  }
}

function prepareHandoff() {
  hasSeenSecret = false;
  round.phase = "handoff";
  $("handoffName").textContent = round.players[round.currentIndex];
  $("confirmPlayerBtn").textContent = `Jeg er ${round.players[round.currentIndex]}`;
  $("progressBadge").textContent = `${round.currentIndex + 1} / ${round.players.length}`;
  $("revealProgress").textContent = $("progressBadge").textContent;
  saveSession();
  showScreen("handoff");
}

function confirmPlayer() {
  if (round?.phase !== "handoff") return;
  round.phase = "reveal";
  hasSeenSecret = false;
  $("nextPlayerBtn").textContent =
    round.currentIndex === round.players.length - 1 ? "Start runden" : "Neste spiller";
  saveSession();
  showScreen("reveal");
}

function secretText(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function fitVisibleWords() {
  document.querySelectorAll(".screen:not([hidden]) .secret-word").forEach((element) => {
    element.style.fontSize = "";
    element.style.whiteSpace = "nowrap";
    const fontSize = parseFloat(getComputedStyle(element).fontSize);
    const parent = element.parentElement;
    const style = getComputedStyle(parent);
    const available =
      parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const minimum = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.25;
    if (element.scrollWidth > available)
      element.style.fontSize = `${Math.max(minimum, ((fontSize * available) / element.scrollWidth) * 0.98)}px`;
    // Keep wrapping as a fallback for enlarged accessibility fonts and very small viewports.
    element.style.whiteSpace = "normal";
  });
}

function showSecret(mode) {
  if (round?.phase !== "reveal" || secretVisible) return;
  secretVisible = true;
  revealMode = mode;
  hasSeenSecret = true;
  const isImposter = round.imposterIndexes.includes(round.currentIndex);
  const category = secretText("p", "Kategori: ");
  category.append(secretText("strong", round.category));
  // Both roles share identical styling and card dimensions. Names are always text.
  $("secretBox").replaceChildren(
    secretText("p", `${round.players[round.currentIndex]}, ${isImposter ? "du er" : "ordet er"}`),
    secretText("div", isImposter ? "Impostor" : round.word, "secret-word"),
    category
  );
  fitVisibleWords();
  $("holdRevealBtn").classList.toggle("is-holding", mode === "hold");
  $("toggleRevealBtn").setAttribute("aria-pressed", String(mode === "timed"));
  $("toggleRevealBtn").textContent = "Skjul nå";
  $("nextPlayerBtn").hidden = true;
  if (mode === "timed") secretTimeout = setTimeout(hideSecret, 8000);
  haptic();
}

function hideSecret() {
  clearTimeout(secretTimeout);
  secretVisible = false;
  revealMode = null;
  const pointer = activePointer;
  activePointer = null;
  $("holdRevealBtn").classList.remove("is-holding");
  $("holdRevealBtn").textContent = hasSeenSecret
    ? "Hold for å se igjen"
    : "Hold for å se hemmeligheten";
  $("toggleRevealBtn").setAttribute("aria-pressed", "false");
  $("toggleRevealBtn").textContent = "Vis i 8 sekunder";
  $("nextPlayerBtn").hidden = !hasSeenSecret;
  $("secretBox").replaceChildren(
    secretText(
      "p",
      hasSeenSecret
        ? "Hemmeligheten er skjult. Se igjen eller gå videre."
        : "Hold knappen nede for å se hemmeligheten."
    )
  );
  if (pointer !== null && $("holdRevealBtn").hasPointerCapture?.(pointer))
    $("holdRevealBtn").releasePointerCapture(pointer);
}

function nextPlayer() {
  if (round?.phase !== "reveal" || !hasSeenSecret || secretVisible) return;
  if (round.currentIndex === round.players.length - 1) {
    round.phase = "play";
    renderDiscussion();
    saveSession();
    showScreen("play");
  } else {
    round.currentIndex++;
    prepareHandoff();
  }
}

function renderDiscussion() {
  $("starterName").textContent = round.players[round.starterIndex];
  $("categoryBadge").textContent = round.category;
  $("playRound").textContent = `Runde ${round.number}`;
  $("timerSelect").value = String(timer.duration);
  renderTimer();
}

function renderTimer() {
  const seconds = secondsLeft(timer);
  $("timerDisplay").textContent = timer.duration
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : "—";
  $("timerStartBtn").disabled = timer.duration === 0;
  $("timerResetBtn").disabled = timer.duration === 0;
  $("timerStartBtn").textContent =
    timer.deadline !== null
      ? "Pause"
      : seconds === 0 && timer.duration
        ? "Start på nytt"
        : timer.remainingMs < timer.duration * 1000
          ? "Fortsett"
          : "Start";
}

function tick() {
  if (timer.deadline !== null && secondsLeft(timer) === 0) {
    timer = { ...pauseTimer(timer), notified: true };
    clearInterval(timerInterval);
    saveSession();
    if (round?.phase === "play") {
      toast("Tiden er ute. Gå til avstemning når alle er klare.");
      haptic([30, 50, 30]);
    }
  }
  renderTimer();
}

function toggleTimer() {
  if (round?.phase !== "play" || !timer.duration) return;
  if (timer.deadline !== null) {
    timer = pauseTimer(timer);
    clearInterval(timerInterval);
  } else {
    if (!secondsLeft(timer)) timer = createTimer(timer.duration);
    timer = startTimer(timer);
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 250);
  }
  saveSession();
  renderTimer();
}

function setTimer(duration) {
  if (!TIMER_OPTIONS.includes(duration)) return;
  clearInterval(timerInterval);
  timer = createTimer(duration);
  defaultDuration = duration;
  local.write("imposter_timer", duration);
  saveSession();
  renderTimer();
}

function renderVote() {
  $("voteInstructions").textContent =
    `Stem samtidig på ${round.imposterCount === 1 ? "én spiller" : `${round.imposterCount} spillere`}. Spillerne vinner hvis alle impostorene blir funnet.`;
  $("votePlayers").replaceChildren();
  round.players.forEach((name, index) => {
    const label = document.createElement("label");
    label.className = "vote-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(index);
    checkbox.checked = round.suspects.includes(index);
    checkbox.addEventListener("change", () => {
      round.suspects = [...$("votePlayers").querySelectorAll("input:checked")].map((input) =>
        Number(input.value)
      );
      updateVote();
      saveSession();
    });
    label.append(checkbox, secretText("span", name));
    $("votePlayers").append(label);
  });
  updateVote();
}

function updateVote() {
  const count = round.suspects.length;
  $("voteProgress").textContent = `${count} av ${round.imposterCount} valgt`;
  $("showResultBtn").disabled = count !== round.imposterCount;
  $("votePlayers")
    .querySelectorAll("input")
    .forEach((input) => {
      input.disabled = !input.checked && count >= round.imposterCount;
    });
}

function goToVote() {
  if (round?.phase !== "play") return;
  timer = pauseTimer(timer);
  clearInterval(timerInterval);
  round.phase = "vote";
  renderVote();
  saveSession();
  showScreen("vote");
}

function renderResult() {
  const result = roundResult(round);
  $("resultTitle").textContent = result.playersWin
    ? "Spillerne vant!"
    : round.imposterCount === 1
      ? "Impostoren vant!"
      : "Impostorene vant!";
  $("resultExplanation").textContent = result.playersWin
    ? "Dere fant alle som bløffet."
    : "Minst én impostor slapp unna.";
  $("resultWord").textContent = round.word;
  $("resultImposter").textContent = result.imposters.join(", ");
  $("resultRoleLabel").textContent =
    round.imposterCount === 1 ? "Impostoren var" : "Impostorene var";
  $("resultSuspects").textContent = `Dere valgte: ${result.suspects.join(", ")}`;
  $("resultCategory").textContent = round.category;
  $("resultRound").textContent = `Runde ${round.number}`;
}

function showResult() {
  if (round?.phase !== "vote") return;
  try {
    roundResult(round);
  } catch (error) {
    return toast(error.message);
  }
  round.phase = "result";
  local.write(
    "imposter_completed_rounds",
    validNumber(local.read("imposter_completed_rounds", 0), 0) + 1
  );
  renderResult();
  saveSession();
  showScreen("result");
}

function editSetup() {
  if (isRoundActive()) return;
  round = null;
  saveSession();
  updateSetup();
  showScreen("setup");
}

function openDialog(id) {
  hideSecret();
  if (id === "settingsDialog") {
    $("themeSelect").value = shell.getTheme();
    $("defaultTimerSelect").value = String(defaultDuration);
    $("storageStatus").textContent = local.available
      ? "Navn og innstillinger lagres bare på denne enheten."
      : "Enheten tillater ikke lagring. Dere kan fortsatt spille, men innstillingene kan forsvinne når appen lukkes.";
    $("forgetPlayersBtn").disabled = !savedPlayers.length;
  }
  $(id).showModal();
}

function bindEvents() {
  $("playerCount").addEventListener("input", updateSetup);
  $("categorySelect").addEventListener("change", updateSetup);
  $("goToNamesBtn").addEventListener("click", goToNames);
  $("backToSetupBtn").addEventListener("click", () => showScreen("setup"));
  $("quickStartBtn").addEventListener("click", () =>
    startNewRound(draftNames.slice(0, savedPlayers.length))
  );
  $("namesForm").addEventListener("submit", (event) => {
    event.preventDefault();
    startNewRound([...$("nameInputs").querySelectorAll("input")].map((input) => input.value));
  });
  $("confirmPlayerBtn").addEventListener("click", confirmPlayer);
  $("nextPlayerBtn").addEventListener("click", nextPlayer);
  $("goToVoteBtn").addEventListener("click", goToVote);
  $("showResultBtn").addEventListener("click", showResult);
  $("backToPlayBtn").addEventListener("click", () => {
    if (round?.phase !== "vote") return;
    round.phase = "play";
    renderDiscussion();
    saveSession();
    showScreen("play");
  });
  $("samePlayersBtn").addEventListener("click", () => {
    if (round?.phase === "result") startNewRound(round.players);
  });
  $("editSetupBtn").addEventListener("click", editSetup);
  $("timerSelect").addEventListener("change", () => setTimer(Number($("timerSelect").value)));
  $("timerStartBtn").addEventListener("click", toggleTimer);
  $("timerResetBtn").addEventListener("click", () => setTimer(timer.duration));

  const hold = $("holdRevealBtn");
  hold.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || secretVisible || round?.phase !== "reveal")
      return;
    event.preventDefault();
    hold.focus({ preventScroll: true });
    showSecret("hold");
    activePointer = event.pointerId;
    hold.setPointerCapture?.(event.pointerId);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
    hold.addEventListener(type, () => {
      if (revealMode === "hold") hideSecret();
    })
  );
  hold.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) showSecret("hold");
    }
  });
  hold.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (revealMode === "hold") hideSecret();
    }
  });
  hold.addEventListener("focusout", () => {
    if (revealMode === "hold") hideSecret();
  });
  hold.addEventListener("contextmenu", (event) => event.preventDefault());
  $("toggleRevealBtn").addEventListener("click", () => {
    if (secretVisible) hideSecret();
    else showSecret("timed");
  });
  window.addEventListener("blur", hideSecret);
  window.addEventListener("resize", fitVisibleWords);
  window.addEventListener("pagehide", () => {
    hideSecret();
    saveSession();
  });
  document.addEventListener("visibilitychange", () => {
    hideSecret();
    if (round?.phase === "play") tick();
    syncWakeLock();
  });

  document
    .querySelectorAll("[data-rules]")
    .forEach((button) => button.addEventListener("click", () => openDialog("rulesDialog")));
  document.querySelectorAll("[data-settings]").forEach((button) =>
    button.addEventListener("click", () => {
      if (!isRoundActive()) openDialog("settingsDialog");
    })
  );
  document
    .querySelectorAll("[data-close-dialog]")
    .forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document
    .querySelectorAll("dialog")
    .forEach((dialog) => dialog.addEventListener("close", () => shell.stateChanged()));
  $("themeSelect").addEventListener("change", () => shell.setTheme($("themeSelect").value));
  $("defaultTimerSelect").addEventListener("change", () => {
    defaultDuration = Number($("defaultTimerSelect").value);
    local.write("imposter_timer", defaultDuration);
  });
  $("forgetPlayersBtn").addEventListener("click", () => {
    if (isRoundActive()) return;
    local.remove("imposter_players");
    savedPlayers = [];
    draftNames = [];
    round = null;
    $("playerCount").value = "4";
    $("imposterCount").value = "1";
    saveSession();
    updateSetup();
    $("settingsDialog").close();
    showScreen("setup");
    toast("Lagrede navn er slettet.");
  });
  $("installBtn").addEventListener("click", () => {
    $("settingsDialog").close();
    shell.install();
  });
  $("checkUpdatesBtn").addEventListener("click", () => {
    $("settingsDialog").close();
    shell.checkForUpdates();
  });
  $("endRoundBtn").addEventListener("click", () => openDialog("endRoundDialog"));
  $("confirmEndRoundBtn").addEventListener("click", () => {
    clearInterval(timerInterval);
    round = null;
    saveSession();
    $("endRoundDialog").close();
    updateSetup();
    showScreen("setup");
  });
}

function init() {
  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    $("categorySelect").append(option);
  });
  const category = local.read("imposter_category", "Blandet");
  $("categorySelect").value = CATEGORIES.includes(category) ? category : "Blandet";
  $("playerCount").value = String(savedPlayers.length || 4);
  $("imposterCount").value = String(
    validNumber(local.read("imposter_imposter_count", 1), 1, 3) || 1
  );
  $("appVersion").textContent = `${APP_NAME} · Versjon ${APP_VERSION}`;
  updateSetup();
  bindEvents();
  const restored = restoreSession(session.read(SESSION_KEY));
  if (!restored) {
    session.remove(SESSION_KEY);
    showScreen("setup", false);
  } else {
    ({ round, timer } = restored);
    // The tab's round is authoritative even if device-wide preferences were cleared or changed in another tab.
    savedPlayers = [...round.players];
    draftNames = [...round.players];
    $("playerCount").value = String(round.players.length);
    $("imposterCount").value = String(round.imposterCount);
    $("categorySelect").value = round.category;
    if (!local.available) defaultDuration = timer.duration;
    updateSetup();
    if (["handoff", "reveal"].includes(round.phase)) prepareHandoff();
    else {
      if (round.phase === "play") {
        renderDiscussion();
        if (timer.deadline !== null) {
          tick();
          if (timer.deadline !== null) timerInterval = setInterval(tick, 250);
        }
      } else if (round.phase === "vote") renderVote();
      else renderResult();
      showScreen(round.phase, false);
    }
  }
  shell.start();
}

init();
