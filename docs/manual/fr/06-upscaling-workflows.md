# Mise à l'échelle et workflows

Ce chapitre présente **{{ui:app.tabs.upscaling}}**, qui agrandit les images, et l'onglet **{{ui:app.tabs.workflows}}**, où l'on enchaîne soi-même des traitements.

## Mise à l'échelle

![L'écran de mise à l'échelle. Au centre, la zone de dépôt de l'image et les cartes des étapes](shot:upscaling)

**{{ui:app.tabs.upscaling}}** s'ouvre avec l'icône en forme de cadre de la barre latérale gauche (la touche numérique 3 l'ouvre aussi). Il agrandit une image tout en ajoutant des détails fins. Il ne se contente pas d'étirer l'image : il l'agrandit d'abord avec un modèle d'agrandissement, puis redessine les détails avec le prompt et un ControlNet de tuile. Une grande image est découpée en zones d'une taille proche de celle de l'image d'origine, chaque zone est redessinée, et les zones sont raccordées. Comme le dessin se fait à la taille de prédilection du modèle, l'image se déforme moins, et le temps nécessaire est à peu près proportionnel au nombre de zones. Chaque zone est dessinée avec l'ensemble du prompt ; si le prompt décrit un personnage, de petites silhouettes ou de petits visages peuvent donc être ajoutés dans les zones de ciel ou d'arrière-plan. Dans ce cas, abaissez **{{ui:params.upscale.creativity}}**, ou réduisez le prompt à des mots de qualité d'image et de texture.

### Ce qu'il faut

Deux modèles sont utilisés. S'ils ne sont pas installés, un avertissement apparaît dans le panneau de gauche. Le bouton « {{ui:params.upscale.openModels}} » mène à l'écran des modèles. Pour l'installation, voir le chapitre [Modèles](08-models.md).

- {{ui:params.upscale.model}} (un modèle pour agrandir les images, comme Real-ESRGAN)
- {{ui:params.upscale.tileControlnet}}, adapté au modèle principal choisi (s'il y en a un adapté, il est choisi automatiquement. Pour les familles sans modèle adapté, comme Anima et Qwen-Image, l'image est redessinée sans ControlNet de tuile. Dans ce cas **{{ui:params.upscale.structure}}** n'agit pas ; pour conserver les formes, abaissez **{{ui:params.upscale.creativity}}**)

Quand aucun modèle d'agrandissement n'est installé, des candidats sont listés dans le panneau de gauche ; choisissez-en un parmi ceux marqués **{{ui:media.choice.recommended}}** et installez-le avec **{{ui:models.install.install}}**.

### Marche à suivre

1. Faites glisser l'image à agrandir depuis la galerie vers la carte du centre ou vers le cadre **{{ui:params.upscale.title}}** du panneau de gauche. Vous pouvez aussi faire un clic droit sur une image de la galerie (dans la visionneuse, la barre d'outils) et choisir **{{ui:gallery.menu.upscale}}**, ou ouvrir l'image dans la visionneuse et appuyer sur `Shift+U` : l'onglet change et l'image y est placée.
2. Choisissez **{{ui:params.upscale.model}}**.
3. Choisissez **{{ui:params.upscale.scale}}** parmi 2x, 4x et 8x. La taille obtenue s'affiche, par exemple « Sortie : 2048×2048 ».
4. Ajustez le résultat avec les deux curseurs suivants.
   - **{{ui:params.upscale.creativity}}** : Plus il est haut, plus l'image s'éloigne de l'original et reçoit de nouveaux détails.
   - **{{ui:params.upscale.structure}}** : Plus il est haut, plus les formes et la disposition de l'image d'origine sont conservées.
5. Vérifiez **{{ui:params.upscale.tileControlnet}}** (il est déjà choisi s'il y en a un adapté). Au besoin, choisissez aussi **{{ui:params.upscale.postProcessing}}** (l'image dessinée est finie avec ce modèle, puis ramenée à la taille de sortie).
6. Appuyez sur **{{ui:params.invoke.invoke}}**.

L'image obtenue entre dans la galerie.

- La taille de sortie est limitée à 8192 pixels par côté. Au-delà, un avertissement s'affiche ; abaissez le facteur d'agrandissement.
- Le prompt influence les détails ajoutés. Si vous y saisissez le prompt de l'image d'origine, la direction de l'image s'accorde plus facilement.
- Si l'image agrandie diffère trop de l'original, abaissez **{{ui:params.upscale.creativity}}** et augmentez **{{ui:params.upscale.structure}}**.

> Pour agrandir plusieurs images d'un coup, choisissez-les dans la galerie et utilisez **{{ui:gallery.menu.batch}}** dans le clic droit ([Retoucher et réutiliser les images](04-improve.md)). Dans ce cas, l'agrandissement se fait uniquement avec le modèle d'agrandissement.

## Workflows

![L'onglet Workflows. À droite, l'écran où l'on dessine l'enchaînement des traitements ; à gauche, le formulaire](shot:workflows)

Un workflow est une fonction qui permet de composer une procédure de traitements, par exemple « charger le modèle → saisir le prompt → créer l'image → l'enregistrer », en reliant des éléments (nœuds). Il permet de construire des procédures fines hors de portée de l'onglet Générer, ou un enchaînement qui combine plusieurs traitements.

Au début, nous vous conseillons d'ouvrir et d'utiliser un modèle prêt à l'emploi depuis **{{ui:workflows.panel.templates}}** (rubrique suivante).

L'écran se compose de deux parties.

- Au centre : l'**{{ui:app.views.editor}}**. On y dispose des nœuds et on les relie par des lignes.
- Panneau de gauche : six onglets, **{{ui:workflows.panel.workflow}}** (le formulaire), **{{ui:workflows.panel.nodes}}**, **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** et **{{ui:workflows.panel.data}}**.

Pour exécuter un workflow, appuyez sur le bouton **{{ui:params.invoke.invoke}}** en haut du panneau de gauche. S'il y a un problème, comme l'absence de nœud de sortie (« {{ui:workflows.nodes.save_image.title}} », etc.) ou l'absence de modèle choisi, la raison pour laquelle la génération est impossible s'affiche.

Tous les nœuds reliés servent à l'exécution. **{{ui:workflows.nodes.controlnet.title}}**, **{{ui:workflows.nodes.ip_adapter.title}}**, **{{ui:workflows.nodes.img_resize.title}}**, **{{ui:workflows.nodes.canny_edge_detection.title}}**, etc. agissent eux aussi comme vous les avez reliés. **{{ui:workflows.nodes.ip_adapter.title}}** nécessite une extension et un modèle (encodeur d'image). Ne peuvent pas encore être exécutés : **{{ui:workflows.nodes.collect.title}}**, **{{ui:workflows.nodes.iterate.title}}**, **{{ui:workflows.nodes.range.title}}**, le flou de boîte, ainsi que les nœuds de calcul reliés à **{{ui:workflows.nodes.rand_int.title}}**. La raison pour laquelle ils sont inutilisables apparaît dans l'affichage du problème ci-dessus.

### Ajouter des nœuds et les relier

L'onglet **{{ui:workflows.panel.nodes}}** du panneau de gauche liste les nœuds que vous pouvez ajouter, classés comme dans ComfyUI. Sous les titres **{{ui:workflows.nodeLibrary.section.core}}** et **{{ui:workflows.picker.extensions}}**, des dossiers par type (modèles, images, vidéos, etc.) sont alignés dans le même ordre que dans ComfyUI, et les nœuds standard propres à novira sont rangés dans les dossiers du même type. En les ouvrant, on voit les dossiers et les nœuds qu'ils contiennent. Sous **{{ui:workflows.picker.extensions}}**, les catégories d'une extension se trouvent dans un dossier portant son nom. Si vous cherchez, les nœuds correspondants s'alignent avec l'indication du dossier où ils se trouvent. Un double-clic sur un nœud (ou le choisir puis `Enter`) le place au centre de la toile ; le faire glisser sur la toile le place à cet endroit. Vous pouvez en ajouter à la suite sans ouvrir une liste qui couvre l'écran. Vous pouvez aussi en ajouter de la façon suivante.

1. Appuyez sur `Shift+A` ou `Espace` au clavier pour ouvrir la liste de choix des nœuds.
2. Choisissez un nœud dans la liste. Vous pouvez filtrer en saisissant des mots dans le champ de recherche du haut. Les catégories à gauche permettent de filtrer par type de nœuds standard, par type de nœuds de ComfyUI lui-même, ou par extension installée.
3. Faites glisser du cercle à droite d'un nœud (sortie) jusqu'au cercle à gauche d'un autre nœud (entrée) pour les relier. On ne peut relier que des éléments du même type.

![La liste pour ajouter un nœud](shot:workflows-add-node)

Quelques fonctions pratiques pour relier.

- Si vous relâchez une ligne dans un endroit vide, seuls les nœuds qui peuvent s'y relier apparaissent dans la liste. Quand vous en choisissez un, il est ajouté et relié directement.
- Si vous relâchez une ligne sur un nœud, elle se relie automatiquement à l'entrée qui convient.
- Un nœud sélectionné se supprime avec `Delete`. `Ctrl+C` et `Ctrl+V` dupliquent les nœuds. `Ctrl+Z` annule et `Ctrl+Shift+Z` rétablit.
- Si vous faites glisser une image de la galerie dans l'éditeur, un nœud « {{ui:workflows.nodes.image.title}} » contenant cette image est ajouté.
- La flèche à gauche du nom d'un nœud le replie. Un double-clic sur le nom permet de le changer.

Les valeurs de réglage d'un nœud se saisissent directement dans le nœud. La valeur d'une entrée reliée vient de l'élément auquel elle est reliée.

### Créer de la musique ou des vidéos avec un workflow

Dans l'onglet **{{ui:workflows.panel.nodes}}** du panneau de gauche, et à gauche de la liste d'ajout de nœuds, se trouve la catégorie **{{ui:workflows.picker.core}}**. Les nœuds que ComfyUI possède dès le départ y sont classés par type (audio, vidéo, échantillonnage, etc.), et les nœuds qui créent de la musique ou des vidéos s'y trouvent aussi. Vous pouvez les combiner librement avec les nœuds standard.

- Si vous ouvrez les modèles **{{ui:workflows.templates.musicAceStep.title}}**, **{{ui:workflows.templates.videoWan22.title}}** et **{{ui:workflows.templates.videoWan22Image.title}}**, vous pouvez les exécuter aussitôt. Les modèles utilisés sont ceux téléchargés dans l'onglet Musique et l'onglet Vidéo.
- Le format se choisit avec le nœud qui enregistre le résultat (Save Audio ou Save Video). Les réglages nécessaires au format choisi, comme la qualité du MP3, apparaissent en dessous.
- La musique et les vidéos obtenues entrent dans la galerie. Les formats que la galerie sait gérer sont MP3, WAV et FLAC pour la musique, et MP4 pour la vidéo. Si vous choisissez Opus, WebM, etc., un message indique que ce format ne peut pas être enregistré, et le traitement s'arrête.
- La musique et les vidéos de la galerie se choisissent et se relient avec les nœuds Load Audio et Load Video.
- Le nœud **{{ui:workflows.nodes.voice_speak.title}}** (catégorie **{{ui:workflows.categories.audio}}**) crée une voix qui lit un texte à haute voix. C'est le même moteur que dans l'onglet Voix (Qwen3-TTS), qui doit avoir été installé au préalable. La voix obtenue se relie à un nœud qui reçoit de l'audio. Reliée à Save Audio, elle s'enregistre en MP3, etc. ; reliée à l'audio de Create Video, elle ajoute une voix à la vidéo (si l'audio est plus long que la vidéo, il est coupé à la longueur de la vidéo). Les modèles **{{ui:workflows.templates.voiceRead.title}}** et **{{ui:workflows.templates.videoNarration.title}}** sont utilisables tels quels.
- Un seed auquel on n'a pas relié « Entier aléatoire » donne toujours le même résultat. Dans les modèles, il est déjà relié dès le départ.
- Les noms des nœuds, des éléments et des dossiers de ComfyUI lui-même s'affichent avec les mêmes mots que l'écran de ComfyUI. Les mots que ComfyUI ne traduit pas (nœuds d'extensions, etc.) restent en anglais. Le nombre de nœuds utilisables varie selon la version de ComfyUI.

### Disposition des boutons

Ce sont les boutons en haut à gauche de l'éditeur.

| Bouton | Ce qu'il fait |
|---|---|
| **{{ui:workflows.toolbar.new}}** | Démarre un workflow vide. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Enregistre. À la première sauvegarde, un nom est demandé. |
| **{{ui:workflows.toolbar.optimize}}** | Fusionne les nœuds en double, supprime les nœuds non reliés à une sortie et les connexions inutiles, et réorganise de gauche à droite. On peut aussi annuler. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

L'engrenage **{{ui:workflows.settings.title}}**, en haut à droite, permet de basculer l'affichage de la mini-carte, l'alignement sur la grille, etc.

**{{ui:workflows.settings.autoTidy}}** est désactivé au départ. Activé, quand vous ajoutez ou supprimez des nœuds ou des lignes, les nœuds sont réorganisés automatiquement de gauche à droite peu après, et les nœuds en double qui ont le même rôle sont fusionnés. Une notification s'affiche en cas de fusion, et `Ctrl+Z` permet de revenir en arrière. Les nœuds non reliés ne sont pas supprimés automatiquement. Si vous voulez les disposer vous-même, laissez-le désactivé.

Quand il y a des modifications non enregistrées, un point apparaît à côté du nom. Quand vous passez à un autre workflow, on vous demande s'il faut les abandonner.

### Utiliser avec le formulaire

Quand il y a beaucoup de nœuds, l'éditeur devient difficile à lire. Vous pouvez donc créer un « formulaire » qui ne réunit que les éléments que vous modifiez souvent à l'usage.

1. Dans l'éditeur, faites un clic droit sur un élément (champ) et choisissez **{{ui:workflows.node.addToForm}}**.
2. L'élément s'aligne dans l'onglet **{{ui:workflows.panel.workflow}}** du panneau de gauche.
3. En appuyant sur **{{ui:workflows.form.editForm}}**, vous pouvez réordonner et retirer des éléments.

C'est pratique pour exécuter plusieurs fois en ne changeant que le prompt ou la taille. Les éléments reliés s'affichent avec « {{ui:workflows.form.connected}} ».

Dans l'onglet **{{ui:workflows.panel.details}}**, vous pouvez écrire le nom, l'auteur, les tags, la description, etc. Dans l'onglet **{{ui:workflows.panel.data}}**, vous pouvez voir et copier le contenu du workflow (JSON).

### Bibliothèque de workflows

![La bibliothèque de workflows](shot:workflows-library)

En appuyant sur la carte **{{ui:workflows.library.button}}** tout en haut du panneau de gauche, au-dessus du bouton de génération (elle affiche le nom du workflow actuellement ouvert), la liste s'ouvre.

- **{{ui:workflows.library.recent}}** : Ce que vous avez ouvert récemment.
- **{{ui:workflows.library.yours}}** : Ce que vous avez enregistré vous-même.
- **{{ui:workflows.library.defaults}}** : Les exemples fournis dès le départ. Un exemple se copie pour vous avec **{{ui:workflows.library.copyToMine}}**, puis se modifie.

Vous pouvez chercher, filtrer par tag et changer l'ordre. **{{ui:workflows.library.open}}** ouvre, et le bouton en forme de corbeille supprime. **{{ui:workflows.library.new}}** et **{{ui:workflows.library.upload}}** s'y trouvent aussi.

### Exportation et importation

- **{{ui:workflows.toolbar.download}}** exporte le workflow sous forme de fichier JSON.
- **{{ui:workflows.toolbar.loadFromFile}}** (ou **{{ui:workflows.library.upload}}**) charge un fichier exporté ou un fichier créé par quelqu'un d'autre.
- Si le fichier chargé utilise des nœuds d'extensions qui ne sont pas encore installées, la boîte de dialogue « {{ui:workflows.import.title}} » s'affiche. Après l'installation et le redémarrage de ComfyUI, ce workflow s'ouvre automatiquement.
- Vous pouvez aussi extraire le workflow d'une image créée avec un workflow. Faites un clic droit sur une image de la galerie et choisissez **{{ui:gallery.menu.loadWorkflow}}** (quand l'image est ouverte dans la visionneuse, la touche `W` fonctionne aussi). Même pour une image créée de façon ordinaire, le même enchaînement peut être reconstitué à partir des réglages. Choisissez **{{ui:gallery.menu.sendToWorkflow}}** pour utiliser cette image comme image d'entrée du workflow.

> Un workflow créé par quelqu'un d'autre est un assemblage de programmes qui s'exécutent sur votre ordinateur. Ne chargez pas un fichier dont vous ne connaissez pas l'origine.

## Modèles prédéfinis

L'onglet **{{ui:workflows.panel.templates}}** présente des modèles de combinaisons très utilisées.

- **{{ui:workflows.templates.open}}** l'ouvre comme nouveau workflow.
- **{{ui:workflows.templates.add}}** l'ajoute à droite de l'éditeur actuel.
- Le modèle (de génération) et les images se choisissent après l'ouverture.

Pour un modèle qui nécessite une extension, une zone « Extensions nécessaires » s'affiche. Installez-les avec **{{ui:workflows.templates.installPacks}}**, puis redémarrez ComfyUI avec le bouton **{{ui:workflows.templates.restartFirst}}** : le modèle devient ouvrable. Un modèle composé de nœuds de ComfyUI lui-même devient ouvrable quand ComfyUI est en marche.

Voici les modèles proposés.

| Modèle prédéfini | Ce qu'il fait | Extension nécessaire |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | La forme de base : créer et enregistrer une image à partir d'un modèle et d'un prompt. | Aucune |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Agrandit à 2048 une image créée en 1024 et l'enregistre. | Aucune |
| **{{ui:workflows.templates.loraStack.title}}** | Relie des LoRA les unes après les autres au modèle pour ajouter style et détails. | Aucune |
| **{{ui:workflows.templates.image2image.title}}** | Redessine avec un autre prompt à partir d'une image que vous avez. | Aucune |
| **{{ui:workflows.templates.upscale.title}}** | Agrandit une image en haute définition avec un modèle d'agrandissement. | Aucune |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrait les contours d'une image et dessine de nouveau en conservant cette forme. | Aucune |
| **{{ui:workflows.templates.imageToVideo.title}}** | Donne du mouvement à une image pour en faire une courte vidéo. | Aucune (un modèle vidéo est nécessaire) |
| **{{ui:workflows.templates.videoWan22.title}}** | Crée une courte vidéo à partir d'un texte avec les nœuds de ComfyUI lui-même. La durée, la taille et l'échantillonneur se modifient aussi librement. | Aucune (un modèle vidéo est nécessaire) |
| **{{ui:workflows.templates.videoWan22Image.title}}** | Avec la même construction, crée une vidéo à partir de l'image choisie. | Aucune (un modèle vidéo est nécessaire) |
| **{{ui:workflows.templates.musicAceStep.title}}** | Crée un morceau à partir de tags de style et de paroles. | Aucune (un modèle de musique est nécessaire) |
| **{{ui:workflows.templates.voiceRead.title}}** | Crée une voix qui lit un texte et l'enregistre en MP3. | Aucune (le moteur de voix et un modèle sont nécessaires) |
| **{{ui:workflows.templates.videoNarration.title}}** | Choisissez une vidéo de la galerie, faites de la voix lue le son de cette vidéo et enregistrez-la comme nouvelle vidéo. | Aucune (le moteur de voix et un modèle sont nécessaires) |
| **{{ui:workflows.templates.filmGrain.title}}** | Ajoute à une image créée un grain de type photographique. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Change l'expression, le regard et l'orientation du cou d'une photo de visage. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Agrandit à 2048, puis redessine tuile par tuile pour ajouter des détails. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Transfère le style graphique d'une image de référence à l'image du prompt. | ComfyUI_IPAdapter_plus (et ses modèles) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Trouve les visages d'une image créée et les redessine en haute résolution. | Impact Pack et Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Ne garde que la personne ou l'objet et rend l'arrière-plan transparent. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Ne garde que la personne ou l'objet et rend l'arrière-plan tout blanc. Convient comme préparation pour éviter que la couleur de l'arrière-plan d'une image de référence passe dans l'image. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrait la pose de la personne d'une image de référence et dessine une nouvelle image avec la même posture. | comfyui_controlnet_aux (et un modèle ControlNet pour OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Décrit en texte le contenu d'une image de référence, en fait un prompt et dessine à neuf. | L'extension Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Met le dessin d'un personnage sur fond blanc pour en faire une image de référence, harmonise les cheveux, les yeux et les vêtements, et dessine une nouvelle scène. Le CFG est réglé sur une valeur plutôt basse, adaptée aux images de référence. | ComfyUI-RMBG et ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Dessine en prenant l'apparence du personnage dans l'image de référence et la posture dans un bonhomme en fil de fer (OpenPose). | Les deux ci-dessus, plus comfyui_controlnet_aux et un modèle ControlNet pour OpenPose |

Les modèles qui utilisent des personnages servent quand vous voulez ajuster finement avec un workflow la fonction décrite dans [Enregistrer et utiliser un personnage](04-improve.md#enregistrer-et-utiliser-un-personnage). Normalement, il suffit d'utiliser un personnage enregistré dans l'onglet Générer. La posture du bonhomme en fil de fer peut être créée avec « {{ui:pose.title}} » dans la [toile](05-canvas.md).

## Extensions (nœuds personnalisés)

L'onglet **{{ui:workflows.panel.packs}}** permet d'ajouter des extensions à ComfyUI ou de les retirer. Une extension est un complément qui ajoute des nœuds. Les nœuds installés apparaissent sous **{{ui:workflows.categories.extension}}** dans la liste d'ajout de nœuds.

Au début, de grandes tuiles « {{ui:workflows.packs.whatToDo}} » sont alignées. Choisissez ce que vous voulez faire (réparer un visage, supprimer l'arrière-plan, agrandir en haute définition, etc.) : les extensions correspondantes s'affichent avec leur description.

1. Appuyez sur **{{ui:workflows.packs.install}}** pour l'extension que vous voulez utiliser.
2. Une fois l'installation terminée, « {{ui:workflows.packs.restartNeeded}} » s'affiche. Appuyez sur **{{ui:workflows.packs.restart}}**.
3. Après le redémarrage, les nœuds de cette extension et ses modèles sont utilisables.

Certaines extensions s'accompagnent d'une mise en garde : « Git est nécessaire », « l'installation demande du temps et de la place », « n'est plus mise à jour », etc. Lisez-la avant d'installer.

Pour ce qui n'est pas dans le catalogue, vous pouvez installer avec **{{ui:workflows.packs.byAddress}}** en saisissant une adresse GitHub (de la forme https://github.com/nom-d-utilisateur/nom). Les autres extensions déjà présentes figurent sous **{{ui:workflows.packs.others}}**. Une extension inutile se retire avec **{{ui:workflows.packs.remove}}** (appuyez une seconde fois pour confirmer).

Les extensions installées peuvent se consulter à tout moment, même hors de l'écran des workflows. En appuyant sur **{{ui:app.nav.extensions}}** (l'icône de puzzle) dans la barre latérale gauche, vous ouvrez **{{ui:workflows.packs.mgr.title}}**. Les extensions publiées s'alignent sous forme de cartes, la liste de gauche permet de filtrer par **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** et par usage, et le champ du haut permet de chercher par nom, auteur ou description. **{{ui:workflows.packs.mgr.sort.label}}** est au départ **{{ui:workflows.packs.mgr.sort.downloads}}**, du plus grand nombre au plus petit. La carte indique l'auteur, la version, la date de mise à jour et le nombre de téléchargements, et celles qui sont installées portent la mention **{{ui:workflows.packs.installed}}**. Celles qui ne sont pas installées s'installent avec **{{ui:workflows.packs.install}}** sur la carte. Un clic sur une carte ouvre les détails à droite : vous pouvez y vérifier **{{ui:workflows.packs.mgr.license}}** et la source de distribution, et aussi **{{ui:workflows.packs.remove}}**. Une extension absente de la liste s'installe en saisissant une adresse GitHub dans **{{ui:workflows.packs.mgr.addTitle}}**, en haut. Après une installation ou un retrait, appuyez sur **{{ui:workflows.packs.restart}}**, affiché dans le même écran, pour que le changement soit pris en compte. Les détails de chaque carte comportent un bouton **{{ui:agent.ask.button}}** et, quand vous saisissez des mots dans le champ de recherche, **{{ui:agent.ask.resultsButton}}** apparaît aussi. En appuyant dessus, l'agent explique ce que fait cette extension et comment l'utiliser (voir [L'agent et les paramètres](09-assistant-settings.md)).

Dans les détails, **{{ui:workflows.packs.version.label}}** affiche la version actuellement installée. **{{ui:workflows.packs.version.change}}** n'apparaît que lorsque le dépôt de cette extension publie des versions ; en appuyant dessus, les versions possibles s'alignent, et **{{ui:workflows.packs.version.apply}}** remplace par cette version. La version actuellement installée porte la mention **{{ui:workflows.packs.installed}}**. Pour une extension qui ne publie pas de versions, ce bouton n'apparaît pas. Pour que le changement soit pris en compte, appuyez sur **{{ui:workflows.packs.restart}}** dans le même écran. Les versions que l'on sait incompatibles avec d'autres extensions ou avec ComfyUI portent la mention **{{ui:workflows.packs.version.deprecated}}**, avec l'indication de ce qui n'est pas compatible. Pour une extension que vous avez installée vous-même, vous ne pouvez pas changer la version d'ici.

La version de ComfyUI peut aussi se changer depuis le même écran. Appuyez sur la carte **{{ui:workflows.packs.version.comfyTitle}}** en tête de la liste, puis alignez les versions possibles avec **{{ui:workflows.packs.version.change}}**, à droite. Après avoir appuyé sur **{{ui:workflows.packs.version.apply}}**, un nouvel appui sur **{{ui:workflows.packs.version.confirm}}** lance le changement. Toutes les extensions installées sont réinstallées, ce qui prend quelques minutes, et aucune image ne peut être créée avant la fin. Si la nouvelle version ne démarre pas, l'ancienne version est rétablie.

> Une extension est un programme qui s'exécute sur votre ordinateur. N'installez pas ce dont vous ne connaissez pas l'origine.

> Quand vous êtes connecté à un ComfyUI que l'application ne gère pas, l'installation est impossible depuis cet écran. Installez du côté de ce ComfyUI.

Les fonctions qui utilisent des extensions, comme « {{ui:cutout.menu}} » et « {{ui:facefix.menu}} » de [Retoucher et réutiliser les images](04-improve.md), vous guident de la même façon vers l'installation quand elle devient nécessaire.
