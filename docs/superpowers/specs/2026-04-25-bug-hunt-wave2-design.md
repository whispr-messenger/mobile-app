# Design - Bug hunt wave 2 (jury polish)

**Date** : 2026-04-25 (autonomous mode)

## Bugs identifies (Tudy testing)

1. **Scroll bloque** dans `GroupDetailsScreen` (parametres groupe) + `GroupManagementScreen` (liste membres) sur Safari web — peut pas scroll vers le bas.
2. **Mic tap lent** — long-press sur le bouton vocal met du temps a montrer "Recording…" (probable: `setAudioModeAsync` ou permission qui bloque).
3. **Recipient ne recoit pas le media** sur 1v1 — DB confirme `shared_with` VIDE sur uploads recents (image `94d20166`, `860fbcb7`). Cause: `ChatScreen.handleSendMedia` resoud `memberIds` via 4 fallbacks puis `getConversationMembers`; quand tous echouent → `shareMedia` skipped → RLS bloque destinataire.
4. **i18n strings EN restants** — Settings/Contacts/Chat modals encore en anglais (precedente sweep `deb5a1a` etait scoped calls/swipe).

## Hors scope

- Calls sur Expo Go → demo via Safari PWA (sha-6bcef28 deja fonctionnel)
- EAS native build → trop long + besoin credentials Apple
- Bugs reportes mais non actionables (transferAdmin, SecurityKeysScreen mock, etc)

## Plan : 4 sub-agents en VRAI parallele (worktree isole chacun)

| # | Agent | Domaine | Fix attendu |
|---|-------|---------|-------------|
| 1 | scroll-groupes | GroupDetailsScreen + GroupManagementScreen | Container flex:1 + ScrollView/FlatList contentContainerStyle, evite fixed heights qui castrent RN-Web wheel scroll |
| 2 | mic-perf | MessageInput.startRecording | Pre-grant mic permission au mount du Chat; defer setAudioModeAsync; reduce onLongPress delayLongPress |
| 3 | share-media-fix | ChatScreen.handleSendMedia memberIds | getConversationMembers PRIMARY pour 1v1; retry shareMedia avec exponential backoff; surface erreur si toujours echec |
| 4 | i18n-wave2 | SettingsScreen + Contacts + Chat modals + Alert.alert titles | Remplace EN par FR (Save→Sauvegarder, Cancel→Annuler, Delete→Supprimer, Profile photo→Photo de profil, etc) |

Chaque agent: time-box 30 min, fix safe (avec jest test), commit local conventionnel, NO push.

## Aggregation

Apres les 4 reports: cherry-pick chaque commit serie sur deploy/preprod, npm test full, push unique, monitor CI/CD/rollout sha-XXX. Smoke test Playwright si necessaire.
