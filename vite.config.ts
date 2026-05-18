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
      // Bundle unique (4.5 MB) historiquement choisi pour éviter NS_ERROR_CORRUPTED_CONTENT
      // sur Firefox + Cloudflare. Mais ça force le navigateur à télécharger + parser
      // l'intégralité avant d'afficher quoi que ce soit → 30-60 s sur connexion modeste.
      //
      // On split en chunks « vendor » stables : ces chunks restent identiques d'un déploiement
      // à l'autre (libs ne changent pas) donc le navigateur les sert depuis son cache.
      // Le splitting route-based reste désactivé (eager imports dans App.tsx).
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'vendor-charts';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('@tanstack')) return 'vendor-query';
            return 'vendor-misc';
          },
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
