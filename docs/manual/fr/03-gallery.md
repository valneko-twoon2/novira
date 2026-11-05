# La galerie et la visionneuse

Les images que vous créez apparaissent dans la **galerie**, sur le côté droit de l'écran. Une image choisie dans la galerie s'affiche en grand dans la **{{ui:app.views.viewer}}**, au centre.
Ce chapitre explique comment ranger et rechercher les images, comment les regarder dans la visionneuse, comment rappeler leurs réglages, et comment les supprimer ou les télécharger.

## Découvrir la galerie

Choisissez l'onglet **{{ui:app.right.gallery}}** en haut du panneau de droite pour afficher la galerie (l'onglet **{{ui:app.right.assistant}}** à côté correspond à l'[agent](09-assistant-settings.md#agent)). La galerie se compose de deux parties, l'une au-dessus de l'autre.

- En haut : les **{{ui:gallery.boards.title}}**. Ce sont comme des dossiers où ranger les images.
- En bas : les miniatures des images de la planche choisie.

La ligne au-dessus des miniatures contient les éléments suivants.

- Le sélecteur entre « {{ui:gallery.view.images}} » et « {{ui:gallery.view.assets}} », et le nombre d'images.
- Le bouton en forme de loupe : la recherche ({{ui:gallery.search.label}})
- Le bouton en forme de calendrier : {{ui:gallery.date.button}}
- Le bouton en forme d'engrenage : {{ui:gallery.settings.title}}
- Le bouton en forme de flèche vers le haut : {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** contient les images créées avec novira (y compris les vidéos et les sons).
**{{ui:gallery.view.assets}}** contient les images que vous avez téléversées et ce qui est traité comme du « matériel distinct des œuvres », comme les logos. Si vous ne trouvez pas une image, regardez dans l'autre.

La taille des miniatures se règle avec le curseur du bouton en forme d'engrenage.
Les miniatures de vidéos et de sons portent un symbole de lecture ; en déplaçant le curseur horizontalement dessus, vous voyez la scène à cette position.

## Planches

Une planche est un conteneur qui sert à ranger les images par groupes. « {{ui:gallery.boards.uncategorized}} » est une planche présente dès le départ, qui reçoit les images placées dans aucune planche.

- **Créer** : Appuyez sur le **＋** ({{ui:gallery.boards.add}}) en haut à droite de la zone des planches. Vous pouvez saisir le nom sur place.
- **Changer de planche** : Cliquez sur une planche. Seules les images de cette planche s'affichent en dessous.
- **Renommer** : Double-cliquez sur le nom de la planche, ou choisissez « {{ui:common.rename}} » dans le menu du clic droit.
- **Chercher** : La loupe de la zone des planches permet de chercher un nom de planche.
- **Replier** : Cliquez sur le titre « {{ui:gallery.boards.title}} ». En faisant glisser le bord inférieur de la zone, vous changez sa hauteur.

### Dans quelle planche va une nouvelle image

Les images nouvellement créées (et celles que vous téléversez) vont dans la planche qui porte la marque « **{{ui:gallery.boards.autoBadge}}** ».
Au départ, chaque clic sur une planche en fait la planche « {{ui:gallery.boards.autoBadge}} ». Pour la fixer, désactivez « {{ui:gallery.settings.autoAssign}} » dans les réglages de la galerie, puis décidez avec « {{ui:gallery.boards.setAutoAdd}} » dans le menu du clic droit d'une planche.

### Le menu du clic droit d'une planche

- **{{ui:gallery.boards.setAutoAdd}}** : En fait le lieu d'enregistrement des nouvelles images.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}** : Masque la planche de la liste. Elle n'est pas supprimée : en activant « {{ui:gallery.settings.showArchived}} » dans les réglages de la galerie, vous la revoyez. « {{ui:gallery.boards.unarchive}} » la remet comme avant.
- **{{ui:gallery.boards.delete}}** : Une fenêtre de confirmation s'affiche, avec le choix entre les deux options suivantes.
  - « {{ui:gallery.boards.deleteBoardOnly}} » : Les images restent et passent dans « {{ui:gallery.boards.uncategorized}} ».
  - « {{ui:gallery.boards.deleteBoardAndImages}} » : Les images de la planche sont supprimées aussi.

> « {{ui:gallery.boards.uncategorized}} » ne peut pas être renommée, archivée ni supprimée.

## Choisir des images

Les miniatures se choisissent de la façon suivante.

| Action | Résultat |
|---|---|
| Clic | Choisit cette image seule. L'image affichée dans la visionneuse devient aussi celle-ci |
| Clic en maintenant `Ctrl` | Ajoute à la sélection, ou retire de la sélection (sélection multiple) |
| Clic en maintenant `Shift` | Sélectionne en une fois de l'image choisie précédemment jusqu'à l'image cliquée |
| Clic en maintenant `Alt` | Compare avec l'image de la visionneuse (voir plus loin) |
| Double-clic | Passe le centre à la visionneuse et affiche l'image en grand |
| `Ctrl+A` | Sélectionne toutes les images actuellement affichées |
| Touches fléchées | Déplacent la sélection vers l'image précédente, suivante, du dessus ou du dessous. Avec `Shift`, la sélection s'étend |
| `Esc` | Annule la sélection |

> Les touches fléchées et les autres raccourcis fonctionnent quand le curseur est sur la galerie ou quand le centre affiche la visionneuse.

Les images choisies reçoivent un cadre bleu. Lorsque vous placez le curseur sur une miniature, les éléments suivants apparaissent.

- La taille de l'image (elle peut aussi être toujours affichée avec « {{ui:gallery.settings.alwaysShowSize}} » dans les réglages de la galerie)
- Le bouton en forme d'étoile (ajouter ou retirer l'étoile)
- Le bouton en forme de corbeille (supprimer)

Une image marquée d'une étoile porte une étoile jaune en haut à gauche.

## Clic droit sur une miniature

![Le menu du clic droit d'une miniature. Ouvrir dans la visionneuse, télécharger, remixer, envoyer vers la toile, etc.](shot:gallery-menu)

Un clic droit sur une miniature affiche la liste des opérations possibles pour cette image. Celles qui ne sont pas disponibles sont grisées (par exemple, « {{ui:gallery.menu.remix}} » est indisponible pour une image sans réglages enregistrés).

| Menu | Rôle |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | Regarde l'image en grand dans la visionneuse centrale |
| **{{ui:common.download}}** | Enregistre le fichier de l'image |
| **{{ui:share.menu}}** | Exporte une copie en choisissant le format et la taille (les informations de génération peuvent aussi être retirées) |
| **{{ui:share.check.title}}** | Vérifie le filigrane, la mention de génération par IA et les informations d'authenticité du contenu que contient l'image |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copie l'image dans le presse-papiers |
| **{{ui:gallery.menu.compare}}** (`Alt+clic`) | Compare avec l'image affichée dans la visionneuse |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Ouvre le workflow qui a servi à créer l'image |
| **{{ui:gallery.menu.remix}}** (`R`) | Charge dans le panneau de gauche tous les réglages sauf le seed |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Charge uniquement le prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Charge uniquement le seed (le seed est verrouillé) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Charge tous les réglages |
| **{{ui:gallery.menu.useSize}}** | Charge uniquement la largeur et la hauteur |
| **{{ui:gallery.menu.sendToCanvas}}** | Place l'image sur la toile. Vous choisissez d'en faire une nouvelle toile ou de l'ajouter à la toile actuelle comme calque ou masque |
| **{{ui:gallery.menu.useAsReference}}** | L'ajoute à un cadre d'image de référence |
| **{{ui:gallery.menu.sendToVideo}}** | En fait la première image d'une vidéo |
| **{{ui:gallery.menu.sendToWorkflow}}** | L'ajoute au workflow ouvert comme entrée d'image |
| **{{ui:gallery.menu.sendToText}}** | En fait l'arrière-plan du texte |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | L'envoie à l'onglet de mise à l'échelle |
| **{{ui:gallery.menu.segment}}** | Ouvre l'image sur la toile ; vous peignez au pinceau la partie à corriger, puis vous l'effacez, la détourez ou la redessinez |
| **{{ui:gallery.derive.menu}}** | Crée, avec les réglages de cette image, une autre image avec un autre seed ou à peine modifiée |
| **{{ui:gallery.tools.heading}}** | {{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}}, {{ui:canvas.poseFromImage.menu}}. Le choix s'exécute aussitôt avec les derniers réglages, et l'engrenage à droite ouvre d'abord les réglages ([Retoucher et réutiliser les images](04-improve.md)) |
| **{{ui:gallery.menu.trim}}** | Supprime les marges transparentes et l'enregistre comme nouvelle image transparente |
| **{{ui:character.menu}}** | Enregistre l'image comme personnage |
| **{{ui:gallery.menu.changeBoard}}** | La déplace vers une autre planche |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Ajoute ou retire l'étoile |
| **{{ui:gallery.menu.delete}}** (`Del`) | Supprime l'image |

L'utilisation de « {{ui:gallery.menu.sendToCanvas}} » et des opérations pour recréer ou retoucher une image est expliquée dans [Dessiner davantage sur la toile](05-canvas.md), [Retoucher et réutiliser les images](04-improve.md), [Mise à l'échelle et workflows](06-upscaling-workflows.md) et [Vidéo, musique, voix, logo et texte](07-media.md).

> « {{ui:gallery.menu.openInNewTab}} » n'apparaît que lorsque vous utilisez novira dans le navigateur d'un ordinateur. Il n'apparaît pas dans la version bureau.

## Agir sur plusieurs images à la fois

![Le menu lorsqu'on fait un clic droit après avoir choisi 2 images](shot:gallery-multi-menu)

Si vous choisissez au moins deux images, puis faites un clic droit sur l'une d'elles, un menu utilisable pour l'ensemble apparaît. En tête s'affiche le nombre d'images choisies, par exemple « 2 images sélectionnées ».

- **{{ui:gallery.menu.changeBoard}}** : Déplace d'un coup les images choisies vers une autre planche.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}** : Enregistre les images choisies les unes après les autres.
- **{{ui:share.menu}}** : Exporte d'un coup les images choisies sous forme de copies de partage (les vidéos et les sons sont exclus).
- **{{ui:gallery.menu.batch}}** : Applique le même traitement (suppression de l'arrière-plan, agrandissement, etc.) à toutes les images choisies. Chaque image entre une par une dans la file d'attente.
- L'élément rouge tout en bas : Supprime d'un coup les images choisies.

> Si vous faites un clic droit sur une image non choisie, c'est le menu de cette seule image qui s'affiche. Pour agir sur plusieurs images, choisissez-les d'abord, puis faites le clic droit sur l'une des images choisies.

## Rechercher, filtrer, trier

### Recherche

Un clic sur le bouton en forme de loupe ouvre le champ de recherche. Si vous saisissez un nom de fichier ou une partie du prompt positif, les images de cette planche sont filtrées. `Esc` ferme la recherche et annule le filtre.

### Filtrer par date

![Le menu de filtrage par date. Des boutons comme Aujourd'hui et Hier, et le calendrier du mois](shot:gallery-date)

Un clic sur le bouton en forme de calendrier ouvre le menu de filtrage par date.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}** : Un seul bouton fixe la période.
- Le calendrier du mois : Les jours où il y a des images sont marqués. Un clic sur une date n'affiche que les images de ce jour. Les flèches du haut permettent de changer de mois.
- **{{ui:gallery.date.custom}}** : Saisissez une date de début et une date de fin, puis appuyez sur **{{ui:gallery.date.apply}}** : seules les images de cette période s'affichent. Une seule des deux dates suffit aussi.
- **{{ui:gallery.date.quick.all}}** : Annule le filtre.

Pendant le filtrage, une étiquette de période apparaît au-dessus de la galerie. Le × de l'étiquette permet aussi d'annuler le filtre.

### Réglages de la galerie

Le bouton en forme d'engrenage permet de changer l'ordre et l'apparence.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}} : Quand une image est terminée, elle s'affiche automatiquement.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}} : Place tout en haut les images marquées d'une étoile (activé au départ).
- {{ui:gallery.settings.sort}} : « {{ui:gallery.settings.sortNewest}} » ou « {{ui:gallery.settings.sortOldest}} ».
- {{ui:gallery.settings.groupByDate}} : Sépare les images par des titres jour par jour.

## Regarder dans la visionneuse

![La visionneuse. La barre d'outils en haut, l'image au centre, les boutons de zoom en bas à droite, les informations de l'image en bas](shot:viewer)

La « {{ui:app.views.viewer}} » au centre affiche en grand l'image choisie.
Vous passez à l'image précédente ou suivante avec les flèches à gauche et à droite de l'écran. La ligne tout en bas affiche la taille de l'image, le modèle utilisé, le seed et le nom du fichier. Les vidéos et les sons peuvent être lus directement.

### Zoom et déplacement

- Molette de la souris : Zoome et dézoome en prenant la position du curseur pour centre.
- Glisser : Déplace l'image quand elle déborde après un zoom. On peut aussi la déplacer en maintenant `Espace`, ou en appuyant sur le bouton de la molette.
- Double-clic : Alterne entre l'affichage complet et la taille réelle (100 %).
- Boutons en bas à droite : réduire, le facteur de zoom (un clic affiche la liste des facteurs courants), agrandir, `1:1` (taille réelle), ajuster à l'écran.
- Touches : `+` et `-` zooment d'un cran, `Ctrl+0` ajuste à l'écran, `Ctrl+1` met à la taille réelle.

### Barre d'outils

La barre d'outils au-dessus de l'image regroupe les opérations sur cette image. En plaçant le curseur sur un bouton, vous voyez son nom et son raccourci.

| Groupe | Boutons |
|---|---|
| Informations | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Charger les réglages | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Envoyer et retoucher | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:gallery.manga.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Ranger | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

Leur rôle est le même que celui des éléments de même nom du menu du clic droit sur une miniature. Pour une image sans réglages (une image téléversée, par exemple), les boutons de chargement des réglages sont grisés.

## Informations de l'image et rappel des réglages

![Le panneau des métadonnées. La liste du prompt, du modèle, du seed, du nombre d'étapes, etc.](shot:viewer-metadata)

Le bouton **{{ui:gallery.viewer.toggleMetadata}}** de la barre d'outils (`I`) ouvre au-dessus de l'image un panneau d'informations. Un nouvel appui, le × en haut à droite ou un clic en dehors du panneau le ferme. Vous pouvez sélectionner le texte du panneau en le faisant glisser, puis le copier avec `Ctrl+C` (pendant qu'un texte est sélectionné, `Ctrl+C` copie le texte et non l'image).
Le panneau comporte quatre onglets.

- **{{ui:gallery.meta.tabRecall}}** : Les réglages utilisés pour créer l'image sont listés élément par élément (prompt, modèle, seed, nombre d'étapes, échelle CFG, planificateur, taille, LoRA, etc.). Le bouton en forme de flèche à droite de chaque ligne charge **cet élément seul** dans le panneau de gauche. Pour la ligne du prompt, le bouton à gauche de la flèche copie le prompt tel quel. Pour une image d'une famille de modèles dont le planificateur est imposé (Anima, Flux, etc.), une ligne « {{ui:gallery.meta.sampling}} » remplace celle du planificateur et indique l'échantillonneur et le planificateur réellement utilisés. Cette ligne ne se charge pas, et « {{ui:gallery.menu.useAll}} » laisse aussi le planificateur tel qu'il est.
- **{{ui:gallery.meta.tabMetadata}}** : Vous voyez le contenu enregistré tel quel. Le bouton en haut à droite permet de le copier.
- **{{ui:gallery.meta.tabDetails}}** : Le nom du fichier, la taille, la date de création, la planche, la présence d'une étoile, etc.
- **{{ui:gallery.meta.tabWorkflow}}** : Pour une image créée avec un workflow, son contenu s'affiche.

Vous choisissez la méthode de chargement des réglages selon l'étendue voulue.

| Méthode | Ce qui est chargé |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Tous les réglages : prompt, modèle, seed, taille, etc. Le seed est verrouillé. Pour une image créée avec un autre logiciel et importée, le modèle est recherché par son nom (des écritures différentes comme `v17` et `v170` sont considérées comme le même modèle). S'il est introuvable, le modèle actuel est conservé et une notification vous le dit |
| **{{ui:gallery.menu.remix}}** | Tout sauf le seed. Le réglage actuel du seed (aléatoire ou verrouillé) reste tel quel. À utiliser quand vous voulez « créer une autre image avec les mêmes réglages » |
| **{{ui:gallery.menu.usePrompt}}** | Le prompt seul (positif et négatif) |
| **{{ui:gallery.menu.useSeed}}** | Le seed seul. Le seed est verrouillé |
| **{{ui:gallery.menu.useSize}}** | La largeur et la hauteur seules (uniquement dans le menu du clic droit) |

Après le chargement, il suffit de regarder le panneau de gauche et d'appuyer sur **{{ui:params.invoke.invoke}}**.

> Le fichier image (PNG) d'une image créée avec novira contient aussi ses réglages. C'est pourquoi les réglages peuvent parfois être chargés même pour une image dont le fichier a été déplacé ailleurs puis téléversé de nouveau. Une image créée avec un autre logiciel ou retravaillée puis réenregistrée ne contient pas de réglages.

## Comparer deux images

![La visionneuse comparant deux images avec le curseur. On déplace la ligne verticale du milieu vers la gauche ou la droite](shot:viewer-compare)

Pour voir la différence entre deux images, utilisez la comparaison.

1. Cliquez sur la première image à comparer pour la choisir, et mettez le centre sur l'onglet « {{ui:app.views.viewer}} ».
2. Cliquez sur la miniature de la seconde image en maintenant `Alt` (c'est aussi possible avec « {{ui:gallery.menu.compare}} » dans le menu du clic droit).
3. L'étiquette « {{ui:gallery.compare.badge}} » apparaît sur la miniature de la seconde image, et la visionneuse passe à l'écran de comparaison.

> Vous pouvez aussi commencer en choisissant deux images avec `Ctrl`, puis en appuyant sur le bouton de comparaison de la barre d'outils ou sur la touche `C`. Si une seule image est choisie, le message « {{ui:gallery.compare.hint}} » s'affiche.

En haut de l'écran de comparaison apparaissent les boutons suivants.

- **{{ui:gallery.compare.slider}}** : Superpose les deux images ; en faisant glisser la ligne verticale du milieu, vous voyez en quoi elles diffèrent à gauche et à droite.
- **{{ui:gallery.compare.sideBySide}}** : Place les deux images côte à côte.
- **{{ui:gallery.compare.hover}}** : N'affiche la seconde image que pendant que le curseur est sur l'image.
- **{{ui:gallery.compare.swap}}** : Échange la première et la seconde image.
- **{{ui:gallery.compare.exit}}** : Met fin à la comparaison. `Esc` fonctionne aussi.

Le zoom et le déplacement agissent de façon synchronisée sur les deux images. Pour repérer les petites différences, il est plus facile de zoomer.

## Étoiles et suppression

### Mettre une étoile

Vous pouvez marquer d'une étoile les images que vous aimez. On l'ajoute ou on la retire avec le bouton en forme d'étoile de la miniature, avec le menu du clic droit ou avec la barre d'outils de la visionneuse.
Si « {{ui:gallery.settings.starredFirst}} » est activé dans les réglages de la galerie, les images marquées d'une étoile sont regroupées en tête.

### Supprimer

Voici comment supprimer une image.

- Le bouton en forme de corbeille de la miniature
- « {{ui:gallery.menu.delete}} » dans le menu du clic droit
- Le bouton en forme de corbeille de la barre d'outils de la visionneuse
- Choisir l'image et appuyer sur la touche `Delete` (`Backspace` fait la même chose)

Une fenêtre de confirmation s'affiche ; en appuyant sur « {{ui:common.delete}} », l'image est supprimée.

Une image supprimée ne disparaît pas tout de suite : elle est conservée 14 jours (jusqu'à 500 images), ce qui permet d'annuler la suppression.

- Appuyez sur la cloche en bas à droite de l'écran, puis sur **{{ui:gallery.undoDelete.action}}** dans la notification de la suppression. Pour ne pas gêner quand vous supprimez plusieurs images à la suite, les notifications de suppression n'apparaissent pas à l'écran : elles vont seulement sous la cloche (son nombre augmente). Chaque notification affiche en petit les images supprimées.
- Appuyez sur le bouton « {{ui:gallery.undoDelete.label}} » au-dessus de la galerie, ou sur `Ctrl+Z` pendant que le pointeur est sur la galerie (ou que la visionneuse est ouverte). Vous pouvez annuler jusqu'aux 30 dernières suppressions, de la plus récente à la plus ancienne.
- Pour supprimer de nouveau une image restaurée, utilisez le bouton « {{ui:gallery.redoDelete.label}} » ou `Ctrl+Shift+Z` (`Ctrl+Y`).

> L'historique des annulations possibles est oublié à la fermeture de l'application. Une image supprimée depuis plus de 14 jours ne peut plus être restaurée. La suppression des images avec leur planche s'annule de la même façon. Si la planche n'existe plus, les images retournent dans « {{ui:gallery.boards.uncategorized}} ».

Si vous cochez « {{ui:common.dontAskAgain}} » dans la fenêtre de confirmation, les suppressions suivantes se font sans confirmation. Pour rétablir la confirmation, activez « {{ui:settings.confirmOnDelete}} » dans **{{ui:app.nav.settings}}**.

## Téléversement et téléchargement

### Téléverser

Vous pouvez ajouter à la galerie les images que vous avez chez vous.

- Appuyez sur le bouton **{{ui:gallery.upload}}** au-dessus de la galerie et choisissez des fichiers.
- Faites glisser-déposer des fichiers image de l'Explorateur dans la galerie. Si vous les déposez sur une planche, ils vont dans cette planche.

Les images téléversées vont dans **{{ui:gallery.view.assets}}** de la planche « {{ui:gallery.boards.autoBadge}} », et l'affichage passe aussi à cet endroit. Vous pouvez en ajouter plusieurs à la fois. Les fichiers qui ne sont pas des images sont ignorés.

### Télécharger

Pour enregistrer le fichier d'une image, utilisez le menu du clic droit ou **{{ui:common.download}}** dans la barre d'outils de la visionneuse. Quand plusieurs images sont choisies, elles sont toutes enregistrées.

Dans la version bureau, une fenêtre de choix du dossier d'enregistrement s'ouvre, et le fichier d'origine est copié tel quel (informations de génération comprises). S'il existe déjà un fichier du même nom, un numéro comme « -2 » est ajouté et rien n'est écrasé. Dans la notification qui suit l'enregistrement, **{{ui:share.openFolder}}** ouvre ce dossier. Dans le navigateur, le fichier est enregistré dans les téléchargements du navigateur.

### Exporter pour le partage

![La fenêtre d'exportation pour le partage. Le format (PNG, JPEG, WebP), la qualité, la limite du grand côté et l'interrupteur de suppression des informations de génération](shot:share-export)

Une copie d'une image à publier sur les réseaux sociaux ou à transmettre à quelqu'un se crée avec le menu du clic droit (utilisable aussi quand plusieurs images sont choisies) ou avec **{{ui:share.menu}}** dans la barre d'outils de la visionneuse. L'image d'origine ne change pas.

- **{{ui:share.format}}** : Choisissez parmi PNG, JPEG et WebP. Avec JPEG, vous pouvez régler **{{ui:share.quality}}** (1 à 100), et les parties transparentes deviennent blanches. WebP enregistre sans perte.
- **{{ui:share.size}}** : « {{ui:share.size.original}} », 2048, 1536 ou 1024 px, ou « {{ui:share.size.custom}} » pour saisir une longueur. Les images plus petites ne sont pas agrandies.
- **{{ui:share.removeInfo}}** : Désactivé au départ. Activé, le prompt, les réglages et le workflow ne sont pas inclus, et l'image est réenregistrée à partir de ses pixels, si bien qu'aucune autre information intégrée ne subsiste. Quand il est désactivé, seul le PNG conserve les réglages. Activez-le avant de transmettre une image si vous ne voulez pas montrer le prompt.
- **{{ui:share.watermark}}** : Désactivé au départ. Activé, l'image exportée reçoit un filigrane invisible (TrustMark), une information indiquant qu'elle a été créée par IA (IPTC) et des informations d'authenticité du contenu signées (C2PA). Le filigrane contient la marque de novira et un numéro aléatoire propre à chaque image, et l'association du numéro et de l'image d'origine est enregistrée dans cette application.

En appuyant sur **{{ui:share.run}}**, la version bureau ouvre une fenêtre de choix du dossier d'enregistrement. Le nom du fichier est le nom du fichier de la galerie avec la nouvelle extension ; s'il existe déjà un fichier du même nom, des numéros comme « -2 » et « -3 » sont ajoutés et rien n'est écrasé. Après l'exportation, **{{ui:share.openFolder}}** ouvre ce dossier.

> Seules les images peuvent être exportées. Les vidéos et les sons de la sélection sont écartés. Dans le navigateur, le résultat est enregistré dans les téléchargements du navigateur : tel quel pour une seule image, regroupé dans un seul zip pour deux images ou plus. Le total exportable en une fois est de 1 Go au maximum ; au-delà, un message demande de réduire le nombre d'images.

Les fichiers utilisés pour le filigrane (environ 140 Mo au total) sont téléchargés automatiquement au démarrage de l'application. Tant que la préparation n'est pas terminée, la progression s'affiche sous l'interrupteur et **{{ui:share.run}}** ne peut pas être pressé. Si le téléchargement échoue, appuyez sur **{{ui:share.watermarkRetry}}**.

> Le filigrane est placé dans la partie carrée au centre de l'image. Nous avons vérifié qu'il reste lisible après un réenregistrement en JPEG de qualité 80 ou une réduction de moitié, mais il peut disparaître avec un recadrage, une recréation ou un traitement important. Le filigrane utilise une méthode publique, donc n'importe qui peut écrire le même. La signature a été créée sur ce PC, donc les autres applications l'affichent comme un signataire non approuvé. Le traitement du filigrane nécessite le Microsoft Visual C++ Redistributable ; s'il manque, une erreur s'affiche.

### Vérifier un filigrane

On l'ouvre avec **{{ui:share.check.title}}** dans le menu du clic droit d'une miniature. Si vous choisissez un fichier d'image (PNG, JPEG ou WebP) avec **{{ui:share.check.pick}}**, les points suivants sont vérifiés et listés. Quand il est ouvert depuis le menu du clic droit, l'image en question est vérifiée aussitôt. Dans le navigateur, on ne peut pas choisir un fichier à vérifier.

- **{{ui:share.check.watermark}}** : Y a-t-il un filigrane novira ? S'il y en a un, son numéro s'affiche.
- **{{ui:share.check.original}}** : Si le numéro figure dans l'enregistrement des exportations de cette application, l'image d'origine et la date d'exportation s'affichent, et **{{ui:share.check.showOriginal}}** permet de l'afficher dans la visionneuse.
- **{{ui:share.check.credentials}}** : Y a-t-il des informations d'authenticité du contenu, n'ont-elles pas été modifiées depuis la signature, l'image est-elle enregistrée comme créée par IA, et qui est le signataire.
- **{{ui:share.check.iptc}}** : Y a-t-il une information indiquant que l'image a été créée par IA.

> L'absence de filigrane ne prouve pas que l'image n'a pas été créée par IA. L'enregistrement des exportations se trouve dans la base de données de cette application ; on ne peut donc pas connaître l'image d'origine d'une image exportée avec novira sur un autre PC. Tant que la préparation des fichiers du filigrane n'est pas terminée, seuls les éléments autres que le filigrane sont vérifiés.

## Glisser-déposer

Les miniatures peuvent être glissées vers d'autres endroits pour s'en servir. Quand plusieurs sont choisies, les images choisies se déplacent ensemble.

- **Sur une planche** : Déplace l'image vers cette planche.
- **Sur le cadre de {{ui:params.refImage.sectionLabel}}** : En fait une image de référence (voir [Créer des images](02-generate.md)).
- **Sur le champ d'image de la toile ou de la mise à l'échelle, ou sur une carte de l'écran de démarrage** : S'en sert comme matériau de cet écran.

Les fichiers de l'Explorateur peuvent être déposés sur la galerie, sur une planche, sur le cadre d'une image de référence, sur une carte de l'écran de démarrage, etc.

## Raccourcis clavier de la galerie

| Action | Touche |
|---|---|
| Choisir l'image précédente, suivante, du dessus, du dessous | Touches fléchées (`Shift` pour étendre la sélection) |
| Tout sélectionner | `Ctrl+A` |
| Annuler la sélection | `Esc` |
| Supprimer l'image choisie | `Delete` |
| Copier l'image de la visionneuse ou celle choisie dans la galerie (cela fonctionne aussi sur l'écran de la toile, après avoir cliqué sur une image de la galerie) | `Ctrl+C` |
| Ouvrir ou fermer le panneau d'informations | `I` |
| Remixer, prompt, seed, tout | `R`, `P`, `S`, `A` |
| Charger le workflow | `W` |
| Envoyer à la mise à l'échelle | `Shift+U` |
| Commencer ou arrêter la comparaison | `C` |
| Affichage complet, taille réelle | `Ctrl+0`, `Ctrl+1` |
| Zoom avant, zoom arrière | `+`, `-` |

Ces raccourcis fonctionnent quand le curseur est sur la galerie ou quand le centre affiche la visionneuse. Vous pouvez aussi consulter la liste dans « {{ui:app.nav.hotkeys}} », dans le menu **{{ui:app.nav.settings}}**.
