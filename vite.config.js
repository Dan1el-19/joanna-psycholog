// vite.config.js - OSTATECZNA WERSJA "WSZYSTKO W JEDNYM"

import { resolve } from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";

// Funkcja do znajdowania stron wciąż jest nam potrzebna dla Vite
const getHtmlEntries = (dir) => {
  try {
    const files = fs.readdirSync(resolve(__dirname, dir));
    const entries = {};
    files.forEach((file) => {
      if (file.endsWith(".html")) {
        const name = file.substring(0, file.lastIndexOf("."));
        entries[name] = resolve(__dirname, dir, file);
      }
    });
    return entries;
  } catch (error) {
    console.error(`Błąd odczytu katalogu ${dir}:`, error);
    return {};
  }
};

export default defineConfig({
  plugins: [
    // Wywołujemy wtyczkę i przekazujemy jej całą konfigurację Tailwind
    tailwindcss({
      // 1. Mówimy, które pliki skanować
      content: [
        "./index.html",
        "./main/**/*.html",
        "./partials/**/*.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
      // 2. Mówimy, jak używać zmiennych z pliku CSS
      theme: {
        extend: {
          colors: {
            background: "var(--color-background)",
            surface: "var(--color-surface)",
            primary: "var(--color-primary)",
            secondary: "var(--color-secondary)",
            accent: "var(--color-accent)",
          },
          fontFamily: {
            sans: "var(--font-sans)",
            display: "var(--font-display)",
          },
        },
      },
      // 3. Wtyczki tailwind (jeśli będziemy potrzebować)
      plugins: [],
    }),
  ],

  // Konfiguracja dev server
  server: {
    open: true,
    middlewareMode: false,
    // Middleware do obsługi czystych URL-ów
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        
        // Przekierowania dla czystych URL-ów
        const routes = {
          '/o-mnie': '/main/o-mnie.html',
          '/oferta': '/main/oferta.html',
          '/umow-wizyte': '/main/umow-wizyte.html',
          '/kontakt': '/main/kontakt.html',
          '/polityka-prywatnosci': '/main/polityka-prywatnosci.html',
          '/admin': '/main/admin.html',
          '/schedule-admin': '/main/schedule-admin.html',
          '/manage-reservation': '/main/manage-reservation.html'
        };
        
        if (routes[url]) {
          req.url = routes[url];
        }
        
        next();
      });
    }
  },

  // Konfiguracja Vite do obsługi wielu podstron
  // ...
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "o-mnie": resolve(__dirname, "main/o-mnie.html"),
        oferta: resolve(__dirname, "main/oferta.html"),
        "umow-wizyte": resolve(__dirname, "main/umow-wizyte.html"),
        kontakt: resolve(__dirname, "main/kontakt.html"),
        "polityka-prywatnosci": resolve(__dirname, "main/polityka-prywatnosci.html"),
        admin: resolve(__dirname, "main/admin.html"),
        "admin-appointments": resolve(__dirname, "main/admin-appointments.html"),
        "admin-schedule": resolve(__dirname, "main/admin-schedule.html"),
        "admin-settings": resolve(__dirname, "main/admin-settings.html"),
        "schedule-admin": resolve(__dirname, "main/schedule-admin.html"),
        "manage-reservation": resolve(__dirname, "main/manage-reservation.html"),
      },
    },
  },

});
