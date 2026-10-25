# Vidéo, musique, voix, logo et texte

En plus des images, novira permet de créer des vidéos, de la musique, de la voix et des logos, et d'ajouter du texte et des bulles à une image.

Tout se fait depuis le panneau de gauche de l'onglet **{{ui:app.tabs.generate}}**. Pour l'utilisation des images, consultez d'abord [Générer](02-generate.md).

## Choisir ce que l'on crée

Tout en haut du panneau de gauche se trouve un sélecteur composé uniquement d'icônes. De gauche à droite : **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}** et **{{ui:app.tabs.comic}}**. **{{ui:app.tabs.comic}}** est l'écran pour créer des pages de BD ([Dessiner une BD](12-comic.md)).

Le nom s'affiche quand on survole une icône avec la souris. Quand on change, le panneau de gauche et l'affichage central passent à ceux du type choisi.

## Fonctionnement commun

Les écrans de vidéo, de musique, de voix et de logo ont la même forme.

- Tout en haut du panneau de gauche se trouvent les **{{ui:presets.label}}**, qui rappellent d'un coup un ensemble de réglages.
- En dessous se trouve le bouton qui lance la création. S'il manque quelque chose, le bouton est désactivé et la raison s'affiche juste en dessous.
- Quand la raison indique « Téléchargez d'abord le modèle (vidéo, musique, voix ou logo) », installez-le depuis la **carte du modèle** qui apparaît ensuite.
- Au lieu du bouton de lancement, `Ctrl+Enter` permet aussi de lancer la création.
- L'état de la création (file d'attente, en cours, raison d'un échec) s'affiche tout en haut de l'écran central. **{{ui:media.job.cancel}}** permet de l'arrêter.

> La création se fait un élément à la fois. Pendant la création d'une vidéo ou d'une musique, les autres générations, comme les images, attendent dans la file. Les éléments en attente sont aussi visibles dans l'onglet **{{ui:app.tabs.queue}}**.

### Télécharger d'abord les modèles nécessaires

La vidéo, la musique, la voix et le logo nécessitent chacun un modèle dédié. S'il n'est pas installé, une « carte du modèle » apparaît dans le panneau de gauche. Cliquez sur **{{ui:pack.install}}** et l'application l'importe automatiquement.

| Ce que l'on crée | Nom de la carte | Taille approximative |
|---|---|---|
| Vidéo | {{ui:pack.title.video}} | Environ 18 Go |
| Vidéo (version rapide) | {{ui:pack.title.turbo}} | Les fichiers communs avec la version standard ne sont pas téléchargés en double |
| Musique | {{ui:pack.title.music}} | Environ 10 Go |
| Voix | {{ui:pack.title.voice}} | Environ 9 Go |
| Logo | {{ui:pack.title.logo}} | Environ 12 Go |

Ces tailles sont indicatives. Pour la taille exacte, reportez-vous au chiffre affiché sur la carte.

Pour la vidéo, vous pouvez choisir entre deux modèles, standard et rapide. La carte affiche le nom et la mémoire du GPU de cet ordinateur, ainsi que l'adéquation de chaque modèle (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}**, **{{ui:media.choice.fit.short}}**). Celui qui convient à cet ordinateur porte la mention **{{ui:media.choice.recommended}}**. Si la mémoire du GPU ne peut pas être déterminée, l'adéquation s'affiche comme **{{ui:media.choice.fit.unknown}}**. Il s'agit d'une indication : même avec **{{ui:media.choice.fit.short}}**, cela peut fonctionner, simplement plus lentement.

Le téléchargement n'a lieu qu'une fois, au début. La progression s'affiche sur la carte et, quel que soit l'écran, dans le cadre « {{ui:media.downloads.title}} » en bas à gauche, avec le nom et l'avancement ; vous pouvez aussi utiliser **{{ui:common.cancel}}** en cours de route. En cas d'échec, la raison s'affiche sur la carte et le bouton devient **{{ui:pack.retry}}**.

Lorsque la taille du téléchargement est connue, le temps restant s'affiche aussi sous la forme « environ X min restantes » (il est estimé d'après la vitesse de téléchargement, il n'apparaît donc pas au début). Lorsque la taille est inconnue, ou pendant l'installation, le temps écoulé depuis le début s'affiche sous la forme « X min écoulées ». Pour le téléchargement d'une extension, **{{ui:media.downloads.manage}}** dans le cadre ouvre la liste des extensions installées.

Une fois l'installation terminée, la carte disparaît. Pour la voix, le moteur de lecture est installé en même temps, ce qui prend un peu plus de temps.

> Avant le téléchargement, la préparation du moteur de création d'images (ComfyUI) doit être terminée. Si rien n'avance, consultez [En cas de problème](10-troubleshooting.md).

## Créer une vidéo

![Écran de la vidéo. À gauche, les réglages (méthode de création, prompt, taille, etc.) ; au centre, la liste des vidéos créées](shot:media-video)

Une vidéo peut être créée à partir d'un texte, ou en animant une image.

### Marche à suivre

1. Choisissez **{{ui:media.tab.video}}** dans le panneau de gauche.
2. Si c'est la première fois, cliquez sur **{{ui:pack.install}}** sur la carte **{{ui:pack.title.video}}**.
3. Dans **{{ui:video.mode.label}}**, choisissez **{{ui:video.mode.text}}** ou **{{ui:video.mode.image}}**.
4. Dans **{{ui:video.prompt}}**, décrivez la vidéo souhaitée. Pour une création à partir d'une image, décrivez comment la faire bouger.
5. Cliquez sur **{{ui:params.invoke.invoke}}**.

Si vous choisissez **{{ui:video.mode.image}}**, un champ pour indiquer l'image à animer apparaît. Déposez une image, ou sélectionnez une image dans la galerie, puis cliquez sur **{{ui:video.pickFromGallery}}**.

Vous pouvez aussi faire un clic droit sur une image de la galerie et choisir **{{ui:gallery.menu.sendToVideo}}**.

### Réglages

| Élément | Contenu |
|---|---|
| {{ui:video.negative}} | Les éléments à éviter. Dès le départ, des mots qui évitent le flou, le texte, etc. sont déjà saisis |
| {{ui:video.model}} | **{{ui:video.model.standard}}** offre un rendu plus soigné. **{{ui:video.model.fast}}** demande moins de temps, mais les détails peuvent être grossiers |
| {{ui:video.size}} | La taille de la vidéo. Au départ 832×480. Les formats vertical et carré sont aussi disponibles |
| {{ui:video.fps}} | Nombre d'images par seconde (8 à 30) |
| {{ui:video.lengthLabel}} | De 1 à 10 secondes. Le nombre d'images est déterminé automatiquement à partir de la durée et de la fréquence d'images |
| {{ui:video.steps}}, {{ui:video.cfg}} | Réglages fins du rendu. Quand vous choisissez un modèle, les valeurs passent à celles qui lui conviennent |
| {{ui:video.randomSeed}} | Si vous le désactivez, vous pouvez fixer la seed et recréer le même mouvement |

Pour utiliser **{{ui:video.model.fast}}**, il faut télécharger séparément **{{ui:pack.title.turbo}}**. Ce modèle est sous licence non commerciale.

### Quand la mémoire du GPU est faible

**{{ui:video.light.title}}** comporte deux interrupteurs.

- **{{ui:video.light.fp8}}** : la mémoire utilisée par le modèle est presque divisée par deux. Les détails peuvent être légèrement plus grossiers.
- **{{ui:video.light.tiled}}** : évite le pic soudain de mémoire lors de la finition. La qualité ne change pas, mais c'est un peu plus lent.

Si cela ne suffit pas, vous pouvez aussi créer en plus petit, puis agrandir la vidéo obtenue avec **{{ui:video.finish}}**.

### Résultat

Une vidéo prend de quelques minutes à une dizaine de minutes. Une fois prête, elle apparaît dans la liste des vidéos au centre et peut être lue sur place. Elle entre aussi dans la galerie de droite, sous forme de miniature marquée ▶.

Sous chaque vidéo s'affichent le prompt, la taille, la durée et la seed. Le bouton de corbeille permet de la supprimer.

Cliquer sur **{{ui:video.finish}}** ouvre l'écran **{{ui:finish.title}}**.

- **{{ui:finish.smooth.title}}** : complète les images intermédiaires pour rendre le mouvement plus fluide.
- **{{ui:finish.enlarge.title}}** : agrandit la vidéo avec un modèle d'agrandissement. Cela demande beaucoup de temps et de mémoire.

La vidéo d'origine est conservée telle quelle, et la vidéo finalisée s'y ajoute. L'interpolation des images peut nécessiter une extension (suivez les indications à l'écran et cliquez sur **{{ui:finish.install}}**).

## Créer de la musique

![Écran de la musique. À gauche, les réglages : style, paroles, durée, tempo, etc.](shot:media-music)

Un morceau est créé à partir d'un texte (le style) et de paroles.

### Marche à suivre

1. Choisissez **{{ui:media.tab.music}}** dans le panneau de gauche.
2. Si c'est la première fois, cliquez sur **{{ui:pack.install}}** sur la carte **{{ui:pack.title.music}}**.
3. Dans **{{ui:music.tags}}**, écrivez le genre, l'ambiance et les instruments, séparés par des virgules. Par exemple : `upbeat J-pop, female vocal, piano, bright`.
4. Pour un morceau chanté, écrivez les **{{ui:music.lyrics}}**. Pour un morceau sans chant, cochez **{{ui:music.instrumental}}**.
5. Cliquez sur **{{ui:params.invoke.invoke}}**.

Le style est obligatoire. Si vous le laissez vide, la création est impossible.

Les paroles peuvent être découpées par des crochets, comme `[verse]` (couplet) ou `[chorus]` (refrain). Elles peuvent être écrites en anglais, en japonais, en chinois, etc. Choisissez la langue des paroles avec **{{ui:music.language}}**. En cas de doute, choisissez **{{ui:music.lang.unknown}}**.

### Réglages

| Élément | Contenu |
|---|---|
| {{ui:music.lengthLabel}} | De 10 à 240 secondes |
| {{ui:music.bpm}} | La vitesse du morceau (40 à 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | De `C major` à `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Réglages fins du rendu |

### Résultat

Les morceaux apparaissent dans la liste centrale en quelques dizaines de secondes à quelques minutes. Chacun a son lecteur et peut être écouté directement. La durée, le tempo, la tonalité et la seed s'affichent, et s'il y a des paroles, vous pouvez les vérifier en ouvrant **{{ui:audio.lyrics}}**.

Ils entrent aussi dans la galerie avec une miniature en forme de note de musique.

## Créer de la voix

![Écran de la voix. À gauche, le texte à lire, la langue et le choix de la voix](shot:media-voice)

Le texte saisi est lu à voix haute.

### Marche à suivre

1. Choisissez **{{ui:media.tab.voice}}** dans le panneau de gauche.
2. Si c'est la première fois, cliquez sur **{{ui:pack.install}}** sur la carte **{{ui:pack.title.voice}}**. Le moteur de lecture et le modèle sont installés uniquement dans le dossier de l'application.
3. Dans **{{ui:voice.text}}**, saisissez le texte à lire.
4. Choisissez **{{ui:voice.language}}**. Avec **{{ui:voice.lang.Auto}}**, la langue est déterminée d'après le texte.
5. Choisissez la voix (voir ci-dessous).
6. Cliquez sur **{{ui:params.invoke.invoke}}**.

### Choisir la voix

**{{ui:voice.mode.label}}** propose deux méthodes.

- **{{ui:voice.mode.preset}}** : choisissez parmi les voix fournies. Il y a par exemple une voix féminine japonaise, une voix chinoise, une voix masculine anglaise, une voix féminine coréenne, etc. ; la langue et le genre sont indiqués après le nom. Si vous écrivez dans **{{ui:voice.style}}** des indications comme « de façon joyeuse et dynamique » ou « lentement et calmement », vous pouvez aussi préciser la manière de parler.
- **{{ui:voice.mode.design}}** : décrivez en mots les caractéristiques de la voix dans **{{ui:voice.description}}**. Par exemple : « Voix d'homme calme et plutôt grave. Parle lentement et avec douceur. » La description est obligatoire.

Les langues de lecture sont le japonais, l'anglais, le chinois, le coréen, l'allemand, le français, le russe, le portugais, l'espagnol et l'italien.

### Résultat

La voix créée apparaît dans la liste centrale avec un lecteur. La voix utilisée (« {{ui:audio.voice.designed}} » si elle a été créée à partir d'une description) et la langue s'affichent aussi. Elle entre également dans la galerie.

La première génération prend un peu de temps, car le modèle doit être chargé. Si vous n'utilisez pas la fonction pendant un moment, le modèle quitte le GPU et la mémoire est rendue aux autres tâches.

## Créer un logo

![Écran du logo. À gauche, le texte du logo, le style, la forme et le nombre de propositions](shot:media-logo)

Des propositions de logo contenant du texte sont créées.

### Marche à suivre

1. Choisissez **{{ui:media.tab.logo}}** dans le panneau de gauche.
2. Si c'est la première fois, cliquez sur **{{ui:pack.install}}** sur la carte **{{ui:pack.title.logo}}**.
3. Dans **{{ui:logo.text}}**, saisissez le texte à mettre dans le logo (60 caractères au maximum).
4. Dans **{{ui:logo.style}}**, décrivez l'ambiance, les couleurs et la forme. Le japonais comme l'anglais conviennent. Par exemple : « minimaliste, bleu et blanc, géométrique ».
5. Dans **{{ui:logo.size}}**, choisissez la forme parmi **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** et **{{ui:logo.size.tall}}**.
6. Choisissez **{{ui:logo.countLabel}}** de 1 à 4, puis cliquez sur **{{ui:params.invoke.invoke}}**.

### Résultat et superposition de texte

Les logos créés apparaissent au centre sous forme de propositions. Dans la galerie, ils entrent dans **{{ui:gallery.view.assets}}** et non dans **{{ui:gallery.view.images}}**. Quand vous ouvrez l'écran de création de logo, la galerie de droite passe automatiquement à l'affichage des ressources.

Le texte en anglais est rendu avec précision, mais le japonais peut être déformé. Dans ce cas, cliquez sur **{{ui:logo.layText}}** pour la proposition qui vous plaît. L'affichage passe à **{{ui:media.tab.text}}** avec ce logo en arrière-plan, et vous pouvez y superposer le texte de votre choix.

## Texte (lettres et bulles)

![Écran du texte. À gauche, les boutons d'ajout de texte, l'arrière-plan, les calques et le style du texte ; au centre, l'image en cours de modification](shot:media-text)

**{{ui:media.tab.text}}** est un écran d'édition où l'on ajoute du texte et des bulles à une image, puis où l'on l'enregistre comme image. Aucun téléchargement de modèle n'est nécessaire. Comme il n'utilise pas non plus le traitement de création d'images, il est utilisable immédiatement.

### Choisir l'arrière-plan

Avec **{{ui:text.bg.title}}**, vous choisissez sur quoi le texte sera placé.

- **{{ui:text.bg.image}}** : une image sert d'arrière-plan. Affichez une image dans la galerie, puis cliquez sur **{{ui:text.bg.useViewer}}**, ou déposez une image sur cet écran. Elle est enregistrée à la même taille que l'image.
- **{{ui:text.bg.color}}** : un arrière-plan uni. Choisissez la taille dans la liste (1024×1024, 1920×1080, etc.) ou saisissez la largeur et la hauteur en nombres.
- **{{ui:text.bg.transparent}}** : pas d'arrière-plan. Vous pouvez créer le texte seul, sur une image transparente.

Vous pouvez aussi faire un clic droit sur une image de la galerie et choisir **{{ui:gallery.menu.sendToText}}**.

### Ajouter du texte et des bulles

- **{{ui:text.add.text}}** : ajoute un calque de texte.
- **{{ui:text.add.bubble}}** : ajoute une bulle. Choisissez sa forme parmi **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** et **{{ui:text.shape.narration}}**.

Ce qui a été ajouté peut être déplacé en le faisant glisser dans l'écran. Quand vous le sélectionnez, des poignées rondes apparaissent aux quatre coins ; faites-les glisser pour redimensionner. Une bulle possède une « {{ui:text.bubble.tail}} » : faites glisser la poignée de son extrémité pour changer son orientation.

`Delete` supprime, `Ctrl+D` duplique, les flèches déplacent par petits pas, `Ctrl+Z` annule et `Ctrl+Shift+Z` (ou `Ctrl+Y`) rétablit. Les boutons **{{ui:text.undo}}** et **{{ui:text.redo}}** de l'écran font la même chose. La taille d'affichage se change avec **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** et **{{ui:text.zoom.fit}}**.

### Calques

Les textes et les bulles ajoutés sont classés dans **{{ui:text.layers.title}}** selon leur ordre de superposition. Plus un élément est haut dans la liste, plus il est au premier plan.

Pour chacun, vous pouvez utiliser **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, **{{ui:text.layer.up}}** et **{{ui:text.layer.down}}** pour changer l'ordre, **{{ui:text.layer.duplicate}}** et **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** permet de tout supprimer d'un coup.

### Mettre en forme le texte

Quand vous sélectionnez un calque, ses réglages s'affichent en dessous.

| Élément | Contenu |
|---|---|
| {{ui:text.content}} | Saisissez le texte (les retours à la ligne sont possibles) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | La police, l'épaisseur et la taille. Les polices sont incluses dans l'application, l'aspect est donc le même sur tous les ordinateurs |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** ou **{{ui:text.fill.gradient}}** (la couleur varie de haut en bas) |
| {{ui:text.stroke}}, {{ui:text.outline}} | Le contour du texte, et un contour à l'extérieur de celui-ci |
| {{ui:text.shadow}} | L'ombre. Vous pouvez choisir la couleur, le flou et le décalage |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | L'espacement entre les lettres, entre les lignes, et l'alignement |
| {{ui:text.vertical}} | Écriture verticale. En écriture verticale, l'alignement devient « {{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}} » |
| {{ui:text.bend}} | Courbe le texte (inutilisable en écriture verticale) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | La rotation et l'opacité |

Pour une bulle, vous pouvez aussi régler la taille, la couleur de remplissage, le contour et la pointe. Avec la forme **{{ui:text.shape.burst}}**, **{{ui:text.bubble.shuffle}}** change les pointes dentelées. Si vous activez **{{ui:text.bubble.autoFit}}**, le texte rétrécit pour tenir dans la bulle.

### Préréglages de style

Les préréglages tout en haut du panneau de gauche contiennent des styles de type logo : **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** et **{{ui:text.preset.soft}}**. Si vous les utilisez après avoir sélectionné un calque de texte, ce style est appliqué.

Vous pouvez aussi enregistrer votre propre style (police, remplissage, contour, ombre, espacement des lettres).

### Enregistrer

Quand c'est terminé, cliquez sur **{{ui:text.save}}**. Une image PNG de la taille de l'arrière-plan entre dans la galerie. Même après l'enregistrement, le contenu de l'édition reste à l'écran, vous pouvez donc continuer à le retoucher.

## Préréglages

Les écrans de vidéo, de musique, de voix, de logo et de texte disposent aussi de préréglages, de la même forme que pour les images. En en choisissant un dans **{{ui:presets.label}}**, en haut à gauche de l'écran, les réglages enregistrés sont appliqués d'un coup.

Pour enregistrer vos propres réglages, cliquez sur le bouton d'enregistrement (**{{ui:presets.saveNew}}**) à côté des préréglages et donnez un nom. Ce que vous avez enregistré apparaît dans **{{ui:presets.group.mine}}**. Le menu « … » de chaque élément de la liste propose aussi **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** et **{{ui:presets.delete}}**. Les préréglages fournis d'origine se trouvent dans **{{ui:presets.group.builtin}}** (leurs noms sont en anglais).

Le contenu enregistré diffère légèrement selon l'écran.

| Écran | Contenu enregistré | Contenu non enregistré |
|---|---|---|
| Vidéo | Prompt, modèle, taille, durée, réglages de qualité | Seed et image d'origine |
| Musique | Tags de style et réglages du morceau | Paroles et seed |
| Voix | Langue et voix (voix et manière de parler, ou description de la voix) | Texte à lire |
| Logo | Mots du style, forme et nombre de propositions | Texte à mettre dans le logo |
| Texte | Style du texte | Contenu du texte |

Les préréglages fournis d'origine sont les suivants : pour la vidéo, trois (« Quick preview », « Standard 832x480 », « Vertical, low VRAM »), pour la musique « Lo-fi instrumental » et « J-pop song », pour la voix « Calm narrator » et « Energetic announcer », et pour le logo cinq.

Pour savoir comment chercher et installer des modèles, voir [Modèles](08-models.md).
