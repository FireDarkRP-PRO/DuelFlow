# Tournois personnalisés

Un site statique pour organiser des tournois à partir de ce que tu veux comparer : des musiques, des Pokémon, et bientôt d'autres choses. À chaque duel, tu choisis ton préféré jusqu'à ce qu'il n'en reste qu'un.

Le site fonctionne entièrement dans le navigateur et est prévu pour **GitHub Pages**. Aucun serveur, aucune installation.

## Modes disponibles

| Mode | Page | État |
|------|------|------|
| Mode musical | `Tournois/musique.html` | Disponible |
| Pokémon | `Tournois/pokemon.html` | Disponible |

## Arborescence

```
.
├── index.html                Menu de sélection du tournoi
├── Ressource/
│   ├── style.css             Styles partagés par tous les tournois
│   ├── tournoi.js            Moteur de tournoi (groupes, tableau, sauvegarde)
│   └── Pokemon/
│       ├── pokemon.txt           Liste des Pokémon (« 0001 Bulbizarre »)
│       ├── genPokemon.txt        Plages de numéros par génération (« Gen1:1-151 »)
│       └── formesRegionales.txt  Formes régionales (« 19;rattata-alola;Rattata d'Alola »)
└── Tournois/
    ├── musique.html          Tournoi musical
    └── pokemon.html          Tournoi Pokémon
```

## Utiliser le mode musical

1. Ouvre la page du mode musical.
2. Choisis le **dossier** qui contient tes fichiers MP3. Les musiques sont identifiées par leur nom de fichier (sans `.mp3`). Tes fichiers restent sur ton appareil, rien n'est envoyé.
3. Règle le tournoi (voir plus bas), puis lance-le.
4. À chaque duel, écoute les deux titres avec les lecteurs et clique sur **Choisir** (ou touche `1` pour la gauche, `2` pour la droite).

> La sélection d'un dossier fonctionne sur ordinateur. La plupart des navigateurs mobiles ne la proposent pas.

## Utiliser le mode Pokémon

1. Ouvre la page du mode Pokémon : la liste est lue automatiquement dans `Ressource/Pokemon/pokemon.txt`, sans dossier à choisir.
2. Coche les **générations** qui participent (toutes par défaut). Les cases viennent de `Ressource/Pokemon/genPokemon.txt` : une ligne `Gen1:1-151` crée une case. Si un numéro est dans deux plages, la première ligne l'emporte, et un Pokémon hors de toutes les plages participe toujours.
3. Coche **Formes régionales** pour ajouter à la liste toutes les formes de `Ressource/Pokemon/formesRegionales.txt` (une ligne par forme : `idNational;slugPokeAPI;nomAffiché`). Chaque forme compte comme un Pokémon à part entière, avec sa propre carte (types, statistiques, image), et ne dépend pas des cases de génération.
4. Règle le tournoi et lance-le : les réglages, le déroulement et la sauvegarde sont les mêmes que pour le mode musical.
5. Chaque carte affiche, grâce à [PokéAPI](https://pokeapi.co) : l'illustration officielle, le numéro, les types, la catégorie, la taille, le poids, les statistiques de base avec leur total, et un bouton pour écouter le cri.

Le site a besoin d'internet pour PokéAPI. Si l'API ne répond pas, la carte l'indique et tu peux quand même voter d'après le nom. Si le nom technique (slug) d'une forme régionale n'existe pas dans PokéAPI, le site cherche la variante la plus proche de l'espèce. La sauvegarde du mode Pokémon ne demande aucun dossier : elle contient directement les Pokémon encore en lice.

## Réglages (valables pour les deux modes)

- **Musiques (ou Pokémon) par groupe** : nombre d'éléments par groupe (2 minimum, 4 par défaut).
- **Tableau Upper/Lower Bracket** : active ou désactive le tableau final.
- **Le tableau commence à** : 16ème, 8ème, 4ème ou 2ème de finale. Ce réglage disparaît si le tableau est désactivé.
- **Points par victoire** : 3 par défaut.
- **Points perdus par défaite** : 0 par défaut.

Les points de victoire et de défaite ne peuvent pas être tous les deux à 0, sinon les groupes ne pourraient jamais être départagés.

## Déroulement d'un tournoi

### Phases de groupes

Les éléments sont mélangés puis répartis en groupes. Dans chaque groupe, **chacun affronte chacun** : une victoire rapporte des points, une défaite en retire. Le meilleur score du groupe passe à la phase suivante, les autres sont éliminés. En cas d'égalité en tête, les ex aequo rejouent entre eux (« Départage »).

Les gagnants sont ensuite mélangés et reformés en nouveaux groupes (phase 2, 3...). L'écran indique par exemple : *Phase d'élimination · Phase 1, Groupe 4 sur 13*.

### Tableau Upper / Lower Bracket

Quand il reste assez peu d'éléments pour atteindre le stade choisi (par exemple 16 pour le 8ème de finale), le tableau commence :

- **Upper Bracket** : un duel perdu fait descendre l'élément en Lower Bracket.
- **Lower Bracket** : un duel perdu est éliminatoire. C'est la chance de se rattraper en gagnant tous ses duels.
- **Finale des finales** : le gagnant de l'Upper affronte celui du Lower, en un seul duel.

Si le nombre d'éléments n'est pas une puissance de 2, l'un d'eux passe directement au tour suivant.

### 1 contre 1 pur

Désactive le tableau et mets **2 éléments par groupe** : chaque groupe est un seul duel, c'est de l'élimination directe.

## Sauvegarde

Le bouton **Exporter la sauvegarde** télécharge un fichier JSON. Il ne contient que les éléments **encore en lice**, ce qui permet d'ignorer les MP3 ajoutés au dossier après le début du tournoi.

- **Phase de groupes** : les gagnants des groupes déjà joués et les groupes restants sont conservés. Une reprise au groupe 4 sur 13 revient au groupe 4 sur 13.
- **Tableau** : les listes Upper et Lower sont enregistrées séparément.
- Les réglages du tournoi sont enregistrés aussi.

Pour reprendre le mode musical : à l'arrivée sur la page, ajoute le fichier de sauvegarde **et** choisis le même dossier de musiques. Si une musique de la sauvegarde n'est plus dans le dossier, un message la signale et remplace son lecteur audio. Pour le mode Pokémon, le fichier de sauvegarde suffit.

Limite : un groupe ou un tour en cours est rejoué depuis son début à la reprise.

## Ajouter un nouveau tournoi

1. Crée une page dans `Tournois/` (par exemple `films.html`) qui charge `../Ressource/style.css` et `../Ressource/tournoi.js`.
2. Utilise le moteur : `Tournoi.create(elements, { P, X, Y, Z, tableau }, onEliminate, reprise)`. Les éléments sont des chaînes uniques. `tableau: false` désactive le tableau, et `X` vaut 16, 8, 4 ou 2.
3. Lis le duel courant avec `t.duel`, enregistre le choix avec `t.choose(gagnant)`, récupère l'état à sauvegarder avec `t.snapshot()`.
4. Ajoute une tuile vers la nouvelle page dans `index.html`.