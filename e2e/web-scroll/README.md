# E2E web scroll — Whispr PWA

Tests Playwright multi-platform pour valider que la PWA Whispr
(`https://whispr-preprod.roadmvn.com` par defaut) charge correctement et
que le layout reste fonctionnel sur les 3 viewports cibles :

- desktop-chrome (Chromium 1280x720)
- iphone-safari (WebKit, iPhone 14 Pro)
- android-pixel (Chromium, Pixel 7)

## Lancer en local

```bash
# Installer les browsers (premiere fois uniquement)
npx playwright install chromium webkit

# Lancer toute la suite contre preprod
npm run e2e:web

# Lancer un seul project
npx playwright test --project=desktop-chrome

# Lancer contre une autre URL (preview locale par exemple)
E2E_BASE_URL=http://localhost:8081 npm run e2e:web
```

## Structure

- `smoke.spec.ts` : la PWA charge et expose un titre, un manifest et
  un splash sans crash console.
- `pwa-shell.spec.ts` : verifie que la coquille rendue ne deborde pas
  du viewport (pas de scroll horizontal parasite, body height >= viewport
  height pour les screens connus).

Les specs login + scroll deep (9 screens : ConversationsList, Contacts,
MyProfile, UserProfile, MySanctions, ProfileSetup, TwoFactorSetup,
TwoFactorAuth, Calls) sont reportees aux follow-ups WHISPR-1338 / 1339
qui ajouteront d'abord les `testID="screen-<name>-bottom"` necessaires
sur chaque screen, puis l'helper login OTP avec `OTP_BYPASS_CODE=123456`.
