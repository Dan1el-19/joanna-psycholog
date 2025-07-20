import { resolve } from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    // Twoja zaawansowana konfiguracja Tailwind CSS - zostaje bez zmian
    tailwindcss({
      content: [
        "./index.html",
        "./main/**/*.html",
        "./partials/**/*.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
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
      plugins: [],
    }),
  ],

  // NOWA SEKCJA: Rozwiązywanie ścieżek
  resolve: {
    alias: {
      // Ta reguła mówi Vite: "Gdy w pliku HTML zobaczysz '/main.js',
      // potraktuj to tak, jakby tam było '/src/main.js'".
      // To naprawia błąd bez potrzeby edycji wszystkich plików HTML.
      '/main.js': resolve(__dirname, 'src/main.js')
    }
  },

  // Twoja konfiguracja serwera deweloperskiego - zostaje bez zmian
  server: {
    open: true,
    middlewareMode: false,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        const routes = {
          '/o-mnie': '/main/o-mnie.html',
          '/oferta': '/main/oferta.html',
          '/umow-wizyte': '/main/umow-wizyte.html',
          '/kontakt': '/main/kontakt.html',
          '/polityka-prywatnosci': '/main/polityka-prywatnosci.html',
          '/admin': '/main/admin.html',
          '/schedule-admin': '/main/admin.html', // Przekierowujemy do tego samego pliku
          '/manage-reservation': '/src/manage-reservation.html'
        };
        if (routes[url]) {
          req.url = routes[url];
        }
        next();
      });
    }
  },

  // ZAKTUALIZOWANA sekcja build
  build: {
    rollupOptions: {
      input: {
        // Definiujemy wszystkie strony, które FAKTYCZNIE istnieją
        main: resolve(__dirname, "index.html"),
        "o-mnie": resolve(__dirname, "main/o-mnie.html"),
        oferta: resolve(__dirname, "main/oferta.html"),
        "umow-wizyte": resolve(__dirname, "main/umow-wizyte.html"),
        kontakt: resolve(__dirname, "main/kontakt.html"),
        "polityka-prywatnosci": resolve(__dirname, "main/polityka-prywatnosci.html"),
        
        // Kluczowy element:
        // Mamy tylko JEDEN plik dla całego panelu admina.
        // Wszystkie stare wpisy (admin-appointments, admin-schedule, etc.) zostały usunięte.
        admin: resolve(__dirname, "main/admin.html"),
        
        // Strona do zarządzania rezerwacją
        "manage-reservation": resolve(__dirname, "src/manage-reservation.html"),
      },
    },
  },
});
