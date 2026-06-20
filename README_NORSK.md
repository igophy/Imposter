# PWA drop-in pakke

Denne pakken inneholder et enkelt, produksjonsnært PWA-oppsett du kan legge inn i en eksisterende statisk webapp.

## Filer

- `manifest.webmanifest` – PWA-manifest
- `sw.js` – service worker med versjonerte cacher, sletting av gamle cacher, `skipWaiting` og `clients.claim`
- `pwa-app-shell.js` – installasjonsveiledning, iOS-veiledning, oppdateringsvarsel og tema-lagring
- `pwa.css` – styling for meldingsbokser og enkel mørkemodus
- `icons/` – grunnikoner for PWA og iPhone
- `index-head-snippet.html` – kode som skal inn i `<head>`
- `index-body-snippet.html` – kode som skal inn rett før `</body>`
- `settings-snippet.html` – valgfritt eksempel for Innstillinger-side/flis

## Slik bruker du pakken

### 1. Kopier filer

Legg disse filene samme sted som `index.html`, eller i `public/` hvis appen bygges med Vite/React:

```text
manifest.webmanifest
sw.js
pwa-app-shell.js
pwa.css
icons/
```

Hvis du bruker Vite, er det vanligvis riktig å legge dem i:

```text
public/
```

slik at de havner i roten av ferdig build.

### 2. Legg inn head-kode

Kopier innholdet fra:

```text
index-head-snippet.html
```

og lim det inn i `<head>` i `index.html`.

### 3. Legg inn body-kode

Kopier innholdet fra:

```text
index-body-snippet.html
```

og lim det inn rett før `</body>` i `index.html`.

### 4. Tilpass appnavn

Bytt `App` til riktig appnavn i:

- `manifest.webmanifest`
- `index-head-snippet.html`

### 5. Ved ny deploy / ny versjon

Oppdater versjon på disse stedene:

- `CACHE_VERSION` i `sw.js`
- `APP_VERSION` i `pwa-app-shell.js`
- querystring i `index-head-snippet.html` og `index-body-snippet.html`, f.eks. `?v=2026.06.20-1`

Du kan bruke dato, f.eks.:

```text
2026.06.20-2
```

## Viktige merknader

- Service worker cacher bare trygge statiske filer.
- Den prøver nett først på navigasjon, slik at nye deploys normalt overstyrer gammel cache.
- Den forsøker å ikke cache `/api/`, `/admin/`, `/feedback` eller `/tilbakemelding`.
- iPhone får egen installasjonsveiledning fordi iOS ikke bruker vanlig `beforeinstallprompt`.
- Tema lagres i `localStorage` som `app_theme` med verdiene `light`, `dark` eller `auto`.

## Test etterpå

Sjekk dette etter deploy:

1. Appen åpner som før.
2. Ingen console-feil.
3. `manifest.webmanifest` kan åpnes i nettleseren.
4. `sw.js` kan åpnes i nettleseren.
5. Service worker registreres i DevTools/Application.
6. iPhone viser apple-touch-icon når appen legges til på Hjem-skjerm.
7. Ny versjon gir oppdateringsmelding etter deploy.
