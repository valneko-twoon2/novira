# Mise à l'échelle et workflows

Ce chapitre présente l'onglet **{{ui:app.tabs.upscaling}}**, qui agrandit une image, et l'onglet **{{ui:app.tabs.workflows}}**, où l'on assemble soi-même des traitements.

## Mise à l'échelle

![Onglet Mise à l'échelle. Au centre, la zone de dépôt de l'image et les cartes des étapes](shot:upscaling)

L'onglet **{{ui:app.tabs.upscaling}}** agrandit une image tout en ajoutant des détails. Il ne se contente pas d'étirer l'image : il l'agrandit d'abord avec un modèle d'agrandissement, puis redessine les détails fins à l'aide du prompt et de ControlNet tile.

### Ce dont vous avez besoin

Deux modèles sont nécessaires. S'ils ne sont pas installés, un avertissement apparaît dans le panneau de gauche. Le bouton « {{ui:params.upscale.openModels}} » mène à l'écran des modèles. Pour savoir comment les installer, voir le chapitre [Modèles](08-models.md).

- {{ui:params.upscale.model}} (comme Real-ESRGAN, un modèle destiné à agrandir les images)
- {{ui:params.upscale.tileControlnet}} compatible avec le modèle principal sélectionné

Si aucun modèle d'agrandissement n'est installé, des candidats s'affichent dans le panneau de gauche. Choisissez-en un portant la mention **{{ui:media.choice.recommended}}** et installez-le avec **{{ui:models.install.install}}**.

### Marche à suivre

1. Faites glisser l'image à agrandir depuis la galerie vers la carte centrale ou vers le cadre **{{ui:params.upscale.title}}** du panneau de gauche. Vous pouvez aussi faire un clic droit sur une image de la galerie (dans la visionneuse, utiliser la barre d'outils) et choisir **{{ui:gallery.menu.upscale}}**, ou ouvrir l'image dans la visionneuse et appuyer sur `Shift+U` : l'onglet change et l'image y est placée.
2. Choisissez **{{ui:params.upscale.model}}**.
3. Choisissez **{{ui:params.upscale.scale}}** parmi 2x, 4x et 8x. La taille finale s'affiche, par exemple « Sortie : 2048×2048 ».
4. Ajustez le rendu avec les deux curseurs suivants.
   - **{{ui:params.upscale.creativity}}** : plus la valeur est élevée, plus le résultat s'écarte de l'image d'origine et de nouveaux détails sont ajoutés.
   - **{{ui:params.upscale.structure}}** : plus la valeur est élevée, plus la forme et la disposition de l'image d'origine sont conservées.
5. Choisissez **{{ui:params.upscale.tileControlnet}}**. Si nécessaire, choisissez aussi **{{ui:params.upscale.postProcessing}}** (il affine l'image dessinée, qui est ensuite ajustée à la taille de sortie).
6. Cliquez sur **{{ui:params.invoke.invoke}}**.

L'image obtenue arrive dans la galerie.

- La taille de sortie va jusqu'à 8192 pixels par côté. Au-delà, un avertissement s'affiche : réduisez alors le facteur d'agrandissement.
- Le prompt influe sur les détails ajoutés. Si vous saisissez le prompt de l'image d'origine, l'orientation du résultat colle plus facilement.
- Si l'image agrandie diffère trop de l'originale, abaissez **{{ui:params.upscale.creativity}}** et augmentez **{{ui:params.upscale.structure}}**.

> Pour agrandir plusieurs images à la fois, sélectionnez-les dans la galerie et utilisez **{{ui:gallery.menu.batch}}** par clic droit ([Retoucher et réutiliser les images](04-improve.md)). Dans ce cas, l'agrandissement se fait uniquement avec le modèle d'agrandissement.

## Workflows

![Onglet Workflows. À droite, l'écran où l'on trace les liaisons entre traitements ; à gauche, le formulaire](shot:workflows)

Un workflow est une fonction qui permet d'assembler, en reliant des éléments (nœuds), une suite de traitements comme « charger un modèle, saisir un prompt, créer une image, enregistrer ». Il permet de construire des étapes détaillées que l'onglet Générer ne permet pas d'atteindre, ou un enchaînement combinant plusieurs traitements.

Pour commencer, il est conseillé d'ouvrir un modèle prédéfini depuis **{{ui:workflows.panel.templates}}** (voir la section plus bas).

L'écran se compose de deux parties.

- Au centre : l'**{{ui:app.views.editor}}**. On y dispose des nœuds et on les relie par des lignes.
- Panneau de gauche : cinq onglets, **{{ui:workflows.panel.workflow}}** (le formulaire), **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** et **{{ui:workflows.panel.data}}**.

Pour exécuter un workflow, cliquez sur le bouton **{{ui:params.invoke.invoke}}** en haut du panneau de gauche. S'il y a un problème (par exemple aucun nœud de sortie comme « {{ui:workflows.nodes.save_image.title}} », ou aucun modèle sélectionné), la raison pour laquelle la génération est impossible s'affiche.

### Ajouter des nœuds et les relier

1. Cliquez sur **{{ui:workflows.toolbar.addNode}}** (+) en haut à gauche de l'éditeur. Il s'ouvre aussi avec `Shift+A` ou `Space` au clavier.
2. Choisissez un nœud dans la liste. Vous pouvez filtrer en saisissant un mot dans le champ de recherche du haut. Les catégories de gauche permettent de filtrer par type de nœud standard ou par extension installée.
3. Faites glisser depuis le cercle situé à droite d'un nœud (sortie) jusqu'au cercle situé à gauche d'un autre nœud (entrée) pour les relier. Seuls des éléments du même type peuvent être reliés.

![Liste affichée lors de l'ajout d'un nœud](shot:workflows-add-node)

Quelques fonctions facilitent la liaison.

- Si vous déposez une ligne dans un espace vide, seuls les nœuds pouvant s'y relier apparaissent dans la liste. Lorsque vous en choisissez un, il est ajouté et relié directement.
- Si vous déposez une ligne sur un nœud, elle se relie automatiquement à l'entrée qui convient.
- Un nœud sélectionné est supprimé avec `Delete`. `Ctrl+C` et `Ctrl+V` permettent de le dupliquer. `Ctrl+Z` annule et `Ctrl+Shift+Z` rétablit.
- Si vous faites glisser une image de la galerie vers l'éditeur, un nœud « {{ui:workflows.nodes.image.title}} » contenant cette image est ajouté.
- La flèche à gauche du nom d'un nœud permet de le replier. Un double-clic sur le nom permet de le renommer.

Les valeurs de réglage d'un nœud se saisissent directement dans le nœud. La valeur d'une entrée reliée provient de l'élément auquel elle est reliée.

### Disposition des boutons

Ce sont les boutons situés en haut à gauche de l'éditeur.

| Bouton | Effet |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | Ajoute un nœud. |
| **{{ui:workflows.toolbar.library}}** | Ouvre la liste des workflows. |
| **{{ui:workflows.toolbar.new}}** | Démarre un workflow vide. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Enregistre. À la première sauvegarde, un nom est demandé. |
| **{{ui:workflows.toolbar.optimize}}** | Fusionne les nœuds en double, supprime les nœuds non reliés à une sortie ainsi que les connexions inutiles, puis réorganise de gauche à droite. Peut être annulé. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

La roue dentée **{{ui:workflows.settings.title}}**, en haut à droite, permet de basculer l'affichage de la mini-carte, l'alignement sur la grille, etc.

**{{ui:workflows.settings.autoTidy}}** est activé par défaut. Quand vous ajoutez ou supprimez des nœuds ou des lignes, les nœuds sont réorganisés automatiquement de gauche à droite après un court instant, et les nœuds en double qui ont la même fonction sont fusionnés. Quand une fusion a lieu, une notification s'affiche et `Ctrl+Z` permet de revenir en arrière. Les nœuds non reliés ne sont pas supprimés automatiquement. Désactivez cette option si vous préférez les ranger vous-même.

Quand il y a des modifications non enregistrées, un point apparaît à côté du nom. En passant à un autre workflow, une confirmation vous demande si vous pouvez abandonner les modifications.

### Utiliser le formulaire

Quand il y a beaucoup de nœuds, l'éditeur devient difficile à lire. Vous pouvez alors créer un « formulaire » qui ne réunit que les éléments que vous modifiez souvent à l'usage.

1. Dans l'éditeur, faites un clic droit sur un élément (champ) et choisissez **{{ui:workflows.node.addToForm}}**.
2. Cet élément s'affiche dans l'onglet **{{ui:workflows.panel.workflow}}** du panneau de gauche.
3. Avec **{{ui:workflows.form.editForm}}**, vous pouvez réorganiser les éléments ou les retirer.

C'est pratique pour exécuter le workflow plusieurs fois en ne changeant que le prompt ou la taille. Les éléments déjà reliés affichent « {{ui:workflows.form.connected}} ».

Dans l'onglet **{{ui:workflows.panel.details}}**, vous pouvez renseigner le nom, l'auteur, les tags, la description, etc. Dans l'onglet **{{ui:workflows.panel.data}}**, vous pouvez voir et copier le contenu du workflow (JSON).

### Bibliothèque de workflows

![Bibliothèque de workflows](shot:workflows-library)

Cliquez sur **{{ui:workflows.library.button}}** pour ouvrir la liste.

- **{{ui:workflows.library.recent}}** : ceux ouverts récemment.
- **{{ui:workflows.library.yours}}** : ceux que vous avez enregistrés.
- **{{ui:workflows.library.defaults}}** : les exemples fournis d'origine. Pour modifier un exemple, copiez-le d'abord pour vous avec **{{ui:workflows.library.copyToMine}}**.

Vous pouvez rechercher, filtrer par tag et changer l'ordre de tri. Ouvrez avec **{{ui:workflows.library.open}}** et supprimez avec le bouton de corbeille. **{{ui:workflows.library.new}}** et **{{ui:workflows.library.upload}}** s'y trouvent aussi.

### Exporter et importer

- **{{ui:workflows.toolbar.download}}** exporte le workflow sous forme de fichier JSON.
- **{{ui:workflows.toolbar.loadFromFile}}** (ou **{{ui:workflows.library.upload}}**) permet d'importer un fichier exporté ou créé par quelqu'un d'autre.
- Si le fichier importé utilise des nœuds d'une extension non encore installée, une boîte de dialogue « {{ui:workflows.import.title}} » s'affiche. Une fois l'extension installée et ComfyUI redémarré, ce workflow s'ouvre automatiquement.
- Vous pouvez aussi récupérer le workflow à partir d'une image créée avec un workflow. Faites un clic droit sur l'image dans la galerie et choisissez **{{ui:gallery.menu.loadWorkflow}}** (si l'image est ouverte dans la visionneuse, la touche `W` fonctionne aussi). Même pour une image générée de façon ordinaire, le même enchaînement peut être reconstitué à partir de ses réglages. Choisissez **{{ui:gallery.menu.sendToWorkflow}}** pour utiliser cette image comme image d'entrée du workflow.

> Un workflow créé par quelqu'un d'autre est un assemblage de programmes qui s'exécutent sur votre ordinateur. N'importez pas un fichier dont vous ne connaissez pas l'origine.

## Modèles prédéfinis

L'onglet **{{ui:workflows.panel.templates}}** présente des modèles pour les combinaisons les plus courantes.

- **{{ui:workflows.templates.open}}** l'ouvre comme nouveau workflow.
- **{{ui:workflows.templates.add}}** l'ajoute à droite de l'éditeur actuel.
- Le modèle et l'image se choisissent après l'ouverture.

Les modèles prédéfinis qui nécessitent des extensions affichent une rubrique « Requis : … ». Cliquez sur **{{ui:workflows.templates.installPacks}}** pour les installer, puis redémarrez ComfyUI avec le bouton **{{ui:workflows.templates.restartFirst}}** : le modèle peut alors être ouvert.

Les modèles prédéfinis fournis sont les suivants.

| Modèle | Effet | Extension nécessaire |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | La forme de base : crée une image à partir d'un modèle et d'un prompt, puis l'enregistre. | Aucune |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Agrandit à 2048 une image créée en 1024, puis l'enregistre. | Aucune |
| **{{ui:workflows.templates.loraStack.title}}** | Relie des LoRA les uns après les autres au modèle pour ajouter un style et des détails. | Aucune |
| **{{ui:workflows.templates.image2image.title}}** | Redessine une image existante avec un autre prompt. | Aucune |
| **{{ui:workflows.templates.upscale.title}}** | Agrandit une image en haute définition avec un modèle d'agrandissement. | Aucune |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrait les contours d'une image et dessine du neuf en conservant cette forme. | Aucune |
| **{{ui:workflows.templates.imageToVideo.title}}** | Anime une image pour en faire une courte vidéo. | Aucune (un modèle vidéo est nécessaire) |
| **{{ui:workflows.templates.filmGrain.title}}** | Ajoute un grain photographique à l'image créée. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Change l'expression, le regard et l'orientation du cou d'une photo de visage. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Agrandit à 2048, puis redessine tuile par tuile pour ajouter des détails. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Transfère le style d'une image de référence à l'image du prompt. | ComfyUI_IPAdapter_plus (et son modèle) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Repère le visage de l'image créée et le redessine à plus haute résolution. | Impact Pack et Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Ne garde que la personne ou l'objet et rend l'arrière-plan transparent. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Ne garde que la personne ou l'objet et rend l'arrière-plan tout blanc. Convient comme préparation pour éviter que la couleur de fond d'une image de référence ne passe dans l'image. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrait la pose du personnage d'une image de référence et dessine une nouvelle image dans la même posture. | comfyui_controlnet_aux (et un modèle ControlNet pour OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Décrit en texte le contenu d'une image de référence, en fait un prompt, puis dessine du neuf. | Extension Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Met un personnage sur fond blanc pour en faire une image de référence, harmonise cheveux, yeux et vêtements, puis dessine une nouvelle scène. Le CFG est réglé sur une valeur plutôt basse, adaptée à l'image de référence. | ComfyUI-RMBG et ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Dessine en prenant l'apparence du personnage dans l'image de référence et la posture dans un bonhomme en bâtons (OpenPose). | Les deux ci-dessus, plus comfyui_controlnet_aux et un modèle ControlNet pour OpenPose |

Les modèles prédéfinis qui utilisent des personnages s'adressent à celles et ceux qui veulent affiner dans un workflow la fonction [Enregistrer et utiliser un personnage](04-improve.md#enregistrer-et-utiliser-un-personnage). En général, il suffit d'utiliser le personnage enregistré dans l'onglet Générer. La posture du bonhomme en bâtons peut être créée avec « {{ui:pose.title}} » du chapitre [Toile](05-canvas.md).

## Extensions (packs de nœuds)

L'onglet **{{ui:workflows.panel.packs}}** permet d'ajouter des extensions à ComfyUI ou de les retirer. Une extension est un module complémentaire qui augmente le nombre de nœuds. Les nœuds installés apparaissent dans **{{ui:workflows.categories.extension}}** de la liste d'ajout de nœuds.

Au départ, de grandes tuiles « {{ui:workflows.packs.whatToDo}} » s'affichent. Si vous choisissez ce que vous voulez faire (réparer un visage, supprimer l'arrière-plan, agrandir en haute définition, etc.), les extensions correspondantes apparaissent avec leur description.

1. Cliquez sur **{{ui:workflows.packs.install}}** pour l'extension voulue.
2. Une fois l'installation terminée, le message « {{ui:workflows.packs.restartNeeded}} » s'affiche. Cliquez sur **{{ui:workflows.packs.restart}}**.
3. Après le redémarrage, les nœuds et les modèles prédéfinis de cette extension sont utilisables.

Certaines extensions comportent une mise en garde, par exemple « Git est nécessaire », « l'installation demande du temps et de l'espace » ou « n'est plus mise à jour ». Lisez-la avant d'installer.

Pour ce qui ne figure pas au catalogue, saisissez une adresse GitHub (de la forme https://github.com/utilisateur/nom) dans **{{ui:workflows.packs.byAddress}}** pour l'installer. Les autres extensions présentes apparaissent dans **{{ui:workflows.packs.others}}**. Les extensions inutiles se retirent avec **{{ui:workflows.packs.remove}}** (cliquez une seconde fois pour confirmer).

Vous pouvez consulter les extensions installées à tout moment, même hors de l'écran des workflows. Cliquez sur **{{ui:app.nav.extensions}}** (icône de puzzle) dans la barre latérale gauche : **{{ui:workflows.packs.mgr.title}}** s'ouvre. Les extensions publiées s'affichent sous forme de cartes ; la liste de gauche permet de filtrer par **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** et par objectif, et le champ du haut permet de chercher par nom, auteur ou description. **{{ui:workflows.packs.mgr.sort.label}}** commence par **{{ui:workflows.packs.mgr.sort.downloads}}**, du plus élevé au plus faible. Les cartes affichent l'auteur, la version, la date de mise à jour et le nombre de téléchargements, et celles qui sont installées portent la mention **{{ui:workflows.packs.installed}}**. Une extension non installée s'installe avec **{{ui:workflows.packs.install}}** sur sa carte. En cliquant sur une carte, les détails s'ouvrent à droite ; vous pouvez y vérifier la **{{ui:workflows.packs.mgr.license}}** et la source de distribution, et aussi utiliser **{{ui:workflows.packs.remove}}**. Pour une extension absente de la liste, saisissez son adresse GitHub dans **{{ui:workflows.packs.mgr.addTitle}}** en haut pour l'installer. Après une installation ou un retrait, cliquez sur **{{ui:workflows.packs.restart}}**, affiché sur le même écran, pour appliquer le changement. Le détail de chaque carte comporte un bouton **{{ui:agent.ask.button}}**, et **{{ui:agent.ask.resultsButton}}** apparaît aussi quand vous saisissez un mot dans le champ de recherche. En cliquant dessus, l'assistant IA explique ce que fait l'extension et comment l'utiliser (voir [L'assistant IA et les paramètres](09-assistant-settings.md)).

Dans les détails, **{{ui:workflows.packs.version.label}}** indique la version actuellement installée. **{{ui:workflows.packs.version.change}}** n'apparaît que lorsque le dépôt de l'extension publie des versions ; en cliquant dessus, les versions disponibles s'affichent, et **{{ui:workflows.packs.version.apply}}** remplace la version actuelle par celle choisie. La version actuellement installée porte la mention **{{ui:workflows.packs.installed}}**. Ce bouton n'apparaît pas pour les extensions qui ne publient pas de versions. Pour appliquer le changement, cliquez sur **{{ui:workflows.packs.restart}}** sur le même écran. Les versions dont on sait qu'elles ne sont pas prises en charge par d'autres extensions ou par ComfyUI portent la mention **{{ui:workflows.packs.version.deprecated}}**, avec l'indication de ce qui n'est pas pris en charge. La version d'une extension installée par vos soins ne peut pas être changée ici.

La version de ComfyUI peut aussi être changée depuis le même écran. Cliquez sur la carte **{{ui:workflows.packs.version.comfyTitle}}**, en tête de la liste, puis sur **{{ui:workflows.packs.version.change}}** à droite pour afficher les versions disponibles. Après avoir cliqué sur **{{ui:workflows.packs.version.apply}}**, cliquez de nouveau sur **{{ui:workflows.packs.version.confirm}}** pour lancer le changement. Toutes les extensions installées sont réinstallées, ce qui prend quelques minutes, et aucune image ne peut être créée avant la fin. Si la nouvelle version ne démarre pas, l'ancienne version est rétablie.

> Une extension est un programme qui s'exécute sur votre ordinateur. N'installez pas une extension dont vous ne connaissez pas l'origine.

> Si vous êtes connecté à un ComfyUI non géré par l'application, l'installation n'est pas possible depuis cet écran. Installez l'extension du côté de ce ComfyUI.

Les fonctions de [Retoucher et réutiliser les images](04-improve.md) qui font appel à une extension, comme « {{ui:cutout.menu}} » ou « {{ui:facefix.menu}} », vous guident de la même façon vers l'installation lorsque c'est nécessaire.
