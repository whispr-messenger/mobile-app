# Design - Bug hunt parallele 10 agents

**Date** : 2026-04-25
**Auteur** : roadman (autonomous mode)

## Contexte

Apres le push des fixes calls + vocaux (sha-2b0ee70), Tudy a repere plusieurs bugs de logique:
- Vocal supprime → toujours rejouable (data integrity)
- Bouton mute pendant un appel ne reagit pas
- Bouton flip pendant un appel ne reagit pas
- Labels en anglais alors que l'app est censee etre francaise (mute/flip notamment)

Tudy demande une chasse aux bugs LARGE (perimeter C: tout l'app — web + native + moderation/admin + auth + profil + contacts + scheduling) avec **fix direct** dans des worktrees + 10 agents max en parallele. Mode autonome.

## Objectifs

1. Identifier le maximum de bugs de logique en 1 passage parallele.
2. Fixer directement les bugs surs (faible blast radius, fix evident).
3. Reporter les bugs risques (refacto, contrats API) pour decision Tudy.
4. Sortir un rapport JIRA-ready agrege que je trierai apres.
5. Cherry-pick tous les fixes sur deploy/preprod, un seul push final pour eviter N cycles CI.

## Non-objectifs

- Pas de refacto large.
- Pas de design UI nouveau.
- Pas de feature.
- Strictement bug fix.

## Plan : 10 agents parallele

Chaque agent recoit un domaine, demarre dans un worktree git isole sur deploy/preprod. Outils : Read/Grep/Edit/Write/Bash. **Pas de Playwright MCP** dans les sub-agents (single browser MCP, conflit de ressources). Le sub-agent fait audit STATIQUE du code + ecrit fix + tests jest. Validation E2E se fera par moi apres merge.

| # | Agent | Perimetre | Bugs cibles |
|---|-------|-----------|-------------|
| 1 | calls-controls | InCallScreen, CallControls, callsStore, liveKitProvider | mute KO, flip KO, labels EN, hangup, ringing UI |
| 2 | voice-messages | MessageInput, AudioMessage, VoiceMessageBubble, message delete flow | vocal supprime jouable, replay state, recording UX |
| 3 | chat-crud | ChatScreen handlers (send/edit/delete/reply/forward/pin), MessageBubble | actions vs state, optimistic UI, ghost messages |
| 4 | media-preview | MediaMessage, ImagePreview, VideoPreview, MediaService | preview 401, MIME issues, thumbnails, /blob URL |
| 5 | conversations-list | ConversationsListScreen, swipe actions, pin/archive/mute/badges/sort | pin idempotency, badge sync, archive flow |
| 6 | contacts | AddContactModal, ContactsScreen, friend requests, block, QR | add/block flows, validation, English text |
| 7 | profile | ProfileScreen, ProfileSetupScreen, photo upload | save validation, photo flow, biography limits |
| 8 | auth-session | AuthService, TokenService, OtpScreen, AuthNavigator, refresh flow | refresh failures cascade, session restore, sign out cleanup |
| 9 | admin-moderation | AppealQueueScreen, AppealReviewScreen, sanctions, blocked image flow | approve/reject flows, race conditions |
| 10 | i18n-sweep | Full app source | hardcoded English strings (alert/Toast/labels/buttons) |

## Methode pour chaque agent

1. `git pull --rebase origin deploy/preprod` dans son worktree
2. Lire les fichiers du perimetre, tracer les flows critiques
3. Pour chaque bug detecte :
   - Severity (P0 demo-blocker / P1 visible / P2 cosmetique)
   - Repro steps
   - Root cause
   - Fix (si SAFE) ou rapport seul (si RISKY)
4. Si fix : edit code + jest test, commit local conventionnel (`fix(<scope>): ...`), pas de push
5. Rapport final structure (markdown) avec tous les bugs + commits SHA

## Aggregation par moi

- Aggreger les 10 rapports
- Cherry-pick tous les commits de fix sur deploy/preprod (en serie pour eviter conflits)
- npm test + tsc check
- Single push
- Monitor CI/CD/rollout
- Smoke test Playwright sur 3-4 user journeys cle (calls, vocaux, profile, chat)
- Rapport final au user

## Risques

| Risque | Mitigation |
|--------|------------|
| 10 agents = beaucoup de tokens | Brief court par agent, time-box ~30 min chacun |
| Conflits cherry-pick (touchent meme fichier) | Si conflict, je resous au merge ou skip le commit le moins critique |
| Fix risque introduit regression | Tests jest obligatoires, je relance suite complete avant push |
| ProfileScreen.test.tsx encore en flux (deja fix par moi 2b0ee70) | Agent profil doit ne pas le retoucher sans verifier |

## Hors scope

- Reanalyse de l'architecture
- Decisions produit (changer le wording, ajouter des features)
- Backend services (sauf si bug front trouve un endpoint manquant - alors rapport seulement)
