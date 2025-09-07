import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: true, // מאזין ל-0.0.0.0 / כל ממשקים
    port: Number(process.env.PORT) || 5173, // שימוש ב-$PORT של ריפליט
    allowedHosts: [
      ".replit.dev",
      ".repl.co",
      // ואם עדיין נדרש, גם הדומיין הספציפי:
      "f84a5009-f963-44db-b2bb-5d25b22c372c-00-2woq1nsfwt93e.janeway.replit.dev",
    ],
  },
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
}));
