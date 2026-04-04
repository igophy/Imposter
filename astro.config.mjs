 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/astro.config.mjs b/astro.config.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..c2ee870d9c88da620fb5e7de247e295a5ce535f2
--- /dev/null
+++ b/astro.config.mjs
@@ -0,0 +1,7 @@
+import { defineConfig } from 'astro/config';
+
+export default defineConfig({
+  server: {
+    host: true
+  }
+});
 
EOF
)
