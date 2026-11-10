# Toile

![L'onglet Toile en entier. La toile au centre, la liste des calques en bas à droite](shot:canvas)

L'onglet **{{ui:app.tabs.canvas}}** est un établi pour « dessiner, placer et redessiner seulement une partie » d'une image. Vous pouvez y placer des images et les étendre, poser un masque sur ce que vous voulez redessiner, ou fixer une pose avec un bonhomme en fil de fer.

L'écran se divise en trois parties.

- À gauche : le même panneau de réglages que l'onglet Générer (prompt, modèle, taille, etc.). Sur la toile, l'élément **{{ui:params.compositing.title}}** s'y ajoute.
- Au centre : la toile. Les boutons des outils sont alignés au-dessus.
- À droite : la liste des **{{ui:canvas.layers.title}}**, où l'on place les images.

Si vous appuyez sur **{{ui:params.invoke.invoke}}** sans rien avoir placé, une image ordinaire est créée dans le cadre en pointillés (la zone de génération). La vraie force de la toile apparaît quand vous y placez des images ou des esquisses. Les calques et les masques sont enregistrés automatiquement et reviennent quand vous rouvrez l'application (l'historique d'annulation n'est pas enregistré).

## Placer et dessiner des images

Il y a plusieurs façons de mettre une image sur la toile.

- Dessiner au pinceau (choisissez d'abord **{{ui:canvas.tool.brush}}**, ou appuyez sur `B`). Si aucun calque n'est sélectionné, un {{ui:canvas.add.raster}} est créé automatiquement.
- Faire glisser une image de la galerie sur la toile. Un cadre pour choisir la destination (raster, contrôle, masque d'inpainting, etc.) apparaît ; déposez-la dessus.
- Avec `Ctrl+V`, l'image du presse-papiers est collée comme nouveau calque raster (elle est aussi enregistrée dans la galerie).
- Faire un clic droit sur une image de la galerie (dans la visionneuse, l'icône en forme de pinceau) et choisir la destination avec **{{ui:gallery.menu.sendToCanvas}}**.

Voici les destinations.

| Destination | Ce que cela devient |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | La toile est d'abord vidée, puis repart avec la taille de cette image. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Repart de même à neuf, mais l'image devient un calque de contrôle. |
| **{{ui:gallery.canvas.raster}}** | Est ajoutée à la toile actuelle comme calque raster. |
| **{{ui:gallery.canvas.control}}** | Est ajoutée comme calque de contrôle. |
| **{{ui:gallery.canvas.inpaint}}** | Est ajoutée comme masque d'inpainting. |
| **{{ui:gallery.canvas.regional}}** | Est ajoutée comme image de référence du guidage régional (voir [Guidage régional](#guidage-régional)). |

## Outils

Les outils sont alignés dans la barre du haut. Vous pouvez aussi les changer avec les touches de lettres du clavier. Au démarrage de l'application, **{{ui:canvas.tool.view}}** est sélectionné : si vous faites d'abord glisser la toile, l'affichage se décale simplement et rien n'est dessiné.

| Outil | Touche | À quoi il sert |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Dessine. La couleur se change avec le bouton de couleur de la barre. |
| **{{ui:canvas.tool.eraser}}** | `E` | Efface ce que vous avez dessiné. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Applique une mosaïque là où vous passez (pour cacher quelque chose). Le grain se règle avec le nombre de la barre. N'agit que sur les calques qui contiennent une image. |
| **{{ui:canvas.tool.rect}}** | `U` | Peint un rectangle. |
| **{{ui:canvas.tool.lasso}}** | `L` | Entoure une forme libre et la remplit de couleur (sur un masque, elle est masquée). |
| **{{ui:canvas.tool.pose}}** | `O` | Place sur un calque de contrôle un bonhomme en fil de fer et fait bouger ses articulations (voir « Créer une pose sur la toile » plus bas). |
| **{{ui:canvas.tool.move}}** | `V` | Déplace les calques. Les touches fléchées déplacent le calque sélectionné de 1 px (de 10 px avec Shift). |
| **{{ui:canvas.tool.bbox}}** | `C` | Déplace ou redimensionne la zone de génération (la boîte englobante). |
| **{{ui:canvas.tool.view}}** | `H` | Décale l'affichage. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Prélève une couleur dans l'image. |
| **{{ui:canvas.tool.bucket}}** | `K` | Remplit la zone de couleur proche de l'endroit où vous cliquez. Jusqu'où une couleur est considérée comme proche se règle avec **{{ui:canvas.toolbar.bucketTolerance}}** dans la barre. |

Vous pouvez aussi faire ce qui suit.

- L'épaisseur du pinceau se change avec **{{ui:canvas.toolbar.brushWidth}}** dans la barre, ou avec les touches `[` et `]`. `Q` alterne avec l'outil utilisé juste avant.
- Pour zoomer et dézoomer, utilisez la molette de la souris ou les touches `+` et `-`. `Ctrl+0` affiche l'ensemble, `Ctrl+1` la taille réelle (100 %).
- Pour décaler l'affichage, faites glisser en maintenant `Espace`, ou en appuyant sur le bouton de la molette.
- **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) et **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) annulent et rétablissent ce que vous avez dessiné.

L'engrenage **{{ui:canvas.settings.title}}** contient l'affichage de la grille, l'assombrissement de l'extérieur de la zone de génération, le réglage qui limite les traits dessinés à l'intérieur de la zone de génération, l'opération qui fusionne en un seul les calques raster affichés, etc.

## Zone de génération (boîte englobante)

Le cadre en pointillés sur la toile est « la zone où l'image est créée cette fois ». À chaque génération, seul l'intérieur de ce cadre est créé, et sa taille devient celle de l'image.

- Passez à **{{ui:canvas.tool.bbox}}** (`C`) et faites glisser le cadre pour le déplacer. En faisant glisser un coin ou un côté, vous changez sa taille.
- Vous pouvez aussi fixer la taille avec **{{ui:params.image.bboxWidth}}** et **{{ui:params.image.bboxHeight}}** dans le panneau de gauche.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) ajuste le cadre aux images placées.

## Calques

Les éléments placés sur la toile sont listés dans **{{ui:canvas.layers.title}}**, en bas à droite. Le bouton **{{ui:common.add}}** en ajoute.

![Le menu « Ajouter » des calques ouvert](shot:canvas-add-layer)

Il existe des types de calques aux rôles différents.

| Type | Rôle |
|---|---|
| **{{ui:canvas.add.raster}}** | Le calque d'image ordinaire. On y dessine et on y place des images. Ce qui s'y trouve devient l'« image d'origine ». |
| **{{ui:canvas.add.control}}** | Une image qui sert de repère pour une forme, un trait, une pose, etc. Elle sert d'instruction à la génération et n'entre pas dans le contenu de l'image. |
| **{{ui:canvas.add.inpaint}}** | Vous peignez la zone en indiquant « redessiner ici ». |
| **{{ui:canvas.add.regional}}** | Un calque qui attribue un prompt différent selon l'endroit (voir [Guidage régional](#guidage-régional)). |
| **{{ui:canvas.add.globalRef}}** | Une image de référence dont l'ambiance générale est imitée. C'est la même chose que les images de référence de l'onglet Générer. |

Dans la liste des calques, vous pouvez faire ce qui suit.

- L'icône en forme d'œil bascule entre affichage et masquage, l'icône en forme de cadenas verrouille. Un calque masqué n'est pas utilisé pour la génération. On ne peut pas dessiner sur un calque verrouillé.
- Un double-clic sur le nom permet de le changer.
- Le clic droit permet de dupliquer, de réordonner (avancer ou reculer ; les calques du même type peuvent aussi être réordonnés en les faisant glisser dans la liste), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (calques de contrôle uniquement), de convertir vers un autre type, de copier dans le presse-papiers, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** et de supprimer.
- **{{ui:canvas.layers.more}}** (« … ») permet aussi de fusionner en un seul les calques raster affichés et de supprimer tous les calques.

![Le menu du clic droit sur un calque](shot:canvas-layer-menu)

Sous le calque sélectionné s'ouvrent les réglages de ce calque.

- {{ui:canvas.add.inpaint}} : La couleur et le motif de remplissage du masque (uniquement leur aspect à l'écran), et **{{ui:canvas.mask.denoiseLimit}}** (si vous l'activez et l'abaissez, l'image d'origine est plus facilement conservée même à l'intérieur du masque). Avec **{{ui:canvas.entityMenu.invertMask}}** du clic droit, vous échangez la partie masquée et la partie libre à l'intérieur de la zone de génération. **{{ui:canvas.partFix.redraw}}**, **{{ui:canvas.partFix.erase}}** et **{{ui:canvas.partFix.cutOutAction}}** permettent de redessiner la partie peinte à partir d'une instruction écrite, de l'effacer ou de la détourer ([Sélectionner une zone et la corriger](04-improve.md)).
- {{ui:canvas.add.control}} : Voir la rubrique « {{ui:canvas.add.control}} » plus bas.

## Comment l'image est redessinée

Quand vous appuyez sur **{{ui:params.invoke.invoke}}** sur la toile, l'application regarde l'intérieur de la zone de génération et décide automatiquement comment créer l'image. Vous n'avez pas à choisir vous-même.

| État de l'intérieur de la zone de génération | Méthode de création |
|---|---|
| Rien n'est dessiné sur les calques raster affichés | Création à neuf à partir d'un texte (texte vers image). |
| Les calques raster n'en remplissent qu'une partie | La partie vide est ajoutée et l'image est étendue (outpainting). La partie vide est d'abord remplie avec une couleur. |
| Tout est rempli, et le masque d'inpainting n'a aucune peinture | L'image actuelle sert de base et est redessinée (image vers image). |
| Tout est rempli, et le masque d'inpainting a de la peinture | Seule la partie du masque est redessinée (inpainting). L'extérieur du masque reste comme l'image d'origine. |

Pour image vers image, l'ampleur du changement se règle avec **{{ui:params.image.strength}}** dans le panneau de gauche. À 0, l'image reste telle quelle ; à 1, elle est entièrement redessinée.

Avec l'outpainting, ce qui remplit la partie vide se choisit avec **{{ui:params.compositing.infillTitle}}** dans **{{ui:params.compositing.title}}**, dans le panneau de gauche. Avec **{{ui:params.compositing.infill.color}}**, elle est remplie avec la couleur choisie (noir, blanc, gris, etc.). Avec les autres choix, elle est remplie en fondant les couleurs environnantes. Le flou de la jonction se règle avec **{{ui:params.compositing.maskBlur}}**.

> L'inpainting fonctionne directement avec un modèle ordinaire. Il n'est pas nécessaire d'avoir un « modèle d'inpainting » spécial.

## Décider d'adopter le résultat (zone d'attente)

Une image créée sur la toile n'entre pas aussitôt dans la toile. Elle s'affiche superposée à la zone de génération, et la barre du bas (**{{ui:canvas.staging.title}}**) vous permet de décider de l'adopter ou non.

| Bouton | Ce qu'il fait |
|---|---|
| Flèches gauche et droite (`←` `→`) | Quand plusieurs images ont été créées, elles permettent de voir l'image suivante ou précédente. Tant que la création se poursuit, la dernière page est la page « en cours de génération », et l'état d'avancement n'apparaît que sur cette page. Si vous regardez la page d'une image terminée, l'affichage ne bascule pas quand l'image suivante est prête. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Fait entrer cette image dans la toile comme nouveau calque raster. Les autres images sont jetées. |
| **{{ui:canvas.staging.hideResults}}** | Masque les résultats pour comparer avec l'image d'origine. |
| **{{ui:canvas.staging.saveToGallery}}** | Enregistre cette image dans la galerie. |
| **{{ui:canvas.staging.discard}}** | Jette cette image seulement. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Jette tout. |

> Une image de résultat ne s'ajoute pas telle quelle à la galerie. Pour garder une image dans la galerie, appuyez d'abord sur **{{ui:canvas.staging.saveToGallery}}**. Une image jetée disparaît.

La poignée (⋮⋮) à l'extrémité gauche de la barre des résultats sert à faire glisser l'image vers un autre endroit pour la transmettre.

## Calque de contrôle

Le calque de contrôle est un repère du type « dessine en suivant cette forme, ce trait, cette pose ». On y place un dessin au trait, un contour, une image de pose, etc.

Pour l'utiliser, il faut un modèle ControlNet adapté au modèle principal. Pour l'installer, voir le chapitre [Modèles](08-models.md). Sélectionnez le calque et choisissez **{{ui:common.model}}** dans ses réglages. Tant qu'il n'y a pas de modèle, un message comme « Le calque de contrôle 1 n'a pas de modèle » s'affiche au niveau de la génération et la création est impossible.

Voici les réglages.

- **{{ui:canvas.control.weight}}** : La force avec laquelle le repère est suivi.
- **{{ui:canvas.control.begin}}** et **{{ui:canvas.control.end}}** : De quelle fraction à quelle fraction de la génération l'effet agit.
- **{{ui:canvas.control.controlMode}}** : Il y a **{{ui:canvas.control.mode.balanced}}** et **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** a pour l'instant le même comportement que **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}** : Convertit l'image en une image de repère (traits, profondeur, etc.). C'est une conversion simplifiée, faite dans l'application. Essayez avec **{{ui:canvas.control.process}}**, et si le résultat vous convient, appliquez-le à l'image avec **{{ui:common.apply}}**.

## Créer une pose (bonhomme en fil de fer)

![La boîte de dialogue pour fixer une pose avec un bonhomme en fil de fer](shot:pose)

Vous pouvez fixer une pose en faisant bouger un bonhomme en fil de fer. C'est pratique quand une pose décrite par écrit ne donne pas de bons résultats.

1. Dans l'onglet **{{ui:app.tabs.canvas}}**, appuyez sur **{{ui:common.add}}** dans les calques et choisissez **{{ui:pose.menu}}**.
2. Choisissez dans **{{ui:pose.preset}}** une pose proche ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Faites glisser les cercles des articulations pour changer la posture. Vous pouvez aussi sélectionner un cercle et le déplacer avec les touches fléchées (avec `Shift`, il bouge davantage). **{{ui:pose.mirror}}** inverse la gauche et la droite, et **{{ui:pose.reset}}** revient au modèle de départ.
4. Choisissez **{{ui:pose.size}}**. En général, la taille de la toile convient.
5. Appuyez sur **{{ui:pose.use}}**.

La pose entre dans la toile comme calque de contrôle. Si la toile est vide, elle repart à neuf avec cette taille.

Il faut pour cela un modèle ControlNet compatible avec OpenPose. S'il est installé, l'application le choisit automatiquement comme modèle du calque. S'il n'est pas installé, une notification vous le dit. Installez le modèle, puis choisissez-le dans les réglages du calque.

> Vous ne pouvez fixer que la pose d'une seule personne. Comme on ne peut pas décider des doigts ni de l'orientation du visage, indiquez le visage et les mains dans le prompt.

> L'effet de la pose est déterminé par **{{ui:canvas.control.weight}}** du calque. Le calque de pose est réglé dès le départ sur la force maximale, et agit du début à la fin. Si vous voulez laisser de la liberté à la pose, abaissez cette valeur.

### Créer une pose sur la toile

![L'outil de pose avec un bonhomme en fil de fer placé sur la toile](shot:canvas-pose)

Avec l'outil **{{ui:canvas.tool.pose}}** (`O`), vous pouvez créer une pose directement sur la toile. Une pose placée peut être retouchée autant de fois que vous voulez.

- Un clic à un endroit vide place un bonhomme debout. Si aucun calque de contrôle n'est sélectionné, un nouveau calque de contrôle est créé, avec la force prévue pour les poses et, s'il est installé, un modèle compatible avec OpenPose.
- Faire glisser le cercle d'une articulation fait tourner tout le membre qui la suit (la longueur des os ne change pas). Faire glisser le cou déplace tout le corps. En faisant glisser en maintenant `Shift`, seule cette articulation bouge.
- Un clic sur une articulation en maintenant `Alt` la masque ou la rend de nouveau visible (pour les membres qui sortent de l'écran, par exemple).
- La touche `R`, ou le bouton **{{ui:canvas.pose.random}}** de la barre, change la pose du calque sélectionné en une nouvelle pose aléatoire. Vous pouvez appuyer autant de fois que vous voulez, jusqu'à ce qu'elle vous plaise.
- Le nombre et le bouton en forme d'éclair de la barre de l'outil de pose génèrent à la suite autant d'images, en changeant la pose (16 au maximum). Le seed change aussi à chaque pose, si bien que des images de postures variées avec les mêmes réglages s'alignent. Si la génération n'est pas possible, la raison s'affiche et rien ne démarre.
- Un même calque peut contenir autant de personnages que vous voulez. L'inversion gauche-droite, la rotation et l'agrandissement ou la réduction se font depuis le menu du clic droit du calque.
- Vous pouvez aussi le demander par écrit. Avec l'onglet **{{ui:app.tabs.canvas}}** ouvert, ouvrez l'agent et dites par exemple « une pose de course » ou « lève la main gauche » : un bonhomme est placé (4 personnes au maximum). Si vous dites ensuite « un peu plus penché en avant », il corrige cette pose. La pose demandée est une déduction à partir des mots ; si elle ne correspond pas à ce que vous voulez, corrigez-la en faisant glisser les articulations.
- Elle peut aussi être créée à partir des personnes présentes dans une image. Faites un clic droit sur une image de la galerie et choisissez **{{ui:canvas.poseFromImage.menu}}** : le squelette des personnes visibles est lu aussitôt, et le nombre de personnes trouvées s'affiche dans la bande de la visionneuse. Appuyez sur **{{ui:canvas.poseFromImage.replace}}** ou **{{ui:canvas.poseFromImage.add}}** pour les placer sur la toile comme bonhomme en fil de fer (4 personnes au maximum). Le bouton de même nom dans la barre de l'outil de pose utilise l'image choisie dans la galerie ; si aucune n'est choisie, il ouvre un écran de choix de fichier image. Une pose placée se corrige comme une pose ordinaire. Il faut pour cela une extension (comfyui_controlnet_aux) ; si elle n'est pas installée, la bande vous guide pour l'installer. À la première lecture, le téléchargement des modèles prend du temps. Si la personne est trop petite ou cachée, elle peut ne pas être trouvée.
- Le bouton **{{ui:canvas.pose.presets}}** de la barre de l'outil de pose ouvre un écran avec les catégories à gauche et les cartes de poses à droite. Sur les cartes, un bonhomme OpenPose est dessiné à l'intérieur du cadre de la zone de génération. « {{ui:canvas.pose.group.panel}} » (plan serré et plan large, deux personnes, trois personnes ou plus, une scène du quotidien, drame et émotion) fixe aussi la position et la taille des personnages ; en la choisissant, vous remplacez toutes les poses du calque. « {{ui:canvas.pose.group.standard}} » et « {{ui:canvas.pose.group.manga}} » remplacent la première pose du calque sélectionné, avec la même position et la même taille. S'il n'y a pas de pose, une nouvelle est placée. Si un bras levé ou une jambe lancée déborde du cadre, le bonhomme est réduit jusqu'à tenir dans le cadre.
- Le bouton **{{ui:canvas.pose3d.menu}}** de la barre de l'outil de pose permet de modifier la pose en 3D (la première pose du calque de contrôle sélectionné ; s'il n'y en a pas, on part d'un mannequin debout). En faisant glisser une articulation, elle bouge en conservant la longueur des os. Vous pouvez aussi l'orienter vers l'arrière ou vers l'avant. Faire glisser l'arrière-plan change l'orientation du corps, et la molette zoome et dézoome. Les boutons **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** et **{{ui:canvas.pose3d.top}}** donnent des orientations fixes. En appuyant sur **{{ui:canvas.pose3d.apply}}**, la forme vue dans l'orientation actuelle entre dans la toile comme pose (la profondeur est aussi mémorisée, donc vous pouvez la rouvrir en 3D et la faire tourner) ; si vous fermez sans appuyer, rien ne change. L'affichage 3D nécessite WebGL dans le navigateur ; dans un environnement où il n'est pas disponible, un message l'indique.

![La bande qui permet de vérifier la pose lue dans une image avant de la placer sur la toile](shot:canvas-pose-from-image)

![L'écran « Poses et compositions classiques ». La catégorie « Deux personnes » est sélectionnée](shot:canvas-pose-presets)

![La boîte de dialogue pour modifier la pose en 3D](shot:canvas-pose-3d)

Pour extraire une pose d'une photo, vous pouvez utiliser le modèle « {{ui:workflows.templates.poseControl.title}} » des [workflows](06-upscaling-workflows.md).

## Guidage régional

Un calque **{{ui:canvas.add.regional}}** attribue un prompt qui n'agit que là où vous avez peint. Peignez une zone, puis ajoutez dans les réglages du calque un prompt positif (ce qu'il faut dessiner là) ou un prompt négatif (ce que vous ne voulez pas voir y entrer). Le prompt de l'ensemble de l'image agit comme avant sur la totalité, et le prompt du calque s'y ajoute à l'intérieur de la zone. Si vous activez **Négatif auto**, le prompt positif du calque est atténué en dehors de la zone, si bien qu'un « chapeau rouge » n'apparaît qu'à l'endroit visé.

- Un calque sans peinture dans la zone de génération, ou sans prompt, ne précise rien et n'est donc pas utilisé.
- On peut en utiliser 8 au maximum en même temps. Les calques masqués ne sont pas utilisés.
- Le guidage régional s'utilise avec les modèles SD1.X et SDXL. Avec les familles plus récentes (Flux, Qwen-Image, etc.), la génération échoue et un message l'indique. Dans ce cas, masquez le calque.
- Les images de référence ajoutées à un calque régional ne sont pas encore utilisées.

## Enregistrer et ranger

- Pour enregistrer l'image de la toile dans la galerie, appuyez sur **{{ui:canvas.toolbar.saveToGallery}}** (l'icône en forme de disque) dans la barre du haut. Les calques raster affichés qui se trouvent dans la zone de génération sont enregistrés fusionnés en une seule image.
- Pour obtenir un fichier PSD en gardant les calques séparés, appuyez sur **{{ui:canvas.toolbar.savePsd}}** (l'icône d'un document avec une flèche vers le bas). L'intérieur de la zone de génération est enregistré comme un téléchargement du navigateur. Chaque calque raster devient un calque PSD, en gardant son nom, sa position, son opacité et son état affiché ou masqué. Les calques de contrôle entrent comme calques masqués ; les masques d'inpainting et le guidage régional n'entrent pas.
- Pour n'enregistrer qu'un seul calque, faites un clic droit sur le calque et choisissez **{{ui:canvas.entityMenu.saveToGallery}}**.
- **{{ui:canvas.settings.title}}** contient aussi **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** et **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** supprime tous les calques.

D'autres fonctions de retouche se trouvent dans [Retoucher et réutiliser les images](04-improve.md). « {{ui:gallery.menu.segment}} » ouvre l'image sur la toile, puis redessine, efface ou détoure la partie que vous avez peinte.
