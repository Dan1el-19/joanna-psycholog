import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import htmlMinifier from "vite-plugin-html-minifier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  
  return {
    plugins: [
      // HTML Minifier tylko w trybie produkcyjnym
      ...(isDev ? [] : [
        htmlMinifier({
          minify: true,
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
        })
      ]),
      // Konfiguracja Tailwind CSS
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

    // Rozwiązywanie ścieżek
    resolve: {
      alias: {
        '/main.js': resolve(__dirname, 'src/main.js')
      }
    },

    // Konfiguracja serwera deweloperskiego z explicit HMR
    server: {
      host: true, // Pozwala na połączenia z zewnątrz
      port: 5173,
      open: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
        clientPort: 5173
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url;
          const routes = {
            '/o-mnie': '/main/o-mnie.html',
            '/kwalifikacje': '/main/kwalifikacje.html',
            '/oferta': '/main/oferta.html',
            '/umow-wizyte': '/main/umow-wizyte.html',
            '/kontakt': '/main/kontakt.html',
            '/polityka-prywatnosci': '/main/polityka-prywatnosci.html',
            '/admin': '/main/admin.html',
            '/schedule-admin': '/main/admin.html',
            '/manage-reservation': '/src/manage-reservation.html'
          };
          if (routes[url]) {
            req.url = routes[url];
          }
          next();
        });
      }
    },

    // Konfiguracja build
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          "o-mnie": resolve(__dirname, "main/o-mnie.html"),
          kwalifikacje: resolve(__dirname, "main/kwalifikacje.html"),
          oferta: resolve(__dirname, "main/oferta.html"),
          "umow-wizyte": resolve(__dirname, "main/umow-wizyte.html"),
          kontakt: resolve(__dirname, "main/kontakt.html"),
          "polityka-prywatnosci": resolve(__dirname, "main/polityka-prywatnosci.html"),
          admin: resolve(__dirname, "main/admin.html"),
          "manage-reservation": resolve(__dirname, "src/manage-reservation.html"),
          "404": resolve(__dirname, "main/404.html"),
        },
        output: {
          // Optymalizacja chunków tylko w produkcji
          ...(isDev ? {} : {
            manualChunks: {
              'firebase': ['firebase/app', 'firebase/firestore', 'firebase/functions'],
              'vendor': ['aos'],
              'admin': ['./src/admin-auth.js', './src/admin-navigation.js', './src/admin-panel.js'],
              'firebase-service': ['./src/firebase-service.js']
            }
          })
        }
      },
      minify: isDev ? false : 'terser',
      target: 'es2015',
      cssCodeSplit: !isDev, // Wyłącz w trybie deweloperskim
      sourcemap: isDev, // Włącz sourcemapy w development
      chunkSizeWarningLimit: 1000,
    },

    // Optymalizacja zależności
    optimizeDeps: {
      include: ['firebase/app', 'firebase/firestore', 'firebase/functions', 'aos']
    }
  };
});