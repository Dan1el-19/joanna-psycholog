Profesjonalna strona internetowa terapeuty z zaawansowanym systemem rezerwacji wizyt online.

## 🚀 Funkcjonalności

### Dla klientów:
- **Strona główna** z informacjami o terapeucie
- **O mnie** - kwalifikacje i doświadczenie
- **Oferta** - dostępne usługi i cennik
- **Umów wizytę** - system rezerwacji online z:
  - Wyborem usługi i terminu
  - Sprawdzaniem dostępności w czasie rzeczywistym
  - Tymczasowym blokowaniem slotów
  - Automatycznymi emailami potwierdzającymi
- **Kontakt** - formularz kontaktowy
- **Polityka prywatności** - wymagane informacje prawne

### Dla administratora:
- **Panel administracyjny** z autoryzacją
- **Zarządzanie rezerwacjami** - przeglądanie, edycja, anulowanie
- **Harmonogram** - tworzenie i zarządzanie dostępnymi terminami
- **Usługi** - dodawanie i edycja oferowanych usług
- **Powiadomienia email** - automatyczne wysyłanie emaili

## 🛠️ Technologie

### Frontend:
- **HTML5** - semantyczna struktura
- **CSS3** z **Tailwind CSS** - nowoczesne stylowanie
- **JavaScript (ES6+)** - interaktywność
- **Vite** - bundler i dev server
- **AOS** - animacje przy przewijaniu

### Backend:
- **Firebase Hosting** - hosting statyczny
- **Firebase Firestore** - baza danych NoSQL
- **Firebase Functions** - serwerless API (TypeScript)
- **Firebase Authentication** - autoryzacja

### Dodatkowe:
- **PWA** - Progressive Web App z Service Worker
- **Responsive Design** - mobile-first
- **SEO** - meta tagi i Open Graph
- **Email Templates** - profesjonalne szablony emaili

## 📁 Struktura projektu

```
joanna-rudzinska/
├── index.html                 # Strona główna
├── main/                      # Strony publiczne
│   ├── o-mnie.html
│   ├── kwalifikacje.html
│   ├── oferta.html
│   ├── umow-wizyte.html
│   ├── kontakt.html
│   ├── polityka-prywatnosci.html
│   ├── admin.html            # Panel administracyjny
│   └── 404.html
├── src/                       # Kod JavaScript
│   ├── main.js               # Główny punkt wejścia
│   ├── app.js                # Rdzeń aplikacji
│   ├── firebase-config.js    # Konfiguracja Firebase
│   ├── firebase-service.js   # Serwis Firebase
│   ├── appointment.js        # System rezerwacji
│   ├── admin-auth.js         # Autoryzacja admina
│   ├── admin-panel.js        # Panel administracyjny
│   ├── schedule-service.js   # Zarządzanie harmonogramem
│   └── photos/               # Zdjęcia
├── functions/                 # Firebase Functions
│   ├── src/index.ts          # Cloud Functions
│   └── package.json
├── public/                    # Zasoby publiczne
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service Worker
│   └── partials/             # Komponenty HTML
├── package.json
├── vite.config.js            # Konfiguracja Vite
└── firestore.rules           # Reguły bezpieczeństwa
```

## 🚀 Instalacja i uruchomienie

### Wymagania:
- Node.js 18+
- npm lub yarn
- Konto Firebase

### 1. Klonowanie i instalacja:
```bash
git clone <repository-url>
cd joanna-rudzinska
npm install
```

### 2. Konfiguracja Firebase:
1. Utwórz projekt w [Firebase Console](https://console.firebase.google.com/)
2. Włącz Firestore Database
3. Włącz Cloud Functions
4. Skonfiguruj Authentication (Email/Password)
5. Skopiuj konfigurację do `src/firebase-config.js`

### 3. Konfiguracja Cloud Functions:
```bash
cd functions
npm install
npm run build
```

### 4. Uruchomienie w trybie deweloperskim:
```bash
npm run dev
```

### 5. Budowanie i wdrożenie:
```bash
# Budowanie aplikacji
npm run build

# Wdrożenie na Firebase
npm run deploy:all
```

## 🔧 Konfiguracja środowiska

### Zmienne środowiskowe (opcjonalnie):
```bash
# .env.local
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### Konfiguracja emaili:
W `functions/src/index.ts` skonfiguruj:
- SMTP settings dla Nodemailer
- Szablony emaili
- Adresy nadawcy i odbiorcy

## 📊 Baza danych (Firestore)

### Kolekcje:
- `appointments` - rezerwacje wizyt
- `services` - dostępne usługi
- `scheduleTemplates` - szablony harmonogramów
- `monthlySchedules` - harmonogramy miesięczne
- `blockedSlots` - zablokowane terminy
- `temporaryBlocks` - tymczasowe blokady
- `adminUsers` - użytkownicy administratorów
- `contactMessages` - wiadomości kontaktowe

## 🔒 Bezpieczeństwo

### Firestore Rules:
- Autoryzacja dla operacji admina
- Anonimowy dostęp do publicznych danych
- Walidacja danych wejściowych

### Rekomendacje:
1. Regularnie aktualizuj zależności
2. Monitoruj użycie Firebase
3. Ustaw limity API
4. Konfiguruj CORS w Functions
5. Używaj zmiennych środowiskowych dla wrażliwych danych

## 📱 PWA Features

- **Offline Support** - podstawowa funkcjonalność offline
- **Install Prompt** - możliwość instalacji na urządzeniach
- **Background Sync** - synchronizacja w tle
- **Push Notifications** - (możliwość rozszerzenia)

## 🎨 Customization

### Kolory i style:
Edytuj `src/style.css` i `vite.config.js`:
```css
@theme {
  --color-primary: #1F2937;
  --color-accent: #2563EB;
  --color-background: #F9FAFB;
}
```

### Treść:
- Strony HTML w katalogu `main/`
- Komponenty w `public/partials/`
- Tłumaczenia można dodać w przyszłości

## 🚀 Deployment

### Firebase Hosting:
```bash
npm run deploy:all
```

### Inne platformy:
- Netlify
- Vercel
- GitHub Pages

## 📈 Monitoring i Analytics

### Firebase Analytics (opcjonalnie):
1. Włącz w Firebase Console
2. Dodaj SDK do aplikacji
3. Skonfiguruj eventy

### Performance Monitoring:
- Firebase Performance
- Lighthouse audits
- Core Web Vitals

## 🔄 Aktualizacje

### Automatyczne:
- Service Worker cache invalidation
- Firebase Functions hot reload
- Vite HMR w development

### Manualne:
```bash
npm update
npm run build
npm run deploy:all
```

## 🐛 Troubleshooting

### Częste problemy:
1. **Błąd Firebase** - sprawdź konfigurację
2. **CORS errors** - skonfiguruj Functions
3. **Build errors** - sprawdź zależności
4. **Email not sending** - sprawdź SMTP settings

### Logi:
- Firebase Functions logs: `firebase functions:log`
- Browser console
- Network tab

## 📞 Wsparcie

W przypadku problemów:
1. Sprawdź dokumentację Firebase
2. Przejrzyj logi błędów
3. Sprawdź konfigurację środowiska
4. Upewnij się, że wszystkie zależności są aktualne

## 📄 Licencja

Projekt prywatny - wszystkie prawa zastrzeżone.

---

**Autor:** Joanna Rudzińska-Łodyga  
**Technologie:** Firebase, Vite, Tailwind CSS, JavaScript  
**Wersja:** 1.0.0