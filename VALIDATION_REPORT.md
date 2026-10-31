# Rapport de validation automatique

Généré le 2026-10-30T10:00:31.118Z

| Catégorie | Questions | Objectif | Passent tous les contrôles automatiques | Par difficulté |
|---|---|---|---|---|
| verbal | 75 | 100 | 75 | {"1":12,"2":32,"3":26,"4":5} |
| numerical | 100 | 100 | 100 | {"1":20,"2":50,"3":30} |
| abstract | 100 | 100 | 100 | {"1":25,"2":25,"3":25,"4":25} |

## Aucune erreur détectée par les contrôles automatiques.

## Portée des contrôles

- Tous : unicité des identifiants, propriétés obligatoires, 4 propositions, identifiant de réponse valide, explication présente, doublons.
- Numérique : le résultat est recalculé à partir de l'expression `calc` ; une seule proposition égale à la bonne valeur ; l'explication cite la réponse ; cohérence tableaux/graphiques.
- Abstrait : les images affichées et la figure attendue sont recalculées à partir des règles ; une seule proposition satisfait les règles ; propositions visuellement distinctes ; cycles répétés dans la suite affichée.

## Ce que les contrôles ne prouvent pas

- Le calcul indépendant des questions numériques réutilise la même formule que celle de la génération : il détecte les incohérences (arrondis, mauvais choix de réponse, explications), pas une erreur de conception de la formule elle-même. Une relecture humaine d'un échantillon reste nécessaire.
- Pour l'abstrait, l'unicité est garantie par rapport aux règles définies ; la condition de répétition des cycles limite, sans les exclure totalement, les lectures alternatives d'une suite.
- Verbal : texte présent et de longueur compatible avec un écran de téléphone, 4 propositions distinctes, explication désignant la bonne lettre. La justesse logique de chaque réponse n'est PAS vérifiable automatiquement : elle repose sur la relecture, voir ci-dessous.

## Tests exécutés

- `npm test` : 9 tests Node, tous réussis — moteur de règles, symétries, rendu SVG des 8 formes, recalcul des 100 réponses numériques, unicité de la bonne réponse sur les 100 questions abstraites, validateur, répartition des réponses verbales, recalcul des réponses chiffrées du verbal.
- `tests/e2e.py` (Playwright, Chromium, viewport mobile 390×844) : 16 contrôles réussis, exécutés trois fois de suite — accueil, 3 catégories, verbal / numérique / abstrait, correction et explication, chronomètre par question (décompte puis « Temps écoulé »), chronomètre désactivé, progression conservée après rechargement, examen blanc à trois tests (35:00 en verbal), service worker actif, **rechargement hors ligne**, aucune erreur JavaScript.
- Défauts trouvés et corrigés en cours de route : rechargement de la page à la première installation du service worker ; collision de classe CSS (figures de réponse en pleine largeur) ; conversion de lettres qui faussait une explication verbale ; répartition biaisée des bonnes réponses (14 B sur 25).

## Non testé

- Installation réelle sur iPhone (Safari), Android (Chrome), Windows et macOS : seul Chromium simulé a été utilisé.
- Chronomètre lors d'un vrai verrouillage de téléphone (calcul basé sur `Date.now()` ; la reprise au retour est codée, pas éprouvée sur appareil).
- Import/export de la progression : codé, non exécuté dans le test automatisé.
- Relecture humaine indépendante des questions : aucune.

## État de la banque

| Catégorie | État |
|---|---|
| Verbal | **75 questions sur 100** (lots 1 à 3 sur 4). 57 questions à 4 propositions et 18 affirmations « vrai / faux / impossible à déterminer » (3 propositions, sous-type `vfi_*`). Textes de 18 à 75 mots. Bonnes réponses : 4 propositions A/B/C/D = 15/14/14/14 ; V/F/I = 7/6/5. |
| Numérique | 100 questions issues de 20 familles de problèmes × 5 variantes (contextes, données et pièges distincts). Les mécanismes se répètent : ce ne sont pas 100 questions entièrement singulières. |
| Abstrait | 100 questions générées par règles explicites, 25 par niveau. Suites de 4 ou 5 figures, 4 propositions. Matrices 3×3 non couvertes. |

## Format d'examen

Confirmé dans l'avis de concours EPSO/AD/427/26 (JO C/2026/711, tableau 2) : verbal 20 questions / 35 min ; numérique 10 / 20 min ; abstrait 10 / 10 min ; seuils 10/20 en verbal et 10/20 cumulés en numérique + abstrait. Certains sites décrivent un bloc unique de 30 min pour numérique + abstrait ; le tableau officiel donne deux durées séparées, c'est ce qui est appliqué. La possibilité de revenir sur une question n'est pas précisée dans les extraits lus : la navigation libre dans un test est une hypothèse d'entraînement.

## Format des questions verbales : point non tranché

La page d'exemples officielle d'EPSO charge ses questions dans un lecteur TAO que je n'ai pas pu lire, et le lien de session transmis est personnel. Les sites de préparation décrivent le plus souvent des affirmations à classer vrai / faux / impossible à déterminer ; une autre source indique que les propositions ne portent pas ces étiquettes. Les deux formes sont donc présentes. À ajuster avec un exemple réel (capture d'écran).

## Limites de la vérification du verbal

Les contrôles automatiques portent sur la structure, pas sur la logique. Les lots 1 à 3 ont été relus uniquement par leur auteur ; seules les réponses chiffrées ont été recalculées par programme. Une relecture humaine est recommandée avant de s'y fier.
