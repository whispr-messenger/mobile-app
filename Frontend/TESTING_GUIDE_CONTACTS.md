# Guide de Test - Écran Contacts (WHISPR-208)

## 📋 Vue d'ensemble

Ce guide de test couvre toutes les fonctionnalités de l'écran Contacts selon les spécifications techniques et les mocks implémentés.

---

## 1. 📱 Navigation et Accès

### Tests à effectuer :
- [ ] **Accès depuis la barre de navigation** : Cliquer sur l'onglet "Contacts" en bas
- [ ] **Navigation depuis autres écrans** : Vérifier que la navigation fonctionne
- [ ] **Retour arrière** : Le bouton retour fonctionne correctement

### Résultat attendu :
- L'écran Contacts s'affiche avec le header, la barre de recherche et la liste

---

## 2. 📋 Liste des Contacts

### Tests à effectuer :
- [ ] **Affichage de la liste** : Les contacts mock s'affichent correctement
- [ ] **Avatars** : Les avatars s'affichent (ou initiales si pas d'image)
- [ ] **Noms** : Les noms/username s'affichent correctement
- [ ] **Favoris** : Les contacts favoris ont une étoile visible
- [ ] **Pull to refresh** : Tirer vers le bas pour rafraîchir la liste

### Résultat attendu :
- Liste de contacts avec toutes les informations visibles
- Animation de rafraîchissement fonctionnelle

---

## 3. 🔍 Recherche de Contacts

### Tests à effectuer :
- [ ] **Recherche par nom** : Taper un nom dans la barre de recherche
- [ ] **Recherche par username** : Taper un username (avec @ ou sans)
- [ ] **Recherche par surnom** : Taper un surnom personnalisé
- [ ] **Recherche vide** : Effacer la recherche, tous les contacts réapparaissent
- [ ] **Recherche sans résultat** : Taper un terme qui n'existe pas
- [ ] **Recherche en temps réel** : La liste se filtre pendant la saisie

### Résultat attendu :
- Filtrage instantané des résultats
- Message "Aucun contact trouvé" si aucun résultat
- Bouton X pour effacer la recherche

---

## 4. ⭐ Filtre Favoris

### Tests à effectuer :
- [ ] **Activer le filtre** : Cliquer sur le bouton "Favoris"
- [ ] **Vérifier l'affichage** : Seuls les favoris s'affichent
- [ ] **Désactiver le filtre** : Cliquer à nouveau, tous les contacts réapparaissent
- [ ] **Combinaison recherche + favoris** : Rechercher parmi les favoris uniquement

### Résultat attendu :
- Le bouton change d'apparence quand actif
- Filtrage correct des favoris
- Compteur correct du nombre de favoris

---

## 5. ➕ Ajout de Contact

### Tests à effectuer :
- [ ] **Ouvrir le modal** : Cliquer sur le bouton "+" en haut à droite
- [ ] **Recherche d'utilisateur** : Taper un username dans le champ de recherche
- [ ] **Résultats de recherche** : Vérifier que les utilisateurs s'affichent
- [ ] **Ajouter un contact** : Cliquer sur "Ajouter" pour un utilisateur
- [ ] **Confirmation** : Vérifier le message de succès
- [ ] **Vérification dans la liste** : Le nouveau contact apparaît dans la liste
- [ ] **Ajouter un contact déjà présent** : Vérifier le message d'erreur
- [ ] **Fermer le modal** : Le bouton X ferme le modal

### Résultat attendu :
- Modal s'ouvre correctement
- Recherche fonctionne
- Contact ajouté avec succès
- Message d'erreur si contact déjà existant

---

## 6. ✏️ Modification de Contact

### Tests à effectuer :
- [ ] **Ouvrir le modal d'édition** : Appuyer longuement sur un contact
- [ ] **Modifier le surnom** : Changer le surnom dans le champ
- [ ] **Enregistrer** : Cliquer sur "Enregistrer"
- [ ] **Vérifier la modification** : Le surnom apparaît dans la liste
- [ ] **Toggle favori** : Activer/désactiver le favori
- [ ] **Vérifier le favori** : L'étoile apparaît/disparaît dans la liste
- [ ] **Annuler** : Fermer sans enregistrer, les modifications sont perdues

### Résultat attendu :
- Modal d'édition s'ouvre avec les bonnes informations
- Modifications sauvegardées correctement
- Favori mis à jour immédiatement

---

## 7. 🗑️ Suppression de Contact

### Tests à effectuer :
- [ ] **Ouvrir le modal d'édition** : Appuyer longuement sur un contact
- [ ] **Cliquer sur "Supprimer"** : Le bouton rouge en bas
- [ ] **Confirmer la suppression** : Dans l'alerte de confirmation
- [ ] **Vérifier la suppression** : Le contact disparaît de la liste
- [ ] **Annuler la suppression** : Cliquer sur "Annuler" dans l'alerte

### Résultat attendu :
- Alerte de confirmation s'affiche
- Contact supprimé après confirmation
- Contact reste si annulation

---

## 8. 🔄 Synchronisation des Contacts Téléphoniques

### ⚠️ Tests Critiques selon les Spécifications Techniques :

#### 8.1 Permission
- [ ] **Première demande** : Cliquer sur "Synchroniser", la permission est demandée
- [ ] **Accepter la permission** : Autoriser l'accès aux contacts
- [ ] **Refuser la permission** : Refuser, vérifier le message et le bouton "Ouvrir les paramètres"
- [ ] **Permission déjà refusée** : Si refusée, ne redemande pas, affiche le message approprié
- [ ] **Ouvrir les paramètres** : Le bouton ouvre les paramètres de l'app

#### 8.2 Normalisation E.164 (Spécification Technique)
- [ ] **Numéros français** : Vérifier que `0612345678` devient `+33612345678`
- [ ] **Numéros internationaux** : Vérifier que `+33612345678` reste `+33612345678`
- [ ] **Numéros avec espaces** : Vérifier que `06 12 34 56 78` devient `+33612345678`
- [ ] **Numéros avec tirets** : Vérifier que `06-12-34-56-78` devient `+33612345678`
- [ ] **Numéros avec parenthèses** : Vérifier que `(06) 12 34 56 78` devient `+33612345678`

#### 8.3 Hachage SHA-256 (Spécification Technique)
- [ ] **Vérifier que les hash sont générés** : Les numéros sont hashés avant envoi
- [ ] **Vérifier le format** : Les hash sont en hexadécimal (SHA-256)
- [ ] **Vérifier que les numéros ne sont pas envoyés en clair** : Seuls les hash sont transmis à l'API

#### 8.4 Limite de 1000 numéros (Spécification Technique)
- [ ] **Moins de 1000 contacts** : Tous les contacts sont traités
- [ ] **Plus de 1000 contacts** : Alerte affichée, seuls les 1000 premiers sont traités
- [ ] **Message d'alerte** : Le message indique le nombre total et la limitation

#### 8.5 Correspondances et Sélection
- [ ] **Affichage des correspondances** : Les utilisateurs Whispr correspondants s'affichent
- [ ] **Sélection multiple** : Sélectionner plusieurs contacts
- [ ] **Désélection** : Désélectionner un contact
- [ ] **Bouton d'ajout** : Le bouton affiche le nombre de contacts sélectionnés
- [ ] **Synchronisation** : Cliquer sur "Ajouter X contact(s)"
- [ ] **Confirmation** : Message de succès avec le nombre de contacts ajoutés

#### 8.6 Option "Ne plus suggérer" (Spécification Technique)
- [ ] **Bouton X** : Chaque contact a un bouton X pour le rejeter
- [ ] **Rejeter un contact** : Cliquer sur X, le contact disparaît de la liste
- [ ] **Rejeter plusieurs** : Rejeter plusieurs contacts
- [ ] **Persistance** : Les contacts rejetés ne réapparaissent pas si on rouvre le modal
- [ ] **Réouverture du modal** : Les contacts rejetés restent cachés

### Résultat attendu :
- Normalisation E.164 correcte pour tous les formats
- Hash SHA-256 générés correctement
- Seuls les hash sont envoyés à l'API
- Limite de 1000 respectée avec alerte
- Option "ne plus suggérer" fonctionnelle

---

## 9. 🚫 Blocage d'Utilisateurs

### Tests à effectuer :
- [ ] **Bloquer depuis l'édition** : Dans le modal d'édition, cliquer sur "Bloquer l'utilisateur"
- [ ] **Confirmation** : Confirmer dans l'alerte
- [ ] **Vérifier le blocage** : Le contact est bloqué
- [ ] **Accéder à la liste des bloqués** : Cliquer sur "Bloqués" dans les filtres
- [ ] **Voir les utilisateurs bloqués** : La liste s'affiche
- [ ] **Débloquer** : Cliquer sur "Débloquer" pour un utilisateur
- [ ] **Confirmation** : Confirmer le déblocage
- [ ] **Vérifier le déblocage** : L'utilisateur disparaît de la liste des bloqués

### Résultat attendu :
- Blocage fonctionne avec confirmation
- Liste des bloqués s'affiche correctement
- Déblocage fonctionne avec confirmation

---

## 10. 🎨 Interface et UX

### Tests à effectuer :
- [ ] **Thème sombre** : Les couleurs sont cohérentes avec le thème
- [ ] **Gradients** : Les gradients orange/coral s'affichent correctement
- [ ] **Boutons** : Les boutons "Bloquer" et "Supprimer" ont les bonnes couleurs (orange)
- [ ] **Animations** : Les transitions sont fluides
- [ ] **États vides** : Les messages d'état vide s'affichent correctement
- [ ] **Loading states** : Les indicateurs de chargement s'affichent
- [ ] **Erreurs** : Les messages d'erreur sont clairs

### Résultat attendu :
- Interface cohérente avec le design system
- Animations fluides
- Messages clairs pour tous les états

---

## 11. 🔒 Sécurité et Confidentialité (Spécifications Techniques)

### Tests Critiques :
- [ ] **Numéros jamais en clair** : Vérifier dans les logs/network que seuls les hash sont envoyés
- [ ] **Hash SHA-256** : Vérifier que les hash sont bien en SHA-256 (64 caractères hex)
- [ ] **Sel statique** : Vérifier que le sel est utilisé (même numéro = même hash)
- [ ] **Normalisation avant hash** : Vérifier que la normalisation E.164 est faite avant le hash

### Résultat attendu :
- Aucun numéro de téléphone en clair dans les requêtes API
- Hash correctement générés selon les spécifications

---

## 12. 🐛 Cas Limites et Erreurs

### Tests à effectuer :
- [ ] **Pas de contacts** : Vérifier l'état vide
- [ ] **Pas de correspondances** : Vérifier le message dans la synchronisation
- [ ] **Erreur réseau** : Simuler une erreur réseau (désactiver le réseau)
- [ ] **Contact déjà ajouté** : Essayer d'ajouter un contact existant
- [ ] **Utilisateur bloqué** : Essayer d'ajouter un utilisateur bloqué
- [ ] **Champ vide** : Essayer d'enregistrer avec des champs vides

### Résultat attendu :
- Messages d'erreur clairs et appropriés
- L'application ne crash pas
- États de chargement appropriés

---

## 📊 Checklist de Conformité aux Spécifications

### Spécifications Techniques Respectées :
- [x] Normalisation E.164 des numéros de téléphone
- [x] Hachage SHA-256 avec sel statique
- [x] Transmission uniquement des hash (jamais de numéros en clair)
- [x] Limite de 1000 numéros par requête
- [x] Option "ne plus suggérer" pour ignorer des contacts
- [x] Consentement explicite pour la synchronisation
- [x] Gestion des permissions (ne pas redemander si refusé)
- [x] Sélection manuelle des contacts à ajouter

### Fonctionnalités Implémentées :
- [x] Liste des contacts avec recherche
- [x] Filtre favoris
- [x] Ajout de contact (par username)
- [x] Modification de contact (nickname, favori)
- [x] Suppression de contact
- [x] Synchronisation des contacts téléphoniques
- [x] Blocage/déblocage d'utilisateurs
- [x] Écran de gestion des utilisateurs bloqués

---

## 🎯 Points d'Attention Spéciaux

1. **Normalisation E.164** : Tester avec différents formats de numéros français et internationaux
2. **Hachage** : Vérifier que les hash sont cohérents (même numéro = même hash)
3. **Limite 1000** : Tester avec un grand nombre de contacts si possible
4. **Permissions** : Tester tous les scénarios de permissions (première fois, refus, acceptation)
5. **"Ne plus suggérer"** : Vérifier que les contacts rejetés ne réapparaissent pas

---

## 📝 Notes de Test

**Date de test** : _______________
**Testeur** : _______________
**Version** : _______________
**Plateforme** : iOS / Android / Les deux

**Résultats** :
- ✅ Tous les tests passent
- ⚠️ Problèmes mineurs (détailler ci-dessous)
- ❌ Problèmes critiques (détailler ci-dessous)

**Commentaires** :
_________________________________________________
_________________________________________________
_________________________________________________

