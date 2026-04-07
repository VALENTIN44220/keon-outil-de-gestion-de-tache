import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Vite charge implicitement les variables pour l'app (import.meta.env),
  // mais pour le fichier de config lui-même on sécurise avec loadEnv.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const backendUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const backendPublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!backendUrl || !backendPublishableKey) {
    throw new Error(
      '[Supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY are missing in environment.'
    );
  }

  return {
    build: {
      manifest: true,
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
