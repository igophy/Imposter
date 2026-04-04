 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..5c61bd01661682949ed0b2b1902761b6de218fe3
--- /dev/null
+++ b/README.md
@@ -0,0 +1,30 @@
+# Imposter-spill (Astro)
+
+Dette prosjektet er en Astro-versjon av Imposter-spillet.
+
+## Kjør lokalt
+
+```bash
+npm install
+npm run dev
+```
+
+## Bygg
+
+```bash
+npm run build
+npm run preview
+```
+
+## Deploy til GitHub Pages
+
+1. Gå til **Settings → Pages** i repoet.
+2. Under **Build and deployment**, velg **Source: GitHub Actions**.
+3. Push til `main`.
+4. Workflowen i `.github/workflows/deploy.yml` bygger og publiserer `dist/` automatisk.
+
+`astro.config.mjs` er satt opp med:
+- `site: https://igophy.github.io`
+- `output: static`
+
+Hvis du deployer til et annet domene/repo, oppdater `site` der.
 
EOF
)
