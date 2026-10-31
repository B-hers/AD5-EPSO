# AD5 Training — tests de raisonnement EPSO AD5

Application web installable (PWA), sans compte ni serveur. Fonctionne hors ligne après le premier chargement complet.

## Lancer en local
    node tools/serve.js        # puis ouvrir http://localhost:8080
(Node 18+ ; aucune dépendance.)

## Mettre en ligne (hébergement statique HTTPS)
Déposer le dossier tel quel sur Netlify, Cloudflare Pages, GitHub Pages ou tout hébergeur statique HTTPS. Le HTTPS est indispensable pour l'installation et le mode hors ligne. À chaque publication, changer `VERSION` dans `sw.js` : les utilisateurs voient alors « Mettre à jour ».

## Mettre en ligne sur GitHub Pages
1. Créer un compte sur github.com, puis un nouveau dépôt **public** (GitHub Pages gratuit exige un dépôt public ; le dépôt ne contient que l'application et les questions, jamais la progression, qui reste dans l'appareil).
2. « Add file » → « Upload files » : glisser le **contenu** du dossier (pas le dossier lui-même ; `index.html` doit être à la racine), puis « Commit changes ».
3. Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)` → Save.
4. Après 1 à 2 minutes, l'adresse `https://VOTRE-NOM.github.io/NOM-DU-DEPOT/` apparaît : ouvrir cette adresse sur le téléphone, laisser charger, puis installer.
5. Mise à jour : remplacer les fichiers modifiés et changer `VERSION` dans `sw.js`.

## Installer
- iPhone : Safari → Partager → « Sur l'écran d'accueil ».
- Android / ordinateur : menu du navigateur → « Installer l'application ».

## Contenu (lot 1)
- 100 questions numériques, 100 abstraites, 75 verbales (lots 1 à 3 sur 4 ; 100 visées).
- Entraînement (catégorie, difficulté, nombre, chronos par question / de session, correction masquée), examen blanc, « Mes erreurs », favoris, export/import de la progression (stockage local de l'appareil).

## Vérifier
    node tools/validate.js     # contrôle la banque et écrit VALIDATION_REPORT.md
    node --test tests/*.test.js
    python3 tests/e2e.py       # nécessite Playwright, serveur lancé sur :8080

## Régénérer les questions
    node tools/gen-numerical.js && node tools/gen-abstract.js && node tools/gen-verbal.js
Génération déterministe (graine fixe).

## Limites connues
Voir `VALIDATION_REPORT.md` (installation sur appareils non testée, relecture humaine à faire).
