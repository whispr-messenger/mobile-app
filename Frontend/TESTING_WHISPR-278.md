# Guide de Test - WHISPR-278 : Interface complète pour les appels audio

## Prérequis

1. L'app doit être démarrée avec `npm start` ou `yarn start`
2. Vous devez être connecté (utiliser le numéro de téléphone + code 123456)
3. Vous devez avoir au moins une conversation directe dans la liste

## Tests à effectuer

### Test 1 : Appel sortant depuis le chat

**Étapes :**
1. Ouvrez une conversation directe depuis la liste des conversations
2. Regardez le header du chat (en haut)
3. Vous devriez voir un bouton d'appel orange/coral (icône téléphone) à droite
4. Cliquez sur ce bouton
5. **Résultat attendu :**
   - L'écran d'appel s'affiche avec le gradient Whispr
   - L'avatar du contact s'affiche avec animation de pulsation
   - Le nom du contact est affiché
   - Le statut "Sonnerie en cours..." s'affiche
   - Un bouton rouge pour raccrocher est visible

**Vérifications dans les logs :**
```
[ChatScreen] Initiating call to: conv-X
[CallService] Initiating outgoing call to: ...
[CallService] Demo mode: creating mock stream
[CallService] Joined calls channel
[AudioCallScreen] Mounted with params: {...}
```

### Test 2 : Contrôles pendant l'appel (mode démo)

**Étapes :**
1. Après avoir lancé un appel (Test 1)
2. Attendez quelques secondes (l'appel passera en mode "connected" en démo)
3. Testez les boutons :
   - **Bouton Mute** : Cliquez dessus
     - L'icône change de `mic` à `mic-off`
     - La couleur devient rouge
   - **Bouton Speaker** : Cliquez dessus
     - L'icône change de `volume-low` à `volume-high`
   - **Bouton Raccrocher** : Cliquez dessus
     - L'appel se termine
     - Retour automatique à l'écran précédent après 2 secondes

**Vérifications dans les logs :**
```
[AudioCallScreen] Toggling mute
[CallService] Mute toggled: true/false
[AudioCallScreen] Toggling speaker
[CallService] Speaker toggled: true/false
[AudioCallScreen] Ending call
[CallService] Ending call: ...
```

### Test 3 : Timer de durée d'appel

**Étapes :**
1. Lancez un appel (Test 1)
2. Attendez que l'appel passe en état "connected"
3. **Résultat attendu :**
   - Un timer s'affiche sous le statut
   - Format : `MM:SS` (ex: `00:05`, `01:23`)
   - Le timer s'incrémente chaque seconde

### Test 4 : Appel entrant (simulation)

**Note :** Pour tester un appel entrant, vous pouvez temporairement ajouter ce code dans la console du navigateur ou créer un bouton de test :

```javascript
// Dans la console Expo ou via un bouton de test
const callService = require('./src/services/calls/CallService').default.getInstance();
callService.receiveIncomingCall({
  call_id: 'test-call-' + Date.now(),
  from_user_id: 'user-test',
  from_display_name: 'Test User',
  from_avatar_url: undefined,
  type: 'audio',
  conversation_id: 'conv-1'
});
```

**Étapes :**
1. Exécutez le code ci-dessus (ou créez un bouton de test)
2. **Résultat attendu :**
   - Une notification modale apparaît en bas de l'écran
   - Affiche le nom du contact
   - Affiche "Appel audio"
   - Deux boutons : Accepter (vert) et Rejeter (rouge)
   - Animation de pulsation sur l'avatar

**Vérifications dans les logs :**
```
[CallService] Receiving incoming call: test-call-...
[CallService] Incoming call received and emitted
[useCallManager] Incoming call received: ...
[IncomingCallNotification] Accepting/Rejecting call
```

### Test 5 : Navigation et états

**Étapes :**
1. Lancez un appel depuis le chat
2. Pendant que l'appel sonne, cliquez sur le bouton retour (X en haut à droite)
3. **Résultat attendu :** L'appel se termine et vous revenez au chat
4. Relancez un appel
5. Attendez qu'il soit "connected"
6. Cliquez sur le bouton retour
7. **Résultat attendu :** Le bouton retour n'est plus visible (normal, vous êtes en communication)

### Test 6 : Gestion des erreurs

**Étapes :**
1. Lancez un appel
2. Pendant l'appel, lancez un autre appel depuis une autre conversation
3. **Résultat attendu :**
   - Le deuxième appel est automatiquement rejeté
   - Message d'erreur : "Un appel est déjà en cours"
   - Le premier appel continue

**Vérifications dans les logs :**
```
[CallService] Call already in progress, rejecting incoming call
[CallService] Rejecting call: ...
```

## Points de vérification

### Interface
- [ ] Le bouton d'appel est visible dans le header du chat (conversations directes uniquement)
- [ ] Le bouton a un design cohérent (cercle orange avec ombre)
- [ ] L'écran d'appel s'affiche correctement avec le gradient
- [ ] Les animations fonctionnent (pulsation pendant "ringing")
- [ ] Le timer s'affiche et s'incrémente correctement

### Fonctionnalités
- [ ] Les appels sortants se lancent correctement
- [ ] Les appels entrants affichent la notification
- [ ] Les contrôles (mute, speaker, raccrocher) fonctionnent
- [ ] La navigation entre les écrans fonctionne
- [ ] Les états d'appel changent correctement

### WebSocket
- [ ] Les logs montrent que le CallService s'initialise avec le WebSocket
- [ ] Les logs montrent que le channel `calls:{userId}` est joint
- [ ] Les événements sont envoyés via WebSocket (offer, answer, etc.)

### Logs à surveiller

Dans la console Expo, vous devriez voir :
```
[CallService] Initialized
[ConversationsListScreen] Initializing CallService signaling
[CallService] Initializing signaling with socket for user: user-1
[CallService] Joined calls channel
[CallService] react-native-webrtc not available, using demo mode
[CallService] Demo mode: creating mock stream
```

## Mode démo vs Production

**Mode actuel (Expo Go) :**
- ✅ Interface complète fonctionnelle
- ✅ WebSocket signaling intégré
- ✅ États d'appel gérés
- ⚠️ Pas de vraie connexion audio (mode démo)
- ⚠️ Pas de vraie WebRTC (nécessite dev build)

**Pour la production :**
- Créer un développement build avec `expo build` ou `eas build`
- Le module `react-native-webrtc` fonctionnera alors
- Les vraies connexions audio/vidéo seront possibles
- Nécessite des serveurs STUN/TURN configurés

## Commandes de test rapides

```bash
# Démarrer l'app
cd mobile-app/Frontend
npm start

# Puis appuyez sur :
# - 'a' pour Android
# - 'i' pour iOS  
# - 'w' pour Web
# - Scannez le QR code avec Expo Go
```

## Dépannage

**Problème : Le bouton d'appel n'apparaît pas**
- Vérifiez que vous êtes dans une conversation directe (pas un groupe)
- Vérifiez les logs pour voir si `onCallPress` est bien passé

**Problème : L'écran d'appel ne s'affiche pas**
- Vérifiez les logs pour voir si `useCallManager` détecte le changement d'état
- Vérifiez que la navigation inclut bien `AudioCall` screen

**Problème : Les appels entrants ne fonctionnent pas**
- Vérifiez que `CallService.initializeSignaling()` est appelé
- Vérifiez les logs pour voir si le channel `calls:{userId}` est joint
