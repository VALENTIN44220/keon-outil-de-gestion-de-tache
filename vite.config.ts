import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const FALLBACK_BACKEND_URL = "https://xfcgunaxdlhopqlmqdzw.supabase.co";
const FALLBACK_BACKEND_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmY2d1bmF4ZGxob3BxbG1xZHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDc4NTksImV4cCI6MjA4MzYyMzg1OX0.zkbvdnGpdkZ-SmA7APdEJ3Lg3VCiQaTsfOT_a2aCtvs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const backendUrl = process.env.VITE_SUPABASE_URL ?? FALLBACK_BACKEND_URL;
  const backendPublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_BACKEND_PUBLISHABLE_KEY;

  return {
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
