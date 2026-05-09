# Mini-card profil — design

Date : 2026-05-09
Repo principal : `mobile-app`
Repo secondaire (prérequis F2) : `user-service`, `mobile-app/Settings`
Ticket Jira : à créer (WHISPR-XXXX) au moment du dispatch.

## Contexte

Les utilisateurs Whispr peuvent croiser un profil tiers à plusieurs endroits dans l'app : conversations, contacts, members d'un groupe, résultats de recherche. Aujourd'hui, le seul accès au profil tiers passe par `UserProfileScreen` (écran complet). Pour les interactions courtes (vérifier qui est l'expéditeur, voir un avatar plus grand, accéder rapidement à "envoyer un message"), un écran complet est trop lourd.

L'objectif : afficher une mini-card profil légère sur clic gauche (desktop) ou appui long (mobile) sur n'importe quel avatar/nom utilisateur dans les listes.

Sujet connexe : la feature **F2** (toggles privacy mobile manquants) doit être implémentée AVANT la mini-card pour que les gates `lastSeenPrivacy` et autres soient pilotables côté UI. Sans F2, le gate fonctionne déjà côté backend (default `CONTACTS`) mais l'utilisateur ne peut pas modifier son comportement.

## Non-objectifs

- Pas de remplacement de `UserProfileScreen`. La mini-card pointe vers cet écran via le bouton "Voir profil complet".
- Pas de nouveau endpoint backend. On réutilise `GET /profile/:userId` existant qui applique déjà les privacy gates côté user-service.
- Pas de chat embed. La mini-card est une vue read-only avec actions basiques.

## Composants

### `MiniProfileCard`

Composant React Native standalone, autonome.

- Props : `userId: string`, `anchorRef: RefObject` (élément déclencheur pour positionnement), `onClose: () => void`.
- Internal state : `loading`, `profile`, `error`, `relation` (`isContact | isBlocked | isSelf | unknown`).
- Rendu :
  - Photo profil ronde (large, ~80x80).
  - Display name = `firstName + lastName` (fallback `username`).
  - `@username` en sous-titre.
  - Bio courte (2 lignes max, ellipsis).
  - Last seen formaté (ex : "vu il y a 5 min", "en ligne", "vu hier"). Caché si la réponse backend ne contient pas le champ (privacy gate appliqué côté serveur).
  - Boutons (utilisateur tiers) : `Message` / `Voir profil complet` / `Bloquer` (`Débloquer` si déjà bloqué).
  - Bouton (self) : `Modifier mon profil` → `MyProfileScreen`.
  - Compte supprimé : photo placeholder + "Compte supprimé".
- Animation : fade-in 150ms.

### `useMiniProfileCard()` hook

Hook singleton (Zustand store ou Context dédié) qui maintient au plus une mini-card visible.

- API : `open(userId, anchorRef)`, `close()`, `currentUserId`, `isOpen`.
- Comportement : ouvrir une mini-card B alors que A est ouverte → close A puis open B.
- Click outside / Escape → `close()`.

### `ProfileTrigger`

Wrapper réutilisable qui détecte le device et bind le bon handler.

- Props : `userId: string`, `children: ReactNode`.
- Sur device tactile (PWA mobile + iOS/Android natif) : `onLongPress` 500ms.
- Sur device souris (desktop web) : `onPress` (clic gauche).
- Détection automatique via `Pressable` (`delayLongPress={500}`).
- Capture `anchorRef` du child et passe à `useMiniProfileCard().open(userId, ref)`.

### Cache LRU

Map LRU en mémoire (`Map<userId, { profile, fetchedAt }>` avec eviction LIFO size 50).

- Reset au reload app.
- TTL implicite de 5 min : si `Date.now() - fetchedAt > 5*60*1000`, refetch en background tout en affichant la version cachée immédiatement.

## Flux de données

1. User clique sur avatar dans `ConversationsListScreen`.
2. `ProfileTrigger.onPress` capture `event` + `anchorRef`.
3. Appel `useMiniProfileCard().open(userId, anchorRef)`.
4. `MiniProfileCard` monté (singleton).
5. Lookup cache LRU :
   - Cache HIT frais (< 5 min) → render immediate.
   - Cache HIT stale → render immediate puis refetch background.
   - Cache MISS → loading state puis fetch.
6. `UserService.getUserProfile(userId)` → `GET /profile/:userId` user-service.
7. Réponse mappée + relation calculée (contact ? bloqué ? self ?).
8. State updated → render final.

## Gestion des erreurs

| Cas | Comportement |
|-----|--------------|
| Network error | State `error` dans la card + bouton "Réessayer" |
| 404 user not found | "Cet utilisateur n'existe plus" + bouton "Fermer" |
| 403 / user a bloqué reader | "Indisponible" + photo placeholder |
| Timeout 8s | Considéré comme network error |

## Privacy gates last seen

Backend `user-service` applique déjà les règles `lastSeenPrivacy` :

- `EVERYONE` → `lastSeen` retourné dans la réponse.
- `CONTACTS` → `lastSeen` retourné si `reader` est dans les contacts du `target`, sinon null.
- `NOBODY` → `lastSeen` toujours null.

Mobile : si `lastSeen === null`, ne pas afficher la ligne. Pas de logique mobile dédiée pour reproduire les règles.

Idem pour les autres champs privacy (firstName, lastName, biography, profilePicture) : déjà masqués backend.

## Layout et positionnement

### Desktop / web

- Popover absolu ancré au DOM rect du trigger.
- Auto-flip si proche du bord (top → bottom, left → right).
- Lib : `react-native-popover-view` ou implémentation custom avec `measure()` + position absolute.

### Mobile (touch)

- Bottom sheet centered (Modal RN) ou `react-native-modal`.
- Hauteur auto, largeur 90% screen, max-width 360.
- Backdrop sombre 60%.

### Tests

- Snapshot `MiniProfileCard` × 4 states : `loading`, `loaded`, `error`, `blocked`.
- Hook `useMiniProfileCard` singleton : open A puis open B → A close auto.
- `ProfileTrigger` : long-press 500ms touch, click mouse, no-op autres gestures.
- Integration : long-press avatar `ConversationsList` → card open → click "Voir profil complet" → navigation `UserProfile`.

## Locations à instrumenter (initial)

| Lieu | Fichier | Élément trigger |
|------|---------|-----------------|
| Liste conversations | `src/screens/Chat/ConversationsListScreen.tsx` | Avatar de l'item |
| Bulle message (groupe) | `src/components/Chat/MessageBubble.tsx` | Avatar à gauche |
| Liste contacts | `src/screens/Contacts/ContactsScreen.tsx` | Avatar de l'item |
| Members groupe | `src/screens/Groups/GroupDetailsScreen.tsx` | Avatar member |
| Résultats recherche | `src/screens/Search/...` | Avatar utilisateur |

Exclu : `ChatScreen` header (déjà bindé à navigation profile complet).

## Effort estimé

- mobile-app : ~400 LoC code + ~100 LoC tests.
- user-service : aucune modif (réutilise endpoint).
- Aucun changement d'API.
- 1 ticket Jira `[WHISPR-XXXX] feat(profile): mini-card profil click gauche / appui long`.

## Dépendances

- F2 (toggles privacy mobile) à finir avant pour cohérence end-to-end.
- Aucune dépendance bloquante côté backend.

## Risques

- Conflit potentiel avec d'autres handlers `onPress` existants sur les avatars (notamment dans MessageBubble et ContactsScreen). À vérifier en exploration avant implémentation : si un autre handler existe, le `ProfileTrigger` doit le préserver via `onPressIn`/`onPress` chaining.
- React-native-web compatibility de `react-native-popover-view` : à vérifier avant de figer la lib. Fallback custom si KO.
- Cache LRU non-persistant : un user qui ouvre plusieurs cards en boucle après reload paie un fetch chaque première vue. Acceptable pour MVP, AsyncStorage en V2 si pertinent.

## Étapes d'implémentation

1. Implémenter F2 (toggles privacy mobile) — séparé.
2. Créer le store/hook `useMiniProfileCard`.
3. Créer le composant `MiniProfileCard` avec rendu + states.
4. Créer le wrapper `ProfileTrigger`.
5. Brancher sur les 5 locations.
6. Tester sur iOS / Android / web mobile / web desktop.
7. Tests unitaires + integration.
