import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Vite charge implicitement les variables pour l'app (import.meta.env),
  // mais pour le fichier de config lui-même on sécurise avec loadEnv.
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const backendPublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Note: do NOT throw here. The runtime client (client.safe.ts) validates env vars.
  // Throwing in the Vite config breaks `vite build` in environments where env injection
  // happens after config load (e.g. some sandbox setups).
  if (!backendUrl || !backendPublishableKey) {
    console.warn(
      '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing at config load — relying on runtime injection.'
    );
  }

  return {
    build: {
      manifest: true,
      // Bundle unique : tentative de split par vendor a causé un crash
      // « React.forwardRef undefined » (vendor-radix évalué avant vendor-react).
      // Pour split correctement il faudrait soit forcer un ordre de chargement
      // soit fusionner toutes les libs qui dépendent de React dans un seul chunk
      // (perd l'intérêt). On garde le single-bundle, et on compte sur :
      //  - <link rel="preconnect"> Supabase (index.html) pour démarrer le TLS tôt
      //  - Brotli/gzip côté Cloudflare pour réduire le transfert (~1.1 MB compressé)
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backendPublishableKey),
    },
    resolve: {
      alias: {
        "@/integrations/supabase/client": path.resolve(
          __dirname,
          "./src/integrations/supabase/client.safe.ts"
        ),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
