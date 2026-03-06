# Contributing

Tack för att du vill bidra! 🎉

## Snabbstart

1. Forka eller skapa branch från `main`.
2. Installera beroenden: `npm install`.
3. Kör kontroller lokalt:
   - `npm run lint`
   - `npm run build`
4. Skicka en PR mot `main`.

## Branching och commits

- Föredra små, fokuserade PR:er.
- Beskriv **vad** som ändrats och **varför**.
- Om du ändrar schema i Prisma: inkludera migration och uppdatera seed vid behov.
- Använd Conventional Commits (t.ex. `feat:`, `fix:`, `docs:`, `chore:`).

### Lokala commit-gates

- Pre-commit kör `lint-staged` för JS/TS-filer.
- Commit message valideras med Commitlint.

## Pull Request-checklista

- [ ] Kod är testad lokalt
- [ ] `npm run lint` passerar
- [ ] `npm run build` passerar
- [ ] Dokumentation uppdaterad (README/docs) vid beteendeförändring
- [ ] Säkerhets- eller konfigändringar dokumenterade

## Kodstandard

- TypeScript först i både web och API
- Håll funktioner små och läsbara
- Föredra tydliga namn framför kommentarer
- Undvik att introducera hemligheter i repo

## Security

Rapportera sårbarheter privat enligt `SECURITY.md`.
