# Toile

![Vue d'ensemble de l'onglet Toile. Au centre, la toile ; en bas à droite, la liste des calques](shot:canvas)

L'onglet **{{ui:app.tabs.canvas}}** est l'établi pour dessiner, poser des images et ne redessiner qu'une partie. Il permet de poser une image et de l'agrandir, d'appliquer un masque sur la zone à redessiner, ou de fixer une pose avec un bonhomme en bâtons.

L'écran se divise en trois parties.

- À gauche : le panneau de réglages, identique à celui de l'onglet Générer (prompt, modèle, taille, etc.). Sur la toile, la rubrique **{{ui:params.compositing.title}}** s'y ajoute.
- Au centre : la toile. Les boutons d'outils sont alignés en haut.
- À droite : la liste des **{{ui:canvas.layers.title}}**, où l'on place les images.

Si vous cliquez sur **{{ui:params.invoke.invoke}}** sur une toile vide, une image est créée normalement à l'intérieur du cadre en pointillés (la zone de génération). La toile prend tout son intérêt lorsque vous y posez une image ou une esquisse. Les calques et les masques sont enregistrés automatiquement et reviennent à la prochaine ouverture de l'application (l'historique d'annulation n'est pas enregistré).

## Poser et dessiner

Il existe plusieurs façons de mettre une image sur la toile.

- Dessiner au pinceau. Si aucun calque n'est sélectionné, un « {{ui:canvas.add.raster}} » est créé automatiquement.
- Faire glisser une image de la galerie vers la toile. Un cadre apparaît pour choisir la destination (raster, contrôle, masque d'inpainting, etc.) ; déposez l'image dessus.
- `Ctrl+V` colle une image du presse-papiers comme nouveau calque raster (elle est aussi enregistrée dans la galerie).
- Faire un clic droit sur une image de la galerie (dans la visionneuse, l'icône de pinceau) et choisir la destination dans **{{ui:gallery.menu.sendToCanvas}}**.

Les destinations sont les suivantes.

| Destination | Effet |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Vide la toile et repart à neuf, à la taille de cette image. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Repart également à neuf, mais l'image devient un calque de contrôle. |
| **{{ui:gallery.canvas.raster}}** | L'ajoute à la toile actuelle comme calque raster. |
| **{{ui:gallery.canvas.control}}** | L'ajoute comme calque de contrôle. |
| **{{ui:gallery.canvas.inpaint}}** | L'ajoute comme masque d'inpainting. |
| **{{ui:gallery.canvas.regional}}** | L'ajoute comme image de référence du guidage régional (voir [Le guidage régional n'est pas encore disponible](#le-guidage-régional-n-est-pas-encore-disponible)). |

## Outils

Les outils sont alignés dans la barre du haut. Les touches du clavier permettent aussi de passer de l'un à l'autre.

| Outil | Touche | Usage |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Dessiner. La couleur se change avec le bouton de couleur de la barre. |
| **{{ui:canvas.tool.eraser}}** | `E` | Effacer ce qui a été dessiné. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Pixelliser la zone tracée (pour masquer un endroit). La taille des blocs se règle avec le nombre de la barre. Ne s'applique qu'aux calques contenant une image. |
| **{{ui:canvas.tool.rect}}** | `U` | Remplir un rectangle. |
| **{{ui:canvas.tool.lasso}}** | `L` | Entoure une forme libre et la remplit de couleur (sur un masque, elle est masquée). |
| **{{ui:canvas.tool.pose}}** | `O` | Place une pose de bonhomme en bâtons sur un calque de contrôle et permet de déplacer les articulations (voir « Créer une pose sur la toile » plus bas). |
| **{{ui:canvas.tool.move}}** | `V` | Déplacer un calque. Les flèches décalent le calque sélectionné de 1 px (10 px avec Maj). |
| **{{ui:canvas.tool.bbox}}** | `C` | Déplacer ou redimensionner la zone de génération (cadre de sélection). |
| **{{ui:canvas.tool.view}}** | `H` | Décaler l'affichage. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Prélever une couleur dans l'image. |

Vous disposez aussi des opérations suivantes.

- L'épaisseur du pinceau se change avec **{{ui:canvas.toolbar.brushWidth}}** dans la barre, ou avec les touches `[` et `]`. La touche `Q` permet de basculer avec l'outil utilisé précédemment.
- Le zoom avant et arrière se fait avec la molette de la souris ou les touches `+` et `-`. `Ctrl+0` affiche l'ensemble, et `Ctrl+1` la taille réelle (100 %).
- Pour décaler l'affichage, faites glisser en maintenant `Espace`, ou en maintenant le bouton de la molette.
- **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) et **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) annulent et rétablissent ce que vous avez dessiné.

La roue dentée **{{ui:canvas.settings.title}}** propose notamment l'affichage de la grille, l'assombrissement de l'extérieur de la zone de génération, la limitation des traits à l'intérieur de la zone de génération, et la fusion des calques raster visibles en un seul.

## Zone de génération (cadre de sélection)

Le cadre en pointillés sur la toile est « la zone où l'image sera créée cette fois ». À chaque génération, seul l'intérieur de ce cadre est créé, et sa taille devient celle de l'image.

- Passez à **{{ui:canvas.tool.bbox}}** (`C`) et faites glisser le cadre pour le déplacer. Faites glisser un coin ou un bord pour changer sa taille.
- Vous pouvez aussi fixer la taille avec **{{ui:params.image.bboxWidth}}** et **{{ui:params.image.bboxHeight}}** dans le panneau de gauche.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) ajuste le cadre aux images posées.

## Calques

En bas à droite, la liste des **{{ui:canvas.layers.title}}** affiche tout ce qui a été placé sur la toile. Le bouton **{{ui:common.add}}** permet d'en ajouter.

![Menu « Ajouter » des calques ouvert](shot:canvas-add-layer)

Les calques existent en plusieurs types, chacun avec son rôle.

| Type | Rôle |
|---|---|
| **{{ui:canvas.add.raster}}** | Le calque d'image ordinaire. On y dessine et on y pose des images. Ce qui s'y trouve constitue « l'image d'origine ». |
| **{{ui:canvas.add.control}}** | Une image qui sert d'indice de forme, de ligne ou de pose. Elle guide la génération sans faire partie du contenu de l'image. |
| **{{ui:canvas.add.inpaint}}** | On y peint la zone à redessiner. |
| **{{ui:canvas.add.regional}}** | Un calque qui permet de donner un prompt différent selon l'endroit. Dans la version de bureau actuelle, il ne peut pas servir à la génération. |
| **{{ui:canvas.add.globalRef}}** | Une image de référence dont l'ambiance générale est imitée. C'est la même chose que l'image de référence de l'onglet Générer. |

Dans la liste des calques, vous pouvez effectuer les opérations suivantes.

- L'icône d'œil bascule entre affiché et masqué, l'icône de cadenas verrouille ou déverrouille. Un calque masqué n'est pas utilisé pour la génération. On ne peut pas dessiner sur un calque verrouillé.
- Un double-clic sur le nom permet de le modifier.
- Le clic droit permet de dupliquer, de réorganiser (avancer ou reculer ; les calques du même type peuvent aussi être glissés dans la liste), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (calques de contrôle uniquement), de convertir vers un autre type, de copier dans le presse-papiers, de l'enregistrer dans la galerie avec **{{ui:canvas.entityMenu.saveToGallery}}**, de l'exporter avec **{{ui:canvas.entityMenu.exportToFile}}**, et de supprimer.
- **{{ui:canvas.layers.more}}** (« … ») permet aussi de fusionner les calques raster visibles en un seul et de supprimer tous les calques.

![Le menu contextuel d'un calque](shot:canvas-layer-menu)

Sous le calque sélectionné s'ouvrent ses réglages.

- {{ui:canvas.add.inpaint}} : la couleur du masque et le motif de remplissage (uniquement l'aspect à l'écran), et **{{ui:canvas.mask.denoiseLimit}}** (activé et abaissé, il aide à conserver l'image d'origine même à l'intérieur du masque). Dans le menu du clic droit du masque, **{{ui:canvas.entityMenu.invertMask}}** échange les zones masquées et libres dans la zone de génération.
- {{ui:canvas.add.control}} : voir la section « {{ui:canvas.add.control}} » ci-dessous.

## Comment la zone est redessinée

Lorsque vous cliquez sur **{{ui:params.invoke.invoke}}** sur la toile, l'application examine l'intérieur de la zone de génération et choisit seule la méthode de création. Vous n'avez rien à choisir.

| État de l'intérieur de la zone | Méthode |
|---|---|
| Le calque raster visible ne contient rien | Création à partir du texte (texte vers image). |
| Le calque raster n'est rempli qu'en partie | Les parties vides sont complétées pour agrandir l'image (outpainting). Elles sont d'abord remplies avec une couleur. |
| Tout est rempli et le masque d'inpainting n'a aucune peinture | L'image actuelle sert de base et est redessinée (image vers image). |
| Tout est rempli et le masque d'inpainting contient de la peinture | Seule la partie du masque est redessinée (inpainting). L'extérieur du masque reste l'image d'origine. |

Pour l'image vers image, le degré de changement se règle avec **{{ui:params.image.strength}}** dans le panneau de gauche. À 0, l'image reste telle quelle ; à 1, elle est entièrement redessinée.

Pour l'outpainting, ce qui remplit les parties vides se choisit avec **{{ui:params.compositing.infillTitle}}** dans **{{ui:params.compositing.title}}**, dans le panneau de gauche. Avec **{{ui:params.compositing.infill.color}}**, elles sont remplies de la couleur choisie (noir, blanc, gris, etc.). Avec les autres choix, les couleurs environnantes sont fondues pour remplir. Le flou de la jonction se règle avec **{{ui:params.compositing.maskBlur}}**.

> L'inpainting fonctionne tel quel avec un modèle ordinaire. Aucun « modèle d'inpainting » spécifique n'est nécessaire.

## Décider d'adopter le résultat (zone d'attente)

Une image créée sur la toile n'entre pas immédiatement dans la toile. Elle s'affiche par-dessus la zone de génération, et vous décidez de l'adopter avec la barre du bas (**{{ui:canvas.staging.title}}**).

| Bouton | Effet |
|---|---|
| Flèches gauche et droite (`←` `→`) | Afficher l'image suivante ou précédente quand plusieurs ont été créées. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Intègre cette image à la toile comme nouveau calque raster. Les autres images sont écartées. |
| **{{ui:canvas.staging.hideResults}}** | Masque les résultats pour comparer avec l'image d'origine. |
| **{{ui:canvas.staging.saveToGallery}}** | Enregistre cette image dans la galerie. |
| **{{ui:canvas.staging.discard}}** | Écarte cette image seulement. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Écarte tout. |

> Les images de résultat ne sont pas rangées telles quelles dans la galerie. Pour conserver une image dans la galerie, cliquez d'abord sur **{{ui:canvas.staging.saveToGallery}}**. Une image écartée disparaît.

La poignée (⋮⋮) à l'extrémité gauche de la barre des résultats sert à faire glisser l'image vers un autre endroit.

## Calque de contrôle

Le calque de contrôle est un indice du type « dessine en suivant cette forme, cette ligne, cette pose ». On y place un dessin au trait, un contour, une image de pose, etc.

Pour l'utiliser, il faut un modèle ControlNet compatible avec le modèle principal. Pour savoir comment l'installer, voir le chapitre [Modèles](08-models.md). Sélectionnez le calque, puis choisissez **{{ui:common.model}}** dans ses réglages. Sans modèle, un message comme « Le calque de contrôle 1 n'a pas de modèle choisi » s'affiche à l'endroit de la génération, et l'image ne peut pas être créée.

Les réglages sont les suivants.

- **{{ui:canvas.control.weight}}** : la force avec laquelle l'indice est suivi.
- **{{ui:canvas.control.begin}}** et **{{ui:canvas.control.end}}** : de quel pourcentage à quel pourcentage de la génération l'indice agit.
- **{{ui:canvas.control.controlMode}}** : il y a **{{ui:canvas.control.mode.balanced}}** et **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** se comporte pour l'instant comme **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}** : convertit l'image en image-indice (lignes, profondeur, etc.). Il s'agit d'une conversion simplifiée, effectuée dans l'application. Essayez avec **{{ui:canvas.control.process}}**, puis appliquez-la à l'image avec **{{ui:common.apply}}** si le résultat vous convient.

## Créer une pose (bonhomme en bâtons)

![Boîte de dialogue pour fixer une pose avec un bonhomme en bâtons](shot:pose)

Vous pouvez déplacer un bonhomme en bâtons pour fixer une pose. C'est pratique quand une pose décrite par du texte ne donne pas le résultat voulu.

1. Dans l'onglet **{{ui:app.tabs.canvas}}**, cliquez sur **{{ui:common.add}}** dans les calques, puis choisissez **{{ui:pose.menu}}**.
2. Choisissez une pose proche dans **{{ui:pose.preset}}** ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Faites glisser les cercles des articulations pour changer la posture. Vous pouvez aussi sélectionner un cercle et le déplacer avec les flèches du clavier (avec `Shift`, le déplacement est plus grand). **{{ui:pose.mirror}}** inverse la gauche et la droite, et **{{ui:pose.reset}}** revient au modèle de départ.
4. Choisissez **{{ui:pose.size}}**. En général, la taille de la toile convient.
5. Cliquez sur **{{ui:pose.use}}**.

La pose entre sur la toile comme calque de contrôle. Si la toile est vide, elle repart à neuf à cette taille.

Il faut pour cela un modèle ControlNet compatible avec OpenPose. S'il est installé, l'application le choisit automatiquement comme modèle du calque. S'il n'est pas installé, une notification vous l'indique. Installez le modèle, puis sélectionnez-le dans les réglages du calque.

> Seule la pose d'une personne peut être fixée. Les doigts et l'orientation du visage ne le sont pas ; précisez donc le visage et les mains dans le prompt.

> L'effet de la pose dépend du **{{ui:canvas.control.weight}}** du calque. Le calque de pose est réglé d'emblée à la force maximale, et agit du début à la fin. Pour laisser plus de liberté à la pose, abaissez-le.

### Créer une pose sur la toile

![Le bonhomme en bâtons placé sur la toile avec l'outil de pose](shot:canvas-pose)

Avec l'outil **{{ui:canvas.tool.pose}}** (`O`), vous pouvez créer une pose directement sur la toile. Une pose placée peut être retouchée autant de fois que vous le voulez.

- Un clic sur un endroit vide place un bonhomme en bâtons debout. Si aucun calque de contrôle n'est sélectionné, un nouveau calque de contrôle est créé, avec la force prévue pour les poses et un modèle compatible avec OpenPose (s'il est installé).
- Faire glisser le cercle d'une articulation la fait tourner avec le membre qui la suit (la longueur des os ne change pas). Faire glisser le cou déplace tout le corps. En faisant glisser avec `Shift` enfoncée, seule cette articulation bouge.
- Un clic sur une articulation avec `Alt` enfoncée la masque ou la réaffiche (pour des membres qui dépassent de l'écran, par exemple).
- La touche `R` ou le bouton **{{ui:canvas.pose.random}}** de la barre remplace la pose du calque sélectionné par une nouvelle pose aléatoire. Vous pouvez appuyer autant de fois que vous voulez, et essayer jusqu'à ce qu'une pose vous plaise.
- Les boutons du nombre et de l'éclair dans la barre de l'outil de pose génèrent à la suite ce nombre d'images, en changeant la pose à chaque fois (jusqu'à 16). La seed change aussi à chaque pose, si bien qu'avec les mêmes réglages vous obtenez des images dans des postures variées. Si la génération ne peut pas démarrer, la raison s'affiche et rien ne commence.
- Un même calque peut accueillir autant de personnages que vous voulez. Le retournement gauche-droite, la rotation et l'agrandissement ou la réduction se font depuis le menu du clic droit du calque.
- Vous pouvez aussi le demander avec des mots. Gardez l'onglet **{{ui:app.tabs.canvas}}** ouvert, ouvrez l'assistant IA et décrivez la pose, par exemple « une pose de course » ou « lève la main gauche » : un personnage est placé (jusqu'à 4 personnages). Dites ensuite « penche-le un peu plus en avant » et l'assistant corrige cette pose. La pose demandée est une déduction à partir de vos mots ; si elle ne convient pas, faites glisser les articulations pour la corriger.
- On peut aussi créer une pose à partir d'une personne d'une image. Faites un clic droit sur une image de la galerie et choisissez **{{ui:canvas.poseFromImage.menu}}**, ou appuyez sur le bouton du même nom dans la barre de l'outil de pose : les squelettes des personnes sont lus et placés comme des bonshommes (jusqu'à 4 personnes). Les poses placées se corrigent comme n'importe quelle autre. L'extension (comfyui_controlnet_aux) est nécessaire ; si elle manque, la fenêtre propose de l'installer. La première fois, le téléchargement des modèles prend un moment. Une personne trop petite ou en partie cachée peut ne pas être trouvée.
- Le bouton **{{ui:canvas.pose.presets}}** de la barre de l'outil de pose ouvre une fenêtre avec les catégories à gauche et une carte par pose à droite. Chaque carte dessine le personnage OpenPose dans un cadre de la forme de la zone de génération. Les « {{ui:canvas.pose.group.panel}} » (plans serrés et larges, deux personnes, groupes, scènes du quotidien, drame et émotions) fixent aussi où se tiennent les personnes et leur taille, et remplacent toutes les poses du calque sélectionné. Les « {{ui:canvas.pose.group.standard}} » et « {{ui:canvas.pose.group.manga}} » remplacent la première pose du calque sélectionné, au même endroit et à la même taille ; s'il n'y en a pas, une nouvelle est placée. Une pose qui sortirait du cadre, bras levés ou coup de pied, est réduite pour y tenir.
- Le bouton **{{ui:canvas.pose3d.menu}}** de la barre de l'outil de pose modifie une pose en 3D (la première pose du calque de contrôle sélectionné, ou un bonhomme debout s'il n'y en a pas). Faire glisser une articulation la déplace en gardant la longueur de l'os, et un os peut pointer vers l'arrière ou vers vous. Faire glisser l'arrière-plan tourne le corps, et la molette zoome. Les boutons **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** et **{{ui:canvas.pose3d.top}}** tournent vers des vues fixes. **{{ui:canvas.pose3d.apply}}** place sur la toile la forme que vous voyez comme pose (la profondeur est mémorisée : on peut la rouvrir en 3D et la tourner encore) ; fermer sans l'utiliser laisse la pose telle quelle. La vue 3D demande WebGL dans le navigateur ; s'il manque, la fenêtre le signale.

![Lecture des poses d'une image avant de les placer sur la toile](shot:canvas-pose-from-image)

![La fenêtre « Poses et compositions prêtes à l'emploi » avec la catégorie « Deux personnes » choisie](shot:canvas-pose-presets)

![La fenêtre de modification d'une pose en 3D](shot:canvas-pose-3d)

Pour extraire une pose à partir d'une photo, vous pouvez utiliser le modèle prédéfini « {{ui:workflows.templates.poseControl.title}} » du chapitre [Workflows](06-upscaling-workflows.md).

## Le guidage régional n'est pas encore disponible

**{{ui:canvas.add.regional}}** est présent à l'écran, mais ne peut pas servir à la génération dans la version de bureau actuelle. S'il existe un calque de guidage régional contenant de la peinture, la génération est refusée et un message d'échec (en anglais) s'affiche. Pour générer sur la toile, masquez ou supprimez les calques de guidage régional.

## Enregistrer et nettoyer

- Pour enregistrer l'image de la toile dans la galerie, cliquez sur **{{ui:canvas.toolbar.saveToGallery}}** (icône de disque) dans la barre du haut. Les calques raster visibles situés dans la zone de génération sont fusionnés et enregistrés en une seule image.
- Pour n'enregistrer qu'un seul calque, faites un clic droit dessus et choisissez **{{ui:canvas.entityMenu.saveToGallery}}**.
- **{{ui:canvas.settings.title}}** propose aussi **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** et **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** supprime tous les calques.

Des fonctions de retouche existent aussi dans [Retoucher et réutiliser les images](04-improve.md). Le résultat de « {{ui:gallery.menu.segment}} » peut être envoyé vers la toile pour être encore redessiné.
