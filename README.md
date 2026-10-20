# Bibliothèque GospelBox

Recueils de cantiques **libres de droits**, téléchargeables en un clic depuis
[GospelBox](https://www.gospelbox.app) (Cantiques → « + » → Bibliothèque en ligne).

| Recueil | Langue | Chants | Source |
| --- | --- | --- | --- |
| Cantiques du domaine public | français | 5 | Sélection GospelBox |
| Open Hymnal | anglais | 289 | [Open Hymnal Project](http://openhymnal.org/), édition 2008 |
| Isaac Watts – Hymns and Spiritual Songs | anglais | 352 | [Project Gutenberg n° 13341](https://www.gutenberg.org/ebooks/13341) |

## Règle d'or

N'entrent ici que des textes **du domaine public** (auteurs et traducteurs morts depuis plus de
70 ans) ou **sous licence libre** permettant la redistribution. Les recueils récents
(Chants de Victoire, Sur les ailes de la foi, J'aime l'Éternel…) restent protégés : chaque
église peut importer ses propres fichiers dans GospelBox, mais ils ne sont pas diffusés ici.

## Organisation

- `songbooks/*.json` : un recueil par fichier, au format GospelBox
  (`{ "format": "gospelbox-songbook", "name": …, "songs": [{ "number", "title", "author", "composer", "copyright", "lyrics" }] }`).
  Les paroles suivent le format de l'éditeur : un bloc par diapositive, `[1]`, `[R]`, `[1.2]`…
- `index.json` : la liste lue par l'application. Ne pas l'écrire à la main : `node build/index.mjs`.
- `build/` : scripts de conversion des sources (Open Hymnal, Gutenberg, OCR d'éditions anciennes)
  et métadonnées des recueils (`catalog.json`).

## Ajouter un recueil

1. Placer le fichier dans `songbooks/` et décrire le recueil dans `build/catalog.json`
   (langue, description, source, licence).
2. Lancer `node build/index.mjs`, vérifier, puis publier sur `main`.

Les recueils publiés sont proposés immédiatement dans GospelBox, sans mise à jour de l'application.
