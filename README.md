# Whispr — Mobile App

Application mobile React Native / Expo pour Whispr Messenger.

## Prérequis

- Node.js >= 18
- npm
- Pour iOS : Xcode + simulateur iOS
- Pour Android : Android Studio + émulateur Android

## Installation

```bash
npm install
```

## Lancer le projet

```bash
# Démarrer le serveur Metro uniquement
npm start

# Build et lancer sur Android
npm run android

# Build et lancer sur iOS
npm run ios
```

> `android` et `ios` utilisent `expo run:*` (build natif local) car l'app inclut des modules natifs (`react-native-fast-tflite`) incompatibles avec Expo Go.

## Tests

```bash
npm test
```

## Lint

```bash
npm run lint:fix
```
