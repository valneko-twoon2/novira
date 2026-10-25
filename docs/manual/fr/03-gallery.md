# La galerie et la visionneuse

Les images créées s'alignent dans la **galerie**, sur le côté droit de l'écran. Une image choisie dans la galerie s'affiche en grand dans la **{{ui:app.views.viewer}}**, au centre.
Ce chapitre explique comment organiser les images, les retrouver, les regarder dans la visionneuse, rappeler leurs paramètres, puis les supprimer et les télécharger.

## Présentation de la galerie

Le panneau de droite se compose de deux parties, l'une au-dessus de l'autre.

- En haut : les **{{ui:gallery.boards.title}}**, une sorte de dossiers pour ranger les images.
- En bas : les miniatures des images de la planche sélectionnée.

La ligne au-dessus des miniatures contient les éléments suivants.

- Un sélecteur entre « {{ui:gallery.view.images}} » et « {{ui:gallery.view.assets}} », et le nombre d'images.
- Le bouton en forme de loupe : recherche ({{ui:gallery.search.label}})
- Le bouton en forme de calendrier : {{ui:gallery.date.button}}
- Le bouton en forme d'engrenage : {{ui:gallery.settings.title}}
- Le bouton en forme de flèche vers le haut : {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** contient les images créées dans novira (vidéos et sons compris).
**{{ui:gallery.view.assets}}** contient les images téléversées et les éléments comme les logos, traités à part des créations. Si une image semble manquer, regardez dans l'autre.

La taille des miniatures se règle avec le curseur du bouton en forme d'engrenage.
Les miniatures des vidéos et des sons portent un symbole de lecture ; en maintenant le curseur dessus et en le déplaçant latéralement, on peut vérifier la scène à cette position.

## Planches

Une planche est un conteneur pour répartir et organiser les images. « {{ui:gallery.boards.uncategorized}} » est une planche présente dès le départ, qui contient les images ne figurant dans aucune planche.

- **Créer** : appuyer sur le **＋** ({{ui:gallery.boards.add}}) en haut à droite de la zone des planches. Le nom se saisit directement sur place.
- **Changer de planche** : cliquer sur une planche. Seules les images de cette planche s'alignent en dessous.
- **Renommer** : double-cliquer sur le nom d'une planche, ou choisir « {{ui:common.rename}} » dans le menu du clic droit.
- **Rechercher** : la loupe de la zone des planches permet de chercher parmi les noms de planches.
- **Replier** : cliquer sur le titre « {{ui:gallery.boards.title}} ». Faire glisser le bord inférieur de la zone des planches modifie sa hauteur.

### Dans quelle planche va une nouvelle image

Une image nouvellement créée (ou téléversée) va dans la planche portant la marque « **{{ui:gallery.boards.autoBadge}}** ».
Au départ, chaque clic sur une planche la rend « {{ui:gallery.boards.autoBadge}} ». Pour la figer, désactiver « {{ui:gallery.settings.autoAssign}} » dans les paramètres de la galerie, puis la choisir avec « {{ui:gallery.boards.setAutoAdd}} » dans le menu du clic droit de la planche.

### Le menu du clic droit d'une planche

- **{{ui:gallery.boards.setAutoAdd}}** : définit la planche où sont enregistrées les nouvelles images.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}** : masque la planche de la liste. Elle n'est pas supprimée ; en activant « {{ui:gallery.settings.showArchived}} » dans les paramètres de la galerie, on la voit de nouveau. « {{ui:gallery.boards.unarchive}} » la remet en place.
- **{{ui:gallery.boards.delete}}** : une fenêtre de confirmation s'ouvre, et il faut choisir l'une des options suivantes.
  - « {{ui:gallery.boards.deleteBoardOnly}} » : les images restent et passent dans « {{ui:gallery.boards.uncategorized}} ».
  - « {{ui:gallery.boards.deleteBoardAndImages}} » : les images de la planche sont supprimées aussi.

> « {{ui:gallery.boards.uncategorized}} » ne peut être ni renommée, ni archivée, ni supprimée.

## Sélectionner des images

Les miniatures se sélectionnent de la façon suivante.

| Action | Résultat |
|---|---|
| Clic | Sélectionne cette seule image. L'image affichée dans la visionneuse devient elle aussi celle-ci |
| Clic en maintenant `Ctrl` | L'ajoute à la sélection ou la retire de la sélection (sélection multiple) |
| Clic en maintenant `Maj` | Sélectionne tout depuis l'image précédemment sélectionnée jusqu'à celle sur laquelle on a cliqué |
| Clic en maintenant `Alt` | La compare avec l'image de la visionneuse (voir plus loin) |
| Double-clic | Bascule le centre sur la visionneuse et affiche cette image en grand |
| `Ctrl+A` | Sélectionne toutes les images actuellement alignées |
| Touches fléchées | Déplacent la sélection vers l'image précédente, suivante, du dessus ou du dessous. Avec `Maj`, la plage s'étend |
| `Échap` | Annule la sélection |

> Les touches fléchées et les autres raccourcis fonctionnent lorsque le curseur est au-dessus de la galerie ou lorsque le centre est la visionneuse.

Les images sélectionnées reçoivent un cadre bleu. En survolant une miniature avec le curseur, les éléments suivants apparaissent.

- La taille de l'image (on peut aussi l'afficher en permanence avec « {{ui:gallery.settings.alwaysShowSize}} » dans les paramètres de la galerie)
- Le bouton en forme d'étoile (ajoute ou retire une étoile)
- Le bouton en forme de corbeille (suppression)

Une image marquée d'une étoile reçoit un symbole d'étoile jaune en haut à gauche.

## Clic droit sur une miniature

![Le menu du clic droit d'une miniature, avec notamment Ouvrir dans la visionneuse, Télécharger, Remixer et Envoyer vers la toile](shot:gallery-menu)

Un clic droit sur une miniature fait apparaître la liste des opérations disponibles pour cette image. Les opérations inutilisables sont grisées (par exemple, « {{ui:gallery.menu.remix}} » est indisponible pour une image sans paramètres enregistrés).

| Élément du menu | Fonction |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | L'affiche en grand dans la visionneuse du centre |
| **{{ui:common.download}}** | Enregistre le fichier de l'image |
| **{{ui:share.menu}}** | Exporte des copies dans un format et une taille au choix (les informations de génération peuvent être retirées) |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copie l'image dans le presse-papiers |
| **{{ui:gallery.menu.compare}}** (`Alt+clic`) | La compare avec l'image affichée dans la visionneuse |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Ouvre le workflow qui a créé l'image |
| **{{ui:gallery.menu.remix}}** (`R`) | Charge tous les paramètres sauf la seed dans le panneau de gauche |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Charge uniquement le prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Charge uniquement la seed (la seed devient fixe) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Charge tous les paramètres |
| **{{ui:gallery.menu.useSize}}** | Charge uniquement la largeur et la hauteur |
| **{{ui:gallery.menu.sendToCanvas}}** | La place sur la toile. On peut choisir entre créer une nouvelle toile et l'ajouter à la toile actuelle comme calque ou comme masque |
| **{{ui:gallery.menu.useAsReference}}** | L'ajoute à un cadre d'image de référence |
| **{{ui:gallery.menu.sendToVideo}}** | Utilise l'image comme première image d'une vidéo |
| **{{ui:gallery.menu.sendToWorkflow}}** | L'ajoute au workflow ouvert comme entrée d'image |
| **{{ui:gallery.menu.sendToText}}** | Utilise l'image comme arrière-plan du texte |
| **{{ui:gallery.menu.upscale}}** (`Maj+U`) | L'envoie vers l'onglet de mise à l'échelle |
| **{{ui:gallery.menu.segment}}** | Sélectionne une partie de l'image pour la découper ou la redessiner |
| **{{ui:gallery.derive.menu}}** | Crée d'autres images avec les paramètres de celle-ci, avec une autre seed ou de légères modifications |
| **{{ui:cutout.menu}}** | Supprime l'arrière-plan |
| **{{ui:facefix.menu}}** | Repère les visages et les redessine |
| **{{ui:gallery.menu.trim}}** | Supprime les marges transparentes et enregistre le résultat comme nouvelle image transparente |
| **{{ui:character.menu}}** | Enregistre l'image comme personnage |
| **{{ui:gallery.menu.changeBoard}}** | La déplace vers une autre planche |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Ajoute ou retire une étoile |
| **{{ui:gallery.menu.delete}}** (`Suppr`) | Supprime l'image |

L'utilisation de « {{ui:gallery.menu.sendToCanvas}} » et des opérations pour refaire ou retoucher une image est expliquée dans [Dessiner davantage sur la toile](05-canvas.md), [Retoucher et réutiliser les images](04-improve.md), [Mise à l'échelle et workflows](06-upscaling-workflows.md) et [Vidéo, musique, voix, logo et texte](07-media.md).

> « {{ui:gallery.menu.openInNewTab}} » n'apparaît que lorsque l'application est ouverte dans le navigateur d'un ordinateur. Il n'apparaît pas dans la version de bureau.

## Agir sur plusieurs images à la fois

![Le menu obtenu en faisant un clic droit après avoir sélectionné deux images](shot:gallery-multi-menu)

Après avoir sélectionné au moins deux images, un clic droit sur l'une d'elles fait apparaître un menu pour agir sur toutes à la fois. En tête figure le nombre d'images sélectionnées, par exemple « 2 images sélectionnées ».

- **{{ui:gallery.menu.changeBoard}}** : déplace d'un coup les images sélectionnées vers une autre planche.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}** : enregistre les images sélectionnées les unes après les autres.
- **{{ui:share.menu}}** : exporte des copies des images sélectionnées pour le partage (les vidéos et les sons sont exclus).
- **{{ui:gallery.menu.batch}}** : applique le même traitement (suppression de l'arrière-plan, agrandissement, etc.) à toutes les images sélectionnées. Chaque image entre séparément dans la file.
- L'élément rouge tout en bas : supprime d'un coup les images sélectionnées.

> En faisant un clic droit sur une image non sélectionnée, c'est le menu de cette seule image qui apparaît. Pour agir sur plusieurs images, il faut d'abord les sélectionner, puis faire un clic droit sur l'une d'elles.

## Rechercher, filtrer et trier

### Recherche

Le bouton en forme de loupe ouvre le champ de recherche. En saisissant un nom de fichier ou une partie du prompt positif, les images de cette planche sont filtrées. `Échap` ferme la recherche et annule le filtre.

### Filtrer par date

![Le menu de filtrage par date, avec des boutons comme Aujourd'hui et Hier, et un calendrier mensuel](shot:gallery-date)

Le bouton en forme de calendrier ouvre le menu de filtrage par date.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}** : définissent la période en un seul bouton.
- Le calendrier mensuel : les jours qui contiennent des images sont marqués. Un clic sur une date n'aligne que les images de ce jour. Les flèches du haut permettent de changer de mois.
- **{{ui:gallery.date.custom}}** : saisir une date de début et une date de fin, puis appuyer sur **{{ui:gallery.date.apply}}** pour n'aligner que les images de cette période. On peut aussi n'en utiliser qu'une des deux.
- **{{ui:gallery.date.quick.all}}** : arrête le filtrage.

Pendant le filtrage, une étiquette indiquant la période apparaît au-dessus de la galerie. Le × de l'étiquette permet aussi de l'annuler.

### Paramètres de la galerie

Le bouton en forme d'engrenage permet de modifier la disposition et l'apparence.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}} : lorsqu'une image est terminée, elle s'affiche automatiquement.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}} : place tout en haut les images marquées d'une étoile (activé dès le départ).
- {{ui:gallery.settings.sort}} : « {{ui:gallery.settings.sortNewest}} » ou « {{ui:gallery.settings.sortOldest}} ».
- {{ui:gallery.settings.groupByDate}} : sépare les images par un titre pour chaque jour.

## Regarder dans la visionneuse

![La visionneuse, avec la barre d'outils en haut, l'image au centre, les boutons de zoom en bas à droite et les informations de l'image en bas](shot:viewer)

La « {{ui:app.views.viewer}} » du centre affiche en grand l'image sélectionnée.
Les flèches à gauche et à droite de l'écran permettent de passer à l'image précédente ou suivante. La ligne du bas indique la taille de l'image, le modèle utilisé, la seed et le nom du fichier. Les vidéos et les sons peuvent être lus directement.

### Zoom et déplacement

- Molette de la souris : zoome et dézoome autour de la position du curseur.
- Glisser : déplace l'image lorsqu'elle est agrandie et dépasse du cadre. On peut aussi la déplacer en maintenant `Espace` ou en appuyant sur le bouton de la molette.
- Double-clic : bascule entre l'affichage complet et la taille réelle (100 %).
- Boutons en bas à droite : dézoomer, le niveau de zoom (un appui ouvre une liste des niveaux courants), zoomer, `1:1` (taille réelle) et ajuster à l'écran.
- Touches : `+` et `-` zooment d'un cran à la fois, `Ctrl+0` ajuste à l'écran et `Ctrl+1` affiche la taille réelle.

### Barre d'outils

La barre d'outils au-dessus de l'image aligne les opérations disponibles pour cette image. En survolant un bouton avec le curseur, son nom et son raccourci apparaissent.

| Groupe | Boutons |
|---|---|
| Informations | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Charger les paramètres | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Envoyer et retoucher | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Maj+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organiser | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Suppr`) |

Ils font la même chose que les éléments du même nom dans le menu du clic droit d'une miniature. Pour une image sans paramètres (comme une image téléversée), les boutons de chargement des paramètres sont grisés.

## Informations de l'image et rappel des paramètres

![Le panneau des métadonnées, avec la liste du prompt, du modèle, de la seed, des étapes, etc.](shot:viewer-metadata)

Le bouton **{{ui:gallery.viewer.toggleMetadata}}** (`I`) de la barre d'outils ouvre un panneau d'informations par-dessus l'image. Un nouvel appui, ou le × en haut à droite, le ferme.
Le panneau comporte quatre onglets.

- **{{ui:gallery.meta.tabRecall}}** : les paramètres utilisés lors de la création de l'image sont listés élément par élément (prompt, modèle, seed, étapes, échelle CFG, planificateur, taille, LoRA, etc.). Le bouton fléché à droite de chaque ligne charge **cet élément seul** dans le panneau de gauche.
- **{{ui:gallery.meta.tabMetadata}}** : affiche le contenu enregistré tel quel. Le bouton en haut à droite permet de le copier.
- **{{ui:gallery.meta.tabDetails}}** : le nom du fichier, la taille, la date et l'heure de création, la planche, la présence d'une étoile, etc.
- **{{ui:gallery.meta.tabWorkflow}}** : pour une image créée avec un workflow, son contenu est affiché.

La méthode de chargement des paramètres se choisit selon l'étendue souhaitée.

| Méthode | Ce qui est chargé |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Tous les paramètres : prompt, modèle, seed, taille, etc. La seed devient fixe |
| **{{ui:gallery.menu.remix}}** | Tout sauf la seed. Le réglage actuel de la seed (aléatoire ou fixe) reste tel quel. À utiliser pour « créer une autre image avec les mêmes paramètres » |
| **{{ui:gallery.menu.usePrompt}}** | Uniquement le prompt (positif et négatif) |
| **{{ui:gallery.menu.useSeed}}** | Uniquement la seed. La seed devient fixe |
| **{{ui:gallery.menu.useSize}}** | Uniquement la largeur et la hauteur (menu du clic droit seulement) |

Après le chargement, il suffit de regarder le panneau de gauche et d'appuyer sur **{{ui:params.invoke.invoke}}**.

> Le fichier image (PNG) d'une image créée dans novira contient ses paramètres. C'est pourquoi on peut parfois charger les paramètres même d'une image déplacée ailleurs puis téléversée de nouveau. Les images créées avec d'autres logiciels, et celles modifiées puis réenregistrées, ne contiennent pas de paramètres.

## Comparer deux images

![La visionneuse comparant deux images avec le curseur. On déplace la ligne verticale du milieu vers la gauche et la droite](shot:viewer-compare)

Pour voir la différence entre deux images, on utilise la comparaison.

1. Cliquer sur la première image à comparer pour la sélectionner, et placer le centre sur l'onglet « {{ui:app.views.viewer}} ».
2. Cliquer sur la miniature de la deuxième image en maintenant `Alt` (c'est aussi possible avec « {{ui:gallery.menu.compare}} » dans le menu du clic droit).
3. Une étiquette « {{ui:gallery.compare.badge}} » apparaît sur la deuxième miniature, et la visionneuse passe à l'écran de comparaison.

> On peut aussi commencer en sélectionnant deux images avec `Ctrl`, puis en appuyant sur le bouton de comparaison de la barre d'outils ou sur la touche `C`. Si une seule image est sélectionnée, le message « {{ui:gallery.compare.hint}} » apparaît.

Les boutons suivants apparaissent en haut de l'écran de comparaison.

- **{{ui:gallery.compare.slider}}** : les deux images sont superposées, et en faisant glisser la ligne verticale du milieu, on voit leurs différences à gauche et à droite.
- **{{ui:gallery.compare.sideBySide}}** : aligne les deux images côte à côte.
- **{{ui:gallery.compare.hover}}** : bascule sur la deuxième image uniquement tant que le curseur est sur l'image.
- **{{ui:gallery.compare.swap}}** : échange la première et la deuxième image.
- **{{ui:gallery.compare.exit}}** : arrête la comparaison. `Échap` permet aussi de l'arrêter.

Le zoom et le déplacement agissent de façon synchronisée sur les deux images. Les différences de détail se voient plus facilement en zoomant.

## Étoiles et suppression

### Ajouter une étoile

On peut marquer d'une étoile les images que l'on aime. On peut l'ajouter ou la retirer depuis le bouton en forme d'étoile de la miniature, le menu du clic droit ou la barre d'outils de la visionneuse.
Lorsque « {{ui:gallery.settings.starredFirst}} » est activé dans les paramètres de la galerie, les images marquées d'une étoile se regroupent en tête.

### Supprimer

Une image peut être supprimée de l'une des façons suivantes.

- Le bouton en forme de corbeille de la miniature
- « {{ui:gallery.menu.delete}} » dans le menu du clic droit
- Le bouton en forme de corbeille de la barre d'outils de la visionneuse
- Sélectionner l'image et appuyer sur la touche `Suppr` (`Retour arrière` fait la même chose)

Une fenêtre de confirmation s'ouvre ; un appui sur « {{ui:common.delete}} » supprime l'image.

> Une image supprimée ne peut pas être restaurée. Il n'existe pas d'équivalent de corbeille.

En cochant « {{ui:common.dontAskAgain}} » dans la fenêtre de confirmation, les images sont ensuite supprimées sans confirmation. Pour rétablir la confirmation, activer « {{ui:settings.confirmOnDelete}} » dans **{{ui:app.nav.settings}}**.

## Téléversement et téléchargement

### Téléverser

Les images de l'ordinateur peuvent être ajoutées à la galerie.

- Appuyer sur le bouton **{{ui:gallery.upload}}** au-dessus de la galerie et choisir des fichiers.
- Faire glisser-déposer des fichiers image depuis l'Explorateur de fichiers vers la galerie. Déposés sur une planche, ils vont dans cette planche.

Les images téléversées vont dans **{{ui:gallery.view.assets}}** de la planche « {{ui:gallery.boards.autoBadge}} », et l'affichage bascule aussi vers cet endroit. Plusieurs fichiers peuvent être ajoutés en une fois. Les fichiers qui ne sont pas des images sont ignorés.

### Télécharger

Pour enregistrer le fichier d'une image, utiliser le menu du clic droit ou **{{ui:common.download}}** dans la barre d'outils de la visionneuse. Si plusieurs images sont sélectionnées, elles sont enregistrées ensemble.

### Exporter pour le partage

![La fenêtre d'export pour le partage : format (PNG, JPEG, WebP), qualité, limite du côté le plus long et interrupteur qui retire les informations de génération](shot:share-export)

Pour créer des copies d'images destinées aux réseaux sociaux ou à d'autres personnes, utiliser **{{ui:share.menu}}** dans le menu du clic droit (également disponible avec plusieurs images sélectionnées) ou dans la barre d'outils de la visionneuse. Les images d'origine ne changent pas.

- **{{ui:share.format}}** : au choix PNG, JPEG ou WebP. Pour le JPEG, on peut régler la **{{ui:share.quality}}** (1 à 100), et les parties transparentes deviennent blanches. Le WebP est enregistré sans perte.
- **{{ui:share.size}}** : « {{ui:share.size.original}} », 2048, 1536 ou 1024 px, ou « {{ui:share.size.custom}} » pour saisir une longueur. Les images plus petites ne sont pas agrandies.
- **{{ui:share.removeInfo}}** : désactivé au départ. Lorsqu'il est activé, le prompt, les paramètres et le workflow sont exclus, et l'image est réenregistrée à partir de ses pixels, si bien qu'aucune autre donnée intégrée ne subsiste. Lorsqu'il est désactivé, seul le PNG conserve les paramètres. L'activer avant de remettre une image à quelqu'un si l'on ne veut pas montrer le prompt.

Après un appui sur **{{ui:share.run}}**, une fenêtre de choix du dossier s'ouvre dans la version de bureau. Le nom de chaque fichier est celui de la galerie avec la nouvelle extension ; si un fichier de même nom existe, un numéro comme « -2 » ou « -3 » est ajouté et rien n'est écrasé. Ensuite, **{{ui:share.openFolder}}** ouvre ce dossier.

> Seules les images sont exportées ; les vidéos et les sons parmi les éléments sélectionnés sont exclus. Dans un navigateur, les fichiers vont dans les téléchargements du navigateur.

## Glisser-déposer

Les miniatures peuvent être glissées vers d'autres endroits pour y être utilisées. Lorsque plusieurs sont sélectionnées, les images sélectionnées se déplacent ensemble.

- **Sur une planche** : déplace l'image vers cette planche.
- **Sur un cadre {{ui:params.refImage.sectionLabel}}** : elle devient une image de référence (voir [Créer des images](02-generate.md)).
- **Sur le champ d'image de la toile ou de la mise à l'échelle, ou sur une carte de l'écran de démarrage** : l'utilise comme source pour cet écran.

Les fichiers de l'Explorateur de fichiers peuvent être déposés sur la galerie, sur une planche, sur un cadre d'image de référence, sur une carte de l'écran de démarrage, etc.

## Raccourcis clavier de la galerie

| Action | Touche |
|---|---|
| Sélectionner l'image précédente, suivante, du dessus ou du dessous | Touches fléchées (`Maj` étend la plage) |
| Tout sélectionner | `Ctrl+A` |
| Annuler la sélection | `Échap` |
| Supprimer les images sélectionnées | `Suppr` |
| Copier l'image de la visionneuse | `Ctrl+C` |
| Ouvrir et fermer le panneau d'informations | `I` |
| Remix, prompt, seed, tout | `R`, `P`, `S`, `A` |
| Charger le workflow | `W` |
| Envoyer vers la mise à l'échelle | `Maj+U` |
| Démarrer et arrêter la comparaison | `C` |
| Ajuster à l'écran, taille réelle | `Ctrl+0`, `Ctrl+1` |
| Zoom avant, zoom arrière | `+`, `-` |

Ces raccourcis fonctionnent lorsque le curseur est au-dessus de la galerie ou lorsque le centre est la visionneuse. La liste est aussi visible sous « {{ui:app.nav.hotkeys}} » dans le menu **{{ui:app.nav.settings}}**.
