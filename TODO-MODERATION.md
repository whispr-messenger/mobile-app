# Moderation mobile — A faire

## Contexte

La gate pre-envoi dans `src/services/moderation/` utilise un modele TFLite de demo
entraine sur des images de nourriture (burger, pizza, frites...). Il ne detecte rien
d'utile pour la moderation NSFW.

La moderation serveur (NudeNet dans moderation-service) est fonctionnelle et gere
le filtrage reel. La gate mobile est un bonus pour eviter les uploads inutiles.

## Ce qu'il faut faire

1. Remplacer `assets/models/whispr.tflite` par un modele NSFW au format TFLite
   - Option : convertir NudeNet (ONNX) vers TFLite via tf-lite converter
   - Option : utiliser un modele plus leger type NSFW-classifier-lite
   - Le modele doit sortir des classes unsafe avec un score de confiance

2. Mettre a jour les labels dans `src/services/moderation/tflite.service.ts`
   - Lignes 25-33 : remplacer les classes food par les classes NSFW
   - Adapter le seuil de blocage (actuellement 0.99, probablement trop haut)

3. Tester que la gate bloque bien les images NSFW avant upload

## Fichiers concernes

- `assets/models/whispr.tflite` — le modele a remplacer
- `src/services/moderation/tflite.service.ts` — labels et seuil
- `src/services/moderation/gate-chat-image.ts` — logique de gate (pas de modif normalement)
- `src/screens/Chat/ChatScreen.tsx` — deja branche, rien a changer

## En attendant

La moderation fonctionne cote serveur via NudeNet. La gate mobile laisse tout passer
(le modele food ne matche jamais sur des vraies images). Pas de risque.
