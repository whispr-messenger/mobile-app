<div align="center">

<img src="./assets/image.png" width="150" alt="Whispr Logo">
  <h1 align="center">
    <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=28&duration=3000&pause=1000&color=0A192F&center=true&vCenter=true&random=false&width=435&lines=Whispr+Messenger;Communications+S%C3%A9curis%C3%A9es;Messages+Priv%C3%A9s" alt="Typing SVG" />
  </h1>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/coverage-70%25-brightgreen?style=for-the-badge" alt="Test Coverage">
  <a href="https://github.com/whispr-messenger/Whispr-Frontend/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT License">
  </a>
  <a href="https://github.com/whispr-messenger/Whispr-Frontend/blob/main/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome">
  </a>
  <img src="https://img.shields.io/badge/version-1.0.0-orange?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/platform-Web%20%7C%20Mobile-purple?style=for-the-badge" alt="Platform">
</p>

## 📝 Description

Whispr est une plateforme de messagerie sécurisée offrant une expérience utilisateur fluide sur web et mobile. Ce dépôt contient le code frontend de l'application avec une architecture orientée composants et un design system partagé. Whispr permet des communications chiffrées de bout en bout, des discussions privées et des transferts de fichiers sécurisés.

## 📑 Table des matières

- [Description](#-description)
- [Architecture du projet](#-architecture-du-projet)
- [Tech Stack & Outils](#️-tech-stack--outils)
- [Démarrage rapide](#-démarrage-rapide)
- [Contribution](#-contribution)
- [Ressources utiles](#-ressources-utiles)

## 🏗 Architecture du projet

```
whispr-frontend/
├── 🌐 web/            # Application web (PWA)
│   ├── 📁 src/        # Code source
│   └── 🗂️ public/     # Ressources statiques
├── 📱 mobile/         # Applications mobiles (React Native)
│   ├── 📁 src/        # Code source partagé
│   ├── 🍏 ios/        # Config spécifique iOS
│   └── 🤖 android/    # Config spécifique Android
├── 🎨 design-system/  # Composants UI partagés
│   └── 📁 src/        # Bibliothèque de composants
├── 📚 docs/           # Documentation technique
├── ⚙️ scripts/        # Scripts de build & déploiement
├── 🛠️ .github/        # Workflows, templates PR/issues
├── 📄 README.md       # Ce fichier
└── 📝 CONTRIBUTING.md # Guide de contribution
```

### Schéma d'architecture

```mermaid
flowchart LR
    %% Style simple et minimaliste
    DS["🎨 Design System"] --> WebApp["🌐 Web App"]
    DS --> Mobile["📱 Mobile App"]
    Docs["📚 Documentation"] -.-> DS
    Docs -.-> WebApp
    Docs -.-> Mobile
    
    Mobile --- iOS["iOS"]
    Mobile --- Android["Android"]
    
    %% Palette attrayante et moderne
    classDef core fill:#FF6B6B,stroke:#FFE66D,color:#1A535C,stroke-width:2px
    classDef web fill:#4ECDC4,stroke:#292F36,color:#F7FFF7,stroke-width:2px
    classDef mob fill:#6A0572,stroke:#AB83A1,color:#F7FFF7,stroke-width:2px
    classDef doc fill:#1F7A8C,stroke:#BFDBF7,color:#F7FFF7,stroke-width:2px
    
    class DS core
    class WebApp web
    class Mobile,iOS,Android mob
    class Docs doc
```

## ⚙️ Tech Stack & Outils

| Couche | Technologies principales | Objectif |
|-------|------------------------|----------|
| 🌐 **Web App** | [**React**](https://reactjs.org/), [**Vite**](https://vitejs.dev/), [**Redux Toolkit**](https://redux-toolkit.js.org/) | PWA, gestion d'état |
| 📱 **Mobile App** | [**React Native**](https://reactnative.dev/), [**Redux Toolkit**](https://redux-toolkit.js.org/) | iOS/Android, navigation |
| 🎨 **Design System** | [**Storybook**](https://storybook.js.org/), [**Styled-components**](https://styled-components.com/) | Bibliothèque UI, documentation |
| ✅ **Qualité** | [**ESLint**](https://eslint.org/), [**Prettier**](https://prettier.io/), [**Jest**](https://jestjs.io/), [**Testing Library**](https://testing-library.com/) | Qualité code, tests |
| ⚙️ **CI/CD** | [**GitHub Actions**](https://github.com/features/actions) | Automatisation, déploiement |
| 📚 **Documentation** | [**Markdown**](https://www.markdownguide.org/), [**Mermaid**](https://mermaid.js.org/), [**Storybook**](https://storybook.js.org/) | Documentation, diagrammes |

## 🚀 Démarrage rapide

### 1. **Cloner le dépôt**
```bash
git clone https://github.com/whispr-messenger/Whispr-Frontend.git
cd Whispr-Frontend
```

### 2. **Installer les dépendances**
```bash
# Installation des dépendances web
cd web && npm install

# Installation des dépendances mobile
cd ../mobile && npm install

# Installation des dépendances design system
cd ../design-system && npm install
```

### 3. **Lancer les applications**
| App | Commande |
|-----|----------|
| 🌐 **Web** | `npm run dev` |
| 📱 **Mobile** | `npm run start` |
| 🎨 **Design System** | `npm run storybook` |

### 4. **Builder pour la production**
```bash
# Build web
cd web && npm run build

# Build mobile
cd ../mobile && npm run build

# Build design system
cd ../design-system && npm run build
```

### 5. **Tester**
```bash
# Tests unitaires et d'intégration
npm run test

# Tests e2e
npm run test:e2e
```

## 🤝 Contribution

Veuillez lire [CONTRIBUTING.md](./CONTRIBUTING.md) pour notre workflow, standards de code et processus de PR.

## 📚 Ressources utiles

- [Documentation du projet](./docs/)
- [Design System Storybook](http://localhost:6006)
- [Référence API](./docs/api.md)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Normes d'accessibilité WCAG](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [Guide de style](./docs/style-guide.md)
- [Architecture flux de données](./docs/data-flow.md)
