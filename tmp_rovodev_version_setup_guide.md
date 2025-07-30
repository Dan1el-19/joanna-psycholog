# 🚀 Automatyczne Wersjonowanie - Instrukcja

## ✅ Co zostało zaimplementowane:

### 1. **Automatyczne pobieranie informacji z Git**
- Wersja z `package.json`
- Hash ostatniego commita
- Data ostatniego commita
- Wiadomość ostatniego commita
- Nazwa brancha
- Status zmian (czy są niezapisane zmiany)

### 2. **Nowe skrypty npm**
```bash
# Generuje informacje o wersji ręcznie
npm run version:generate

# Pokazuje aktualne informacje o wersji
npm run version:show

# Budowanie automatycznie generuje wersję (prebuild hook)
npm run build
npm run deploy:1
```

### 3. **Automatyczna integracja**
- `prebuild` hook automatycznie generuje wersję przed każdym buildem
- Admin panel pokazuje rzeczywiste informacje z Git
- Pliki generowane automatycznie są ignorowane przez Git

## 🔧 Jak to działa:

### Przed buildem:
```bash
npm run build
# 📦 Generating version info...
#    Version: 0.0.0
#    Commit: a1b2c3d
#    Date: 2024-01-15
#    Branch: main
#    Message: Fix diploma gallery CSP issues
# ✅ Version info generated
```

### W admin panelu zobaczysz:
- **Wersja:** 0.0.0 (a1b2c3d)
- **Ostatni commit:** 2024-01-15
- **Branch:** main
- **Ostatnia zmiana:** Fix diploma gallery CSP issues
- **⚠️ Niezapisane zmiany** (jeśli są)

## 📋 Następne kroki:

1. **Przetestuj system:**
   ```bash
   npm run version:generate
   npm run build
   npm run deploy:1
   ```

2. **Sprawdź admin panel** - sekcja "Ustawienia" → "Informacje o systemie"

3. **Opcjonalnie - zaktualizuj wersję w package.json:**
   ```bash
   npm version patch  # 0.0.0 → 0.0.1
   npm version minor  # 0.0.0 → 0.1.0
   npm version major  # 0.0.0 → 1.0.0
   ```

## 🎯 Korzyści:

- ✅ **Automatyzacja** - nie musisz ręcznie aktualizować wersji
- ✅ **Synchronizacja** - wersja zawsze odpowiada commitom
- ✅ **Transparentność** - widzisz dokładnie jakie zmiany są wdrożone
- ✅ **Debugging** - łatwiej identyfikować problemy po wdrożeniu

## 🔄 Workflow:

1. Wprowadzasz zmiany w kodzie
2. Committujesz: `git commit -m "Add new feature"`
3. Buildujesz: `npm run deploy:1`
4. System automatycznie:
   - Pobiera hash commita
   - Pobiera datę commita
   - Pobiera wiadomość commita
   - Aktualizuje admin panel

**Gotowe!** 🎉