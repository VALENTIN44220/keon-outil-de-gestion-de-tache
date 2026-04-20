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
      // Cloudflare Pages (and some CDN/browser combos) intermittently corrupt or mis-serve
      // lazy chunks (Firefox: NS_ERROR_CORRUPTED_CONTENT). One JS artifact per deploy avoids
      // that class of failures at the cost of a larger initial download.
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
