# Planification des Sprints - Application Mobile Whispr

## Vue d'ensemble

Ce document structure les écrans et fonctionnalités restants à implémenter pour l'application mobile Whispr, organisés en sprints avec estimations de durée.

## État actuel - Écrans implémentés

### ✅ Écrans déjà implémentés
1. **SplashScreen** - Écran de démarrage
2. **LoginScreen** - Connexion avec numéro de téléphone
3. **RegistrationScreen** - Inscription
4. **VerificationScreen** - Vérification SMS
5. **ProfileSetupScreen** - Configuration initiale du profil
6. **ProfileScreen** - Gestion du profil utilisateur
7. **SettingsScreen** - Paramètres de l'application
8. **SecurityKeysScreen** - Gestion des clés de sécurité
9. **TwoFactorAuthScreen** - Authentification à deux facteurs
10. **ConversationsListScreen** - Liste des conversations
11. **ContactsScreen** - Gestion des contacts (WHISPR-208) ✅
12. **BlockedUsersScreen** - Utilisateurs bloqués (WHISPR-208) ✅

---

## Écrans et fonctionnalités restants à implémenter

### 📱 SPRINT 1 : Chat et Messagerie (2 semaines - 10 jours)

#### WHISPR-209 : Écran de conversation individuelle (ChatScreen)
**Durée estimée : 3 jours**
- Interface de chat avec messages texte
- Affichage des messages envoyés/reçus
- Input de message avec envoi
- Indicateurs de statut (envoi, livré, lu)
- Scroll automatique vers le bas
- Pull-to-refresh pour charger l'historique
- Animations d'envoi/réception

**User Stories :**
- En tant qu'utilisateur, je veux voir l'historique des messages dans une conversation
- En tant qu'utilisateur, je veux envoyer des messages texte
- En tant qu'utilisateur, je veux voir le statut de mes messages (envoi, livré, lu)

**Points Story :** 5 points

---

#### WHISPR-210 : Actions sur les messages
**Durée estimée : 2 jours**
- Menu contextuel sur long press (répondre, modifier, supprimer, réagir)
- Réponse à un message (reply preview)
- Modification de message (avec indicateur "modifié")
- Suppression pour moi / pour tous
- Réactions emoji aux messages
- Barre de réactions

**User Stories :**
- En tant qu'utilisateur, je veux répondre à un message spécifique
- En tant qu'utilisateur, je veux modifier un message après l'avoir envoyé
- En tant qu'utilisateur, je veux supprimer un message pour moi ou pour tous
- En tant qu'utilisateur, je veux réagir avec des emojis aux messages

**Points Story :** 5 points

---

#### WHISPR-211 : Messages épinglés
**Durée estimée : 1 jour**
- Barre de messages épinglés dans le chat
- Épingler/désépingler un message
- Affichage des messages épinglés en haut du chat
- Navigation vers le message épinglé

**User Stories :**
- En tant qu'utilisateur, je veux épingler des messages importants
- En tant qu'utilisateur, je veux voir les messages épinglés facilement

**Points Story :** 3 points

---

#### WHISPR-212 : Recherche dans les messages
**Durée estimée : 2 jours**
- Barre de recherche dans le chat
- Recherche par mot-clé dans l'historique
- Navigation entre résultats
- Surlignage des termes trouvés
- Recherche dans toutes les conversations

**User Stories :**
- En tant qu'utilisateur, je veux rechercher des messages par mot-clé
- En tant qu'utilisateur, je veux naviguer entre les résultats de recherche

**Points Story :** 3 points

---

#### WHISPR-213 : Indicateur de frappe (Typing Indicator)
**Durée estimée : 1 jour**
- Affichage "X est en train d'écrire..."
- Intégration WebSocket pour temps réel
- Animation de l'indicateur

**User Stories :**
- En tant qu'utilisateur, je veux savoir quand mon contact est en train d'écrire

**Points Story :** 2 points

---

#### WHISPR-214 : Formatage de texte
**Durée estimée : 1 jour**
- Support Markdown (gras, italique, code)
- Prévisualisation du formatage
- Parser Markdown dans l'affichage

**User Stories :**
- En tant qu'utilisateur, je veux formater mon texte (gras, italique, etc.)

**Points Story :** 2 points

---

### 📱 SPRINT 2 : Médias et Partage (2 semaines - 10 jours)

#### WHISPR-215 : Sélecteur de médias
**Durée estimée : 2 jours**
- Sélection de photos depuis la galerie
- Sélection de vidéos
- Sélection de documents
- Sélection multiple
- Prévisualisation avant envoi
- Compression des images

**User Stories :**
- En tant qu'utilisateur, je veux sélectionner des photos de ma galerie
- En tant qu'utilisateur, je veux sélectionner des vidéos
- En tant qu'utilisateur, je veux sélectionner des documents

**Points Story :** 5 points

---

#### WHISPR-216 : Caméra intégrée
**Durée estimée : 2 jours**
- Prendre une photo directement depuis l'app
- Enregistrer une vidéo
- Prévisualisation avant envoi
- Flash, retournement caméra
- Légende avant envoi

**User Stories :**
- En tant qu'utilisateur, je veux prendre une photo directement depuis l'application
- En tant qu'utilisateur, je veux ajouter une légende à mes médias

**Points Story :** 5 points

---

#### WHISPR-217 : Visualiseur de médias
**Durée estimée : 2 jours**
- Vue plein écran des médias
- Zoom et pan sur les images
- Lecture vidéo intégrée
- Navigation entre médias (swipe)
- Partage et téléchargement

**User Stories :**
- En tant qu'utilisateur, je veux voir mes médias en plein écran
- En tant qu'utilisateur, je veux zoomer sur les images

**Points Story :** 5 points

---

#### WHISPR-218 : Galerie de médias dans le chat
**Durée estimée : 2 jours**
- Vue de tous les médias partagés dans une conversation
- Grille de miniatures
- Filtres (photos, vidéos, documents)
- Navigation vers le message source

**User Stories :**
- En tant qu'utilisateur, je veux consulter tous les médias partagés dans une conversation

**Points Story :** 3 points

---

#### WHISPR-219 : Envoi de médias avec progression
**Durée estimée : 2 jours**
- Barre de progression pour upload
- Indicateur d'envoi en cours
- Possibilité d'annuler l'envoi
- Gestion des erreurs de transfert
- Retry automatique

**User Stories :**
- En tant qu'utilisateur, je veux voir la progression de l'envoi des médias
- En tant qu'utilisateur, je veux pouvoir annuler l'envoi d'un média

**Points Story :** 3 points

---

### 📱 SPRINT 3 : Groupes (2 semaines - 10 jours)

#### WHISPR-220 : Création de groupe
**Durée estimée : 3 jours**
- Interface de création de groupe
- Sélection de membres (multi-select)
- Nom du groupe
- Photo de groupe (sélection ou caméra)
- Validation et création

**User Stories :**
- En tant qu'utilisateur, je veux créer un groupe de conversation
- En tant qu'administrateur, je veux définir un nom et une photo pour le groupe

**Points Story :** 5 points

---

#### WHISPR-221 : Gestion de groupe
**Durée estimée : 3 jours**
- Écran de détails du groupe
- Liste des membres avec rôles
- Ajout de membres
- Suppression de membres (admin)
- Transfert des droits d'administration
- Modification nom/photo (admin)

**User Stories :**
- En tant qu'administrateur, je veux ajouter des membres au groupe
- En tant qu'administrateur, je veux supprimer des membres
- En tant qu'administrateur, je veux déléguer mes droits à un autre utilisateur

**Points Story :** 8 points

---

#### WHISPR-222 : Détails et informations du groupe
**Durée estimée : 2 jours**
- Informations du groupe (nom, photo, description)
- Liste complète des membres
- Statistiques (nombre de messages, membres)
- Historique des modifications
- Paramètres de groupe

**User Stories :**
- En tant qu'utilisateur, je veux voir les informations du groupe
- En tant qu'utilisateur, je veux voir la liste des membres

**Points Story :** 3 points

---

#### WHISPR-223 : Quitter/Supprimer un groupe
**Durée estimée : 1 jour**
- Option quitter le groupe
- Option supprimer le groupe (admin uniquement)
- Confirmation avant action
- Gestion des messages après quitter/supprimer

**User Stories :**
- En tant qu'utilisateur, je veux pouvoir quitter un groupe
- En tant qu'administrateur, je veux pouvoir supprimer complètement un groupe

**Points Story :** 3 points

---

#### WHISPR-224 : Mentions dans les groupes
**Durée estimée : 1 jour**
- Autocomplétion @username
- Liste des membres pour mention
- Notification des mentions
- Surlignage des messages avec mention

**User Stories :**
- En tant qu'utilisateur dans un groupe, je veux mentionner (@) des membres spécifiques

**Points Story :** 3 points

---

### 📱 SPRINT 4 : QR Code et Contacts avancés (1 semaine - 5 jours)

#### WHISPR-225 : Scanner QR code
**Durée estimée : 2 jours**
- Interface de scan QR code
- Permissions caméra
- Détection et parsing QR code
- Ajout automatique de contact
- Gestion des erreurs (QR invalide)

**User Stories :**
- En tant qu'utilisateur, je veux scanner un QR code pour ajouter un contact

**Points Story :** 5 points

---

#### WHISPR-226 : Génération QR code
**Durée estimée : 1 jour**
- Génération du QR code personnel
- Affichage du QR code
- Partage du QR code (image)
- Informations utilisateur dans le QR

**User Stories :**
- En tant qu'utilisateur, je veux générer mon QR code pour être ajouté par d'autres

**Points Story :** 3 points

---

#### WHISPR-227 : Améliorations contacts
**Durée estimée : 2 jours**
- Tri des contacts (nom, récemment ajoutés, actifs)
- Filtres avancés
- Export des contacts
- Statistiques détaillées (déjà fait partiellement)

**User Stories :**
- En tant qu'utilisateur, je veux trier mes contacts par nom ou par heure de connexion

**Points Story :** 3 points

---

### 📱 SPRINT 5 : Notifications et Paramètres avancés (1 semaine - 5 jours)

#### WHISPR-228 : Paramètres de notifications
**Durée estimée : 2 jours**
- Configuration des sons de notification
- Notifications par conversation (activer/désactiver)
- Mode Ne pas déranger temporaire
- Paramètres de notification push
- Prévisualisation des sons

**User Stories :**
- En tant qu'utilisateur, je veux personnaliser le son des notifications
- En tant qu'utilisateur, je veux activer/désactiver les notifications pour des conversations spécifiques
- En tant qu'utilisateur, je veux désactiver les notifications pour une période déterminée

**Points Story :** 5 points

---

#### WHISPR-229 : Paramètres de confidentialité avancés
**Durée estimée : 2 jours**
- Visibilité photo de profil (tous, contacts, personne)
- Visibilité prénom (tous, contacts, personne)
- Visibilité nom (tous, contacts, personne)
- Visibilité biographie (tous, contacts, personne)
- Visibilité dans la recherche (par téléphone, par username)
- Prévisualisation du profil selon les paramètres

**User Stories :**
- En tant qu'utilisateur, je veux choisir qui peut voir ma photo de profil
- En tant qu'utilisateur, je veux contrôler si mon profil apparaît dans les résultats de recherche

**Points Story :** 5 points

---

#### WHISPR-230 : Paramètres d'application
**Durée estimée : 1 jour**
- Langue de l'application
- Thème (clair/sombre)
- Taille du texte
- Auto-play des médias
- Sauvegarde automatique

**User Stories :**
- En tant qu'utilisateur, je veux modifier la langue de l'application
- En tant qu'utilisateur, je veux configurer le thème (clair/sombre)

**Points Story :** 3 points

---

### 📱 SPRINT 6 : Appels (optionnel - si prévu dans specs) (1 semaine - 5 jours)

#### WHISPR-231 : Écran d'appel audio
**Durée estimée : 3 jours**
- Interface d'appel entrant/sortant
- Contrôles (mute, haut-parleur, raccrocher)
- Durée de l'appel
- État de connexion
- Intégration WebRTC (si backend supporte)

**User Stories :**
- En tant qu'utilisateur, je veux passer des appels audio

**Points Story :** 8 points

---

#### WHISPR-232 : Écran d'appel vidéo
**Durée estimée : 2 jours**
- Interface d'appel vidéo
- Vue locale et distante
- Basculer caméra avant/arrière
- Contrôles vidéo (mute, caméra, raccrocher)
- Intégration WebRTC (si backend supporte)

**User Stories :**
- En tant qu'utilisateur, je veux passer des appels vidéo

**Points Story :** 8 points

---

## Résumé des sprints

| Sprint | Thème | Durée | Points Story | Tickets |
|--------|-------|-------|--------------|---------|
| **Sprint 1** | Chat et Messagerie | 2 semaines | 20 points | WHISPR-209 à 214 |
| **Sprint 2** | Médias et Partage | 2 semaines | 21 points | WHISPR-215 à 219 |
| **Sprint 3** | Groupes | 2 semaines | 22 points | WHISPR-220 à 224 |
| **Sprint 4** | QR Code et Contacts | 1 semaine | 11 points | WHISPR-225 à 227 |
| **Sprint 5** | Notifications et Paramètres | 1 semaine | 13 points | WHISPR-228 à 230 |
| **Sprint 6** | Appels (optionnel) | 1 semaine | 16 points | WHISPR-231 à 232 |
| **TOTAL** | | **9 semaines** | **103 points** | **24 tickets** |

---

## Priorisation recommandée

### 🔴 Priorité Haute (MVP)
- Sprint 1 : Chat et Messagerie (essentiel)
- Sprint 2 : Médias et Partage (essentiel)
- Sprint 3 : Groupes (essentiel)

### 🟡 Priorité Moyenne
- Sprint 4 : QR Code et Contacts avancés
- Sprint 5 : Notifications et Paramètres avancés

### 🟢 Priorité Basse (Nice to have)
- Sprint 6 : Appels (si prévu dans les specs)

---

## Notes importantes

1. **Dépendances** : Certains tickets dépendent d'autres (ex: ChatScreen avant actions sur messages)
2. **Backend** : Vérifier que les APIs backend sont disponibles pour chaque sprint
3. **Tests** : Prévoir du temps pour les tests unitaires et d'intégration
4. **Design** : S'assurer que les maquettes Figma sont disponibles avant chaque sprint
5. **WebSocket** : L'intégration WebSocket pour le temps réel doit être prête pour le Sprint 1

---

## Format Jira recommandé

Chaque ticket devrait contenir :
- **Titre** : [WHISPR-XXX] Description courte
- **Type** : Story / Task / Bug
- **Description** : Contexte et objectifs
- **User Stories** : Format "En tant que... je veux... afin de..."
- **Critères d'acceptation** : Liste de vérification
- **Points Story** : Estimation en points
- **Sprint** : Sprint assigné
- **Labels** : mobile, frontend, react-native
- **Équipe** : Team Mobile

---

*Document créé le : [Date]*
*Dernière mise à jour : [Date]*









