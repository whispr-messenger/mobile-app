# 🤝 Guide de Contribution - Whispr Mobile

Merci de contribuer au projet Whispr Mobile ! Ce guide vous aidera à respecter nos standards de développement.

## 📋 Table des matières

- [Conventions Git](#conventions-git)
- [Workflow de développement](#workflow-de-développement)
- [Scripts utiles](#scripts-utiles)
- [Tests et qualité](#tests-et-qualité)

## 🌿 Conventions Git

### Format des branches

Toutes les branches doivent suivre ce format :
```
WHISPR-<numéro>-<description-kebab-case>
```

**✅ Exemples corrects :**
- `WHISPR-123-add-user-authentication`
- `WHISPR-456-fix-payment-gateway`
- `WHISPR-789-update-api-documentation`

**❌ Exemples incorrects :**
- `feature/auth` (pas de numéro de ticket)
- `whispr-123` (WHISPR doit être en majuscules)
- `WHISPR-123_add_feature` (utiliser `-` pas `_`)

### Format des commits

Les commits suivent le format **Gitmoji + Conventional Commit** :

```
<emoji> <type>(<scope>): <description>

[optional body]

WHISPR-XXX
```

**Types de commits :**

| Emoji | Type | Utilisation |
|-------|------|-------------|
| ✨ | `feat` | Nouvelle fonctionnalité |
| 🐛 | `fix` | Correction de bug |
| 📝 | `docs` | Documentation |
| 🎨 | `style` | Format du code |
| ♻️ | `refactor` | Refactorisation |
| ⚡️ | `perf` | Performance |
| ✅ | `test` | Tests |
| 🔧 | `chore` | Configuration |
| 🚀 | `deploy` | Déploiement |
| 🔒️ | `security` | Sécurité |

**✅ Exemple de commit :**
```bash
✨ feat(auth): add OAuth2 authentication flow

Implement Google and GitHub OAuth providers
Add token refresh mechanism

WHISPR-123
```

**Règles importantes :**
- ✅ **UN SEUL emoji** au début
- ✅ **Écrire en anglais**
- ✅ **Mode impératif** ("add" pas "added")
- ✅ **Max 72 caractères** pour la première ligne

### Format des Pull Requests

Le titre des PR doit suivre ce format :
```
[WHISPR-<numéro>] <Description claire en anglais>
```

**Règles :**
- ❌ **PAS d'emojis** dans le titre de la PR
- ✅ Numéro de ticket **entre crochets**
- ✅ Description **claire et en anglais**

**✅ Exemples corrects :**
- `[WHISPR-123] Add user authentication system`
- `[WHISPR-456] Fix payment gateway timeout issue`
- `[WHISPR-789] Update API documentation for v2 endpoints`

## 🔄 Workflow de développement

### 1. Créer une branche

**Option A : Avec le script helper (recommandé)**
```bash
./scripts/create-branch.sh 123 "add new feature"
# Crée automatiquement : WHISPR-123-add-new-feature
```

**Option B : Manuellement**
```bash
git checkout main
git pull origin main
git checkout -b WHISPR-123-add-new-feature
```

### 2. Développer la fonctionnalité

Développez votre code normalement...

### 3. Faire des commits

**Option A : Assistant interactif (recommandé pour débuter)**
```bash
npm run commit
# ou
./scripts/commit-helper.sh
```

L'assistant vous guidera étape par étape.

**Option B : Commit manuel**
```bash
git add .
git commit -m "✨ feat(mobile): add new feature"
```

Les hooks Git vérifient automatiquement :
- ✅ Format du commit
- ✅ Présence de l'emoji
- ✅ Type valide
- ✅ Longueur < 72 caractères

### 4. Push et Pull Request

```bash
git push origin WHISPR-123-add-new-feature
```

Sur GitHub, créez une PR avec le titre :
```
[WHISPR-123] Add new feature
```

## 🛠️ Scripts utiles

### Validation de branche
```bash
npm run validate
# ou
bash scripts/validate-branch-name.sh
```

### Assistant de commit
```bash
npm run commit
# ou
bash scripts/commit-helper.sh
```

### Créer une branche
```bash
bash scripts/create-branch.sh 123 "description"
```

## ✅ Tests et qualité

### Lancer les tests
```bash
cd Frontend
npm test
```

### Linter
```bash
cd Frontend
npm run lint
npm run lint:fix
```

### Type checking
```bash
cd Frontend
npm run type-check
```

## 🎯 Exemples complets

### Exemple 1 : Ajouter une nouvelle fonctionnalité

```bash
# 1. Créer la branche
./scripts/create-branch.sh 150 "add dark mode"

# 2. Développer...
# 3. Commit avec l'assistant
npm run commit
# Choisir: feat -> mobile -> add dark mode toggle

# 4. Push
git push origin WHISPR-150-add-dark-mode

# 5. Créer PR: [WHISPR-150] Add dark mode toggle
```

### Exemple 2 : Corriger un bug

```bash
# 1. Créer la branche
git checkout -b WHISPR-151-fix-login-crash

# 2. Corriger le bug...
# 3. Commit manuel
git add .
git commit -m "🐛 fix(auth): prevent crash on invalid credentials

WHISPR-151"

# 4. Push et PR
git push origin WHISPR-151-fix-login-crash
# PR: [WHISPR-151] Fix login crash on invalid credentials
```

## 📚 Ressources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Gitmoji](https://gitmoji.dev/)
- [Documentation Whispr](./docs/)

## ❓ Besoin d'aide ?

Si vous avez des questions, n'hésitez pas à :
- Ouvrir une issue sur GitHub
- Demander sur le canal Slack de l'équipe
- Consulter la documentation dans `/docs`

## 🚀 Installation pour les nouveaux contributeurs

Après avoir cloné le projet :

```bash
cd mobile-app
npm install  # Installe automatiquement les hooks Git
cd Frontend
npm install  # Installe les dépendances du projet
```

Les hooks Git seront automatiquement configurés et vous aideront à respecter les conventions !

---

Merci de contribuer à Whispr ! 🎉

