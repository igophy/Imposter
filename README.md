# Imposter-spill (Astro)

Dette prosjektet er en Astro-versjon av Imposter-spillet.

## Kjør lokalt

```bash
npm install
npm run dev
```

## Bygg

```bash
npm run build
npm run preview
```

## Deploy til GitHub Pages

1. Gå til **Settings → Pages** i repoet.
2. Under **Build and deployment**, velg **Source: GitHub Actions**.
3. Push til `main`.
4. Workflowen i `.github/workflows/deploy.yml` bygger og publiserer `dist/` automatisk.

`astro.config.mjs` er satt opp med:
- `site: https://igophy.github.io`
- `output: static`

Hvis du deployer til et annet domene/repo, oppdater `site` der.

## Hvis du bruker Pages fra branch (uten Actions)

Repoet inneholder også en rot-`index.html` som fallback, slik at GitHub Pages ikke viser README som forside.
