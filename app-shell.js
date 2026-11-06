export function createAppShell({ local, isRoundActive, toast }) {
  const $ = (id) => document.getElementById(id);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let registration;
  let waitingWorker;
  let activatedElsewhere = false;
  let hadController = Boolean(navigator.serviceWorker?.controller);
  let applyingUpdate = false;
  let updateDismissed = false;
  let installPrompt;
  let messageKind;

  function getTheme() {
    const value = local.read("app_theme", "auto");
    return ["auto", "light", "dark"].includes(value) ? value : "auto";
  }

  function applyTheme() {
    const theme = getTheme();
    const active = theme === "auto" ? (media.matches ? "dark" : "light") : theme;
    document.documentElement.dataset.theme = active;
    document.querySelector('meta[name="theme-color"]').content =
      active === "dark" ? "#141413" : "#faf9f5";
  }

  function setTheme(theme) {
    if (!["auto", "light", "dark"].includes(theme)) return;
    local.write("app_theme", theme);
    applyTheme();
  }

  function hideMessage() {
    $("appMessage").hidden = true;
    document.body.classList.remove("has-app-message");
    messageKind = null;
  }

  function showMessage({ kind, title, text, primary, secondary, onPrimary, onSecondary }) {
    if (isRoundActive() || document.querySelector("dialog[open]")) return;
    messageKind = kind;
    $("appMessageTitle").textContent = title;
    $("appMessageText").textContent = text;
    $("appMessagePrimary").textContent = primary;
    $("appMessageSecondary").textContent = secondary;
    $("appMessagePrimary").onclick = async () => {
      hideMessage();
      try {
        await onPrimary?.();
      } catch {
        toast("Handlingen kunne ikke fullføres. Prøv igjen fra Innstillinger.");
      }
    };
    $("appMessageSecondary").onclick = () => {
      hideMessage();
      onSecondary?.();
    };
    $("appMessage").hidden = false;
    document.body.classList.add("has-app-message");
  }

  function applyUpdate() {
    // Recheck at the moment of activation: a new round may have started meanwhile.
    if (isRoundActive()) return;
    const worker = registration?.waiting || waitingWorker;
    if (worker?.state === "installed") {
      applyingUpdate = true;
      worker.postMessage({ type: "SKIP_WAITING" });
    } else if (activatedElsewhere) window.location.reload();
    else toast("Oppdateringen er ikke klar ennå. Prøv igjen om litt.");
  }

  function showUpdate() {
    showMessage({
      kind: "update",
      title: "Ny versjon er klar",
      text: "En oppdatert versjon er klar. Last den inn når det passer.",
      primary: "Oppdater",
      secondary: "Senere",
      onPrimary: applyUpdate,
      onSecondary: () => {
        updateDismissed = true;
      }
    });
  }

  async function install() {
    if (standalone) return toast("Appen er allerede åpnet fra hjemskjermen.");
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      await prompt.userChoice;
    } else {
      showMessage({
        kind: "install-help",
        title: "Legg til på hjemskjermen",
        text: ios
          ? "På iPhone og iPad: Åpne i Safari, trykk Del og velg «Legg til på Hjem-skjerm»."
          : "Åpne nettleserens meny og velg «Installer app» eller «Legg til på hjemskjermen» hvis valget er tilgjengelig.",
        primary: "Skjønner",
        secondary: "Lukk"
      });
    }
  }

  function stateChanged() {
    if (isRoundActive()) return hideMessage();
    if (document.querySelector("dialog[open]")) return;
    if ((waitingWorker || activatedElsewhere) && !updateDismissed) return showUpdate();
    if (messageKind) return;
    if (
      !standalone &&
      !local.read("app_install_prompt_dismissed", false) &&
      Number(local.read("imposter_completed_rounds", 0)) >= 1 &&
      (installPrompt || ios)
    ) {
      showMessage({
        kind: "install",
        title: "Spille igjen senere?",
        text: "Legg Impostor på hjemskjermen for rask tilgang og spill uten nett etter første innlasting.",
        primary: "Legg til",
        secondary: "Ikke vis igjen",
        onPrimary: install,
        onSecondary: () => local.write("app_install_prompt_dismissed", true)
      });
    }
  }

  function watchWorker(worker) {
    if (!worker) return;
    const changed = () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        updateDismissed = false;
        stateChanged();
      }
    };
    worker.addEventListener("statechange", changed);
    changed();
  }

  async function register() {
    if (!("serviceWorker" in navigator)) return;
    try {
      registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      registration.addEventListener("updatefound", () => watchWorker(registration.installing));
      watchWorker(registration.installing);
      if (registration.waiting) {
        waitingWorker = registration.waiting;
        stateChanged();
      }
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (applyingUpdate) return window.location.reload();
        if (hadController) {
          activatedElsewhere = true;
          waitingWorker = null;
          updateDismissed = false;
          stateChanged();
        }
        hadController = true;
      });
      await registration.update();
      setInterval(
        () => {
          if (navigator.onLine) registration.update().catch(() => {});
        },
        60 * 60 * 1000
      );
    } catch (error) {
      console.warn("Offlineoppsettet kunne ikke klargjøres:", error);
    }
  }

  async function checkForUpdates() {
    updateDismissed = false;
    if (waitingWorker || activatedElsewhere) return stateChanged();
    if (!navigator.onLine) return toast("Koble til nett for å se etter oppdateringer.");
    if (!registration) await register();
    if (!registration)
      return toast("Oppdateringssjekken er ikke tilgjengelig i denne nettleseren.");
    try {
      await registration.update();
      stateChanged();
      toast("Oppdateringssjekken er sendt. En ny versjon vises når den er klar.");
    } catch {
      toast("Kunne ikke se etter oppdateringer. Prøv igjen senere.");
    }
  }

  function start() {
    $("installBtn").disabled = standalone;
    if (standalone) $("installBtn").textContent = "Allerede på hjemskjermen";
    register();
    stateChanged();
  }

  applyTheme();
  media.addEventListener("change", () => {
    if (getTheme() === "auto") applyTheme();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    stateChanged();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    hideMessage();
    $("installBtn").disabled = true;
    $("installBtn").textContent = "Installert";
  });
  return { start, stateChanged, getTheme, setTheme, install, checkForUpdates };
}
