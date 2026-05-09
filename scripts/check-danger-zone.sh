#!/usr/bin/env bash
# Verifie que les balises @danger-zone-mobile-layout placees dans la PR #186
# (Wave 21) ne sont pas supprimees silencieusement par un refacto.
#
# Comportement :
#   - actual <  EXPECTED_COUNT  -> exit 1 + diff des fichiers attendus
#   - actual >  EXPECTED_COUNT  -> exit 0 + warning bump variable
#   - actual == EXPECTED_COUNT  -> exit 0 silencieux
#
# Doit tourner sur ubuntu-latest (GitHub Actions) et en local.

set -eu

# Chaque fichier sentinel contient la balise dans son JSDoc d'entete (1)
# ET la replique en bas du commentaire ("Tag parsable : @danger-zone-mobile-layout").
# Soit 2 occurrences par fichier sentinel, 10 fichiers, total = 20.
EXPECTED_COUNT=20

EXPECTED_FILES="
src/components/Chat/Avatar.tsx
src/screens/Auth/ProfileSetupScreen.tsx
src/screens/Calls/CallsScreen.tsx
src/screens/Chat/ConversationsListScreen.tsx
src/screens/Contacts/ContactsScreen.tsx
src/screens/Moderation/MySanctionsScreen.tsx
src/screens/Profile/MyProfileScreen.tsx
src/screens/Profile/UserProfileScreen.tsx
src/screens/Security/TwoFactorAuthScreen.tsx
src/screens/Security/TwoFactorSetupScreen.tsx
"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d src ]; then
  echo "[danger-zone] erreur: dossier src/ introuvable depuis $REPO_ROOT" >&2
  exit 2
fi

ACTUAL_COUNT="$(grep -rn '@danger-zone-mobile-layout' src/ 2>/dev/null | wc -l | tr -d ' ')"

if [ "$ACTUAL_COUNT" -lt "$EXPECTED_COUNT" ]; then
  echo "[danger-zone] FAIL : $ACTUAL_COUNT balises trouvees, attendu $EXPECTED_COUNT" >&2
  echo "" >&2
  echo "Fichiers sentinels attendus (chacun doit contenir 2 balises) :" >&2
  for f in $EXPECTED_FILES; do
    if [ -f "$f" ]; then
      n="$(grep -c '@danger-zone-mobile-layout' "$f" 2>/dev/null || echo 0)"
      echo "  - $f  ($n balises)" >&2
    else
      echo "  - $f  (FICHIER MANQUANT)" >&2
    fi
  done
  echo "" >&2
  echo "Une regression a probablement supprime un commentaire JSDoc protege." >&2
  echo "Revertir le retrait, ou si la suppression est justifiee :" >&2
  echo "  1. ouvrir un ticket WHISPR pour documenter la decision" >&2
  echo "  2. baisser EXPECTED_COUNT dans scripts/check-danger-zone.sh" >&2
  exit 1
fi

if [ "$ACTUAL_COUNT" -gt "$EXPECTED_COUNT" ]; then
  echo "[danger-zone] WARN : $ACTUAL_COUNT balises trouvees, attendu $EXPECTED_COUNT"
  echo "  -> une nouvelle balise a ete ajoutee. Bumper EXPECTED_COUNT a $ACTUAL_COUNT"
  echo "     dans scripts/check-danger-zone.sh."
  exit 0
fi

exit 0
