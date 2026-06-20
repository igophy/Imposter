/* pwa-app-shell.js
 * Appskall for installasjon, iOS-veiledning, oppdateringsvarsel og tema.
 */

(() => {
  const APP_VERSION = "2026.06.21-3";
  const SW_PATH = "./sw.js";

  const STORAGE_KEYS = {
    installDismissed: "app_install_prompt_dismissed",
    updateDismissed: "app_update_prompt_dismissed_version",
    theme: "app_theme",
    completedRounds: "imposter_completed_rounds"
  };

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createAppMessage({ id, title, text, primaryText, secondaryText, onPrimary, onSecondary }) {
    if (document.getElementById(id)) return;

    const box = document.createElement("div");
    box.id = id;
    box.className = "pwa-message";
    box.setAttribute("role", "status");
    box.innerHTML = `
      <div class="pwa-message__title">${escapeHtml(title)}</div>
      <div class="pwa-message__text">${escapeHtml(text)}</div>
      <div class="pwa-message__actions">
        ${secondaryText ? `<button type="button" class="pwa-button pwa-button--ghost" data-secondary>${escapeHtml(secondaryText)}</button>` : ""}
        ${primaryText ? `<button type="button" class="pwa-button pwa-button--primary" data-primary>${escapeHtml(primaryText)}</button>` : ""}
      </div>
    `;

    document.body.appendChild(box);

    box.querySelector("[data-primary]")?.addEventListener("click", () => {
      if (onPrimary) onPrimary();
      box.remove();
    });

    box.querySelector("[data-secondary]")?.addEventListener("click", () => {
      if (onSecondary) onSecondary();
      box.remove();
    });
  }

  function getThemeSetting() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    return ["light", "dark", "auto"].includes(saved) ? saved : "auto";
  }

  function applyTheme() {
    const savedTheme = getThemeSetting();
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const activeTheme = savedTheme === "auto" ? prefersDark ? "dark" : "light" : savedTheme;

    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.dataset.themeSetting = savedTheme;
  }

  function setTheme(theme) {
    if (!["light", "dark", "auto"].includes(theme)) return;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    applyTheme();
    window.dispatchEvent(new CustomEvent("app-theme-change", { detail: { theme } }));
  }

  applyTheme();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeSetting() === "auto") applyTheme();
  });

  window.AppShell = window.AppShell || {};
  window.AppShell.version = APP_VERSION;
  window.AppShell.getTheme = getThemeSetting;
  window.AppShell.setTheme = setTheme;
  window.AppShell.showMessage = createAppMessage;

  let deferredInstallPrompt = null;

  function hasPlayedRound() {
    return Number(localStorage.getItem(STORAGE_KEYS.completedRounds) || "0") >= 1;
  }

  function canShowInstallPrompt() {
    if (isStandalone) return false;
    if (localStorage.getItem(STORAGE_KEYS.installDismissed) === "true") return false;
    return hasPlayedRound();
  }

  function showInstallPrompt() {
    if (!canShowInstallPrompt()) return;

    if (deferredInstallPrompt) {
      createAppMessage({
        id: "app-install-message",
        title: "Spille igjen senere?",
        text: "Legg Imposter til på hjemskjermen for raskere tilgang neste gang.",
        primaryText: "Installer",
        secondaryText: "Ikke nå",
        onPrimary: async () => {
          if (!deferredInstallPrompt) return;
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
        },
        onSecondary: () => {
          localStorage.setItem(STORAGE_KEYS.installDismissed, "true");
        }
      });
      return;
    }

    if (isIOS && isSafari) {
      createAppMessage({
        id: "ios-install-message",
        title: "Spille igjen senere?",
        text: "På iPhone kan du trykke Del-knappen og velge «Legg til på Hjem-skjerm».",
        primaryText: "OK",
        secondaryText: "Ikke vis igjen",
        onSecondary: () => {
          localStorage.setItem(STORAGE_KEYS.installDismissed, "true");
        }
      });
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener("imposter:round-completed", () => {
    setTimeout(showInstallPrompt, 1200);
  });

  window.addEventListener("load", () => {
    setTimeout(showInstallPrompt, 900);
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH, {
          updateViaCache: "none"
        });

        registration.update();

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller &&
              localStorage.getItem(STORAGE_KEYS.updateDismissed) !== APP_VERSION
            ) {
              createAppMessage({
                id: "app-update-message",
                title: "Ny versjon tilgjengelig",
                text: "En oppdatert versjon av appen er klar.",
                primaryText: "Oppdater",
                secondaryText: "Senere",
                onPrimary: () => {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                },
                onSecondary: () => {
                  localStorage.setItem(STORAGE_KEYS.updateDismissed, APP_VERSION);
                }
              });
            }
          });
        });

        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });

        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      } catch (error) {
        console.warn("Service worker kunne ikke registreres:", error);
      }
    });
  }
})();
