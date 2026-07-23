// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

const isDevCommand = process.argv.includes("dev");

const reactOptimizeDeps = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

// https://astro.build/config
export default defineConfig({
  output: "server",
  redirects: {
    "/dashboard": "/",
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    optimizeDeps: {
      include: [
        ...reactOptimizeDeps,
        "@radix-ui/react-slot",
        "@radix-ui/react-tooltip",
        "class-variance-authority",
        "clsx",
        "lucide-react",
        "tailwind-merge",
      ],
      // Vite prebundles react/jsx-dev-runtime with NODE_ENV=production unless forced,
      // which sets jsxDEV to undefined and breaks React island hydration in dev.
      ...(isDevCommand && {
        esbuildOptions: {
          define: {
            "process.env.NODE_ENV": '"development"',
          },
        },
      }),
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      WEATHER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
