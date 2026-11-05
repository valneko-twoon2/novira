# Créer des images

Ce chapitre explique comment créer une image dans l'onglet **{{ui:app.tabs.generate}}**.
Pour la disposition de l'écran, voir [Premiers pas](01-start.md) ; pour regarder et ranger les images obtenues, voir [La galerie et la visionneuse](03-gallery.md).

Le déroulement est toujours le même.

1. Choisir un modèle
2. Écrire un prompt
3. Si besoin, ajuster les réglages comme la taille et le seed
4. Appuyer sur **{{ui:params.invoke.invoke}}**

Le dessin ne commence pas à l'instant où vous appuyez : la demande entre d'abord dans la « {{ui:app.tabs.queue}} » (la file d'attente). Quand son tour arrive, l'image est dessinée, une à la fois.

Le modèle, le prompt et les réglages choisis sont conservés quand vous fermez l'application, et se retrouvent tels quels au prochain démarrage.

## Écrire le prompt

![L'onglet Générer avec une phrase dans le prompt et le seed verrouillé](shot:generate-prompt)

Le panneau « {{ui:params.prompt.title}} » à gauche comporte deux champs.

- **{{ui:params.prompt.positive}}** : Écrivez ce que vous voulez voir dessiné.
- **{{ui:params.prompt.negative}}** : Écrivez ce que vous ne voulez pas voir apparaître, par exemple `blurry, watermark` (flou, filigrane). Vous pouvez aussi générer en le laissant vide.

Quelques repères pour l'écriture.

- Alignez des mots ou de courtes phrases séparés par des virgules (`,`).
- Beaucoup de modèles répondent mieux à l'anglais. Si la description du modèle indique une manière d'écrire, suivez-la.
- Placez les mots importants au début.

Voici le rôle des petits boutons au-dessus du champ. Ils n'ont qu'une icône ; leur nom apparaît quand on les survole.

| Bouton | Rôle |
|---|---|
| **{{ui:params.prompt.recommended}}** | Ajoute à « {{ui:params.prompt.positive}} » des mots de qualité largement utilisés pour le type de modèle choisi, et à la fin de « {{ui:params.prompt.negative}} » des mots à éviter. Pour les modèles qui s'écrivent avec des tags (Illustrious, NoobAI, Pony, Anima, etc.), des tags comme `masterpiece, best quality` sont ajoutés au début ; pour les modèles qui s'écrivent avec des phrases (FLUX, Qwen-Image, etc.), des mots de qualité sont ajoutés à la fin. Pour les modèles qui n'utilisent pas de prompt négatif (FLUX.1), rien n'est ajouté au négatif. Les mots déjà présents ne sont pas ajoutés une seconde fois |
| **{{ui:params.prompt.expand}}** | Modifie le positif et le négatif côte à côte dans une grande fenêtre |
| **{{ui:params.prompt.textView}}** / **{{ui:params.prompt.tagView}}** | Fait passer l'affichage du champ du texte brut à une série d'étiquettes (tags), une par mot. Cliquer sur une étiquette ouvre une fenêtre contextuelle où l'on peut réécrire le mot, changer son poids avec le curseur, le remettre à 1 ou supprimer l'étiquette. Une étiquette dont le poids a été modifié s'écrit dans le prompt sous la forme `(smile:1.3)`. Pour ajouter une étiquette, tapez un mot dans le champ du bas et appuyez sur Entrée |
| **{{ui:params.promptBook.open}}** | Ouvre un préréglage qui rassemble des mots accompagnés de leur sens (voir plus loin) |
| **{{ui:caption.fromPrompt}}** | Regarde l'image sélectionnée dans la galerie (à défaut, un fichier image que vous choisissez) et écrit aussitôt des mots utilisables dans le prompt. Le résultat s'affiche dans la bande de la visionneuse. Vous pouvez aussi déposer sur ce bouton une image de la galerie ou un fichier image de votre ordinateur (expliqué dans [Retoucher et réutiliser les images](04-improve.md)) |

### Nombre de tokens

Le « 0 / 77 tokens » au-dessus du champ est une estimation de la quantité de mots écrits.
Un token est l'unité de découpage avec laquelle le modèle lit les mots. Au-delà de la limite, le nombre prend une couleur d'avertissement. Selon le modèle, la partie qui dépasse la limite peut avoir moins d'effet.
Le nombre est approximatif, pas exact.

### Créer plusieurs combinaisons d'un coup `{red|blue}`

Si vous écrivez dans le champ positif quelque chose comme `{red|blue}`, avec des choix séparés par une barre verticale (`|`) à l'intérieur d'accolades, une image distincte est créée pour chaque choix.

- Écrire `a {red|blue} flower` donne deux possibilités : `a red flower` et `a blue flower`.
- Si vous écrivez plusieurs groupes d'accolades, toutes les combinaisons sont créées. `a {red|blue} {cat|dog}` donne 4 possibilités.
- Vous pouvez aussi mettre des accolades à l'intérieur d'accolades.
- Pour utiliser une accolade comme simple caractère, faites-la précéder de `\` (`\{`).
- Le nombre de combinaisons est limité à 100.

Quand « {{ui:params.invoke.iterations}} » (voir plus loin) vaut 2 ou plus, le nombre d'images créées est le nombre de combinaisons multiplié par le nombre d'images. Par exemple, avec 2 possibilités et un nombre d'images de 3, cela donne 6 images.
Cette écriture ne fonctionne que dans le champ positif. Dans le champ négatif, les accolades sont traitées comme de simples caractères.

Vous pouvez vérifier en quelles phrases le prompt se développe avec le bouton **{{ui:params.prompt.dynamicPreview}}** (icône `{ }`) au-dessus du champ positif. Un clic affiche la liste des combinaisons. Le champ négatif a le même bouton, et vous pouvez y écrire `{a|b}` ou des jokers. Les combinaisons sont formées de toutes les paires positif-négatif.

### Jokers `__nom__`

![La fenêtre des jokers. La liste des listes à gauche, le nom et les éléments de la liste choisie à droite](shot:wildcards)

Si vous écrivez `__nom__` (deux tirets bas avant et après le nom) dans le champ positif, un élément de la liste de « {{ui:params.wildcards.title}} » portant ce nom y est inséré, un par un. En préparant une liste de vos choix habituels, vous n'avez plus à réécrire `{red|blue}` à chaque fois.

- Écrire `1girl, __hair-color__` crée autant de prompts que la liste hair-color comporte d'éléments.
- Les éléments peuvent eux-mêmes contenir `{a|b}` ou d'autres jokers. Les jokers imbriqués sont limités à 6 niveaux.
- La limite du nombre de combinaisons (100) est la même que pour `{ }`.
- Si vous écrivez un nom inexistant, une liste sans élément ou une liste qui s'utilise elle-même, **{{ui:params.invoke.invoke}}** ne peut pas être pressé et la raison s'affiche sous le bouton.

Les listes s'ouvrent avec **{{ui:params.wildcards.open}}**, tout en bas de la fenêtre du bouton **{{ui:params.prompt.dynamicPreview}}**. Trois listes sont fournies dès le départ : hair-color (couleur des cheveux), expression (expression du visage) et time-of-day (moment de la journée).

| Action | Rôle |
|---|---|
| **{{ui:params.wildcards.new}}** | Ajoute une liste vide |
| Champ « {{ui:params.wildcards.name}} » | Change le nom de la liste. Vous pouvez utiliser des lettres, des chiffres, `-` et `_`, et le premier et le dernier caractère doivent être une lettre ou un chiffre |
| Champ « {{ui:params.wildcards.entries}} » | Écrivez un élément par ligne. Les lignes vides et les lignes commençant par `#` ne comptent pas comme éléments |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lit et écrit une liste sous forme de fichier .txt avec un élément par ligne. Un fichier importé devient une nouvelle liste portant le nom du fichier |
| **{{ui:common.delete}}** | Supprime la liste sélectionnée |

Les listes sont enregistrées dans cette application (sur l'ordinateur que vous utilisez).

### Choisir au hasard

Quand il y a trop de combinaisons, changez « {{ui:params.prompt.dynamicMode}} » dans la fenêtre du bouton **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (réglage initial) : Pour chaque combinaison, autant d'images que le nombre d'images est créé.
- **{{ui:params.prompt.modeRandom}}** : Autant d'images que le nombre d'images est créé, et pour chaque image une combinaison est choisie. Le choix est déterminé par le seed de cette image : redessiner avec le même seed redonne donc le même prompt.

Dans les deux cas, le prompt réellement utilisé est enregistré avec l'image obtenue.

## Seed

Une image est créée à partir d'un nombre appelé « {{ui:params.seed.label}} ». Avec le même seed et les mêmes réglages, vous obtenez la même image.

Dans la ligne « {{ui:params.seed.label}} », en haut du panneau de gauche, il y a deux boutons.

- **{{ui:params.seed.random}}** (dé) : Un nouveau seed est utilisé à chaque génération. Chaque image est différente. C'est le réglage de départ.
- **{{ui:params.seed.fixed}}** (cadenas) : Le dessin utilise le seed actuel. Avec les mêmes réglages, vous obtenez toujours la même image, même en la créant plusieurs fois. C'est pratique pour voir la différence quand vous changez un seul mot du prompt.

Quand le seed est verrouillé, le champ du nombre et le bouton « {{ui:params.seed.shuffle}} » sont bloqués (pour éviter de les modifier par mégarde).
Pour utiliser un nombre précis, saisissez-le dans le champ à l'état « {{ui:params.seed.random}} », puis passez à « {{ui:params.seed.fixed}} ».
Pour réutiliser le seed d'une image que vous aimez, ouvrez-la dans la galerie et appuyez sur « {{ui:gallery.menu.useSeed}} » : le seed est chargé et verrouillé (voir [La galerie et la visionneuse](03-gallery.md)).

Si vous augmentez le nombre d'images avec le seed verrouillé, le seed augmente de 1 à chaque image à partir de la deuxième.

## Choisir un modèle

![La liste des modèles ouverte, répartie par famille : FLUX, SDXL, SD1.X, etc.](shot:model-picker)

La carte du modèle, en haut du panneau de gauche, sert à choisir le modèle qui dessine.

1. Cliquez sur le champ du nom du modèle.
2. Choisissez dans la liste. La liste est répartie par famille de modèles (FLUX, SDXL, SD1.X, etc.). Quand ils sont nombreux, saisissez une partie du nom dans le champ de recherche en haut pour filtrer.

Les modèles Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow et HunyuanImage se choisissent aussi ici. Quand le modèle principal, l'encodeur de texte et le VAE sont distribués en fichiers séparés, l'application cherche par leur nom l'encodeur de texte et le VAE parmi les modèles installés. Si vous installez un modèle auquel il manque des fichiers, « {{ui:params.parts.title}} » et une demande de confirmation s'affichent aussitôt ; vous pouvez voir les noms et les tailles, puis installer seulement les fichiers manquants. Si vous fermez en choisissant « plus tard », sous le bouton de génération s'affichent aussi un message sur les fichiers qui manquent à ce modèle et un bouton pour les installer sans quitter l'écran. Au-delà de 5 Go, une confirmation s'affiche encore après l'appui sur le bouton. Vous pouvez aussi les installer depuis **{{ui:models.install.tab.starter}}** sur l'écran des modèles. Avec ces modèles, le masque, les couches de contrôle et la haute résolution restent utilisables. Les images de référence ne s'utilisent qu'avec les modèles SD1.X et SDXL. Le choix fait dans « {{ui:params.generation.scheduler}} » n'est pas utilisé : chaque famille dessine avec l'échantillonneur et le planificateur qui lui sont propres (`euler / simple` pour Flux ; seul Anima dessine avec le planificateur choisi). Le champ « {{ui:params.generation.scheduler}} » affiche la combinaison réellement utilisée. Si vous choisissez « {{ui:params.generation.sampler}} » et « {{ui:params.generation.noiseSchedule}} », votre choix l'emporte pour tous les modèles, quelle que soit la famille.

- **Modèles d'édition.** FLUX Kontext et Qwen-Image-Edit réécrivent l'image qu'on leur donne. Placez l'image d'origine dans la source (image vers image) et écrivez dans le prompt ce que vous voulez changer. FLUX Fill repeint la partie masquée (à utiliser avec l'inpainting ou l'outpainting avec masque). Avec ces modèles, la haute résolution, les brouillons et les couches de contrôle ne sont pas utilisables. L'application les distingue des modèles ordinaires par le contenu du fichier, et pour les modèles d'édition Kontext et Qwen par les mots `kontext` et `edit` dans le nom du fichier. Ne les renommez pas.
- **FLUX.2.** klein fonctionne avec peu d'étapes (la version distillée utilise CFG 1). dev utilise la valeur du CFG comme guidage. Si vous placez l'image d'origine dans la source (image vers image), FLUX.2 la réécrit en suivant le prompt. Le masque, les couches de contrôle et la haute résolution ne sont pas utilisables avec FLUX.2 (les brouillons le sont).
- **Modèles quantifiés (GGUF).** Les modèles et encodeurs de texte dont l'extension est `.gguf` sont chargés par l'extension ComfyUI-GGUF. Installez-la une fois depuis l'écran des extensions (https://github.com/city96/ComfyUI-GGUF), puis redémarrez le moteur. Tant qu'elle n'est pas installée, la génération échoue et un message l'indique.
- **Modèles qui demandent d'autres entrées.** Les modèles qui demandent une vidéo de contrôle, un son, un mouvement de caméra ou une vidéo de pose (Wan Fun Control, Wan Animate, Flux Canny, etc.) ne peuvent pas encore fonctionner. La génération échoue et ce dont le modèle a besoin s'affiche.
3. Le modèle choisi reçoit une coche ✓, et l'image de la carte (la couverture) change aussi.

Le bouton **{{ui:app.tabs.short.models}}**, sous la liste, mène à l'onglet {{ui:app.tabs.models}} (gestion des modèles que vous possédez), et le bouton **{{ui:app.tabs.short.browse}}** à l'onglet {{ui:app.tabs.browse}} (recherche sur Internet). Pour ajouter des modèles, voir [Préparer les modèles](08-models.md).

Si des réglages recommandés (nombre d'étapes, CFG, planificateur, taille) sont enregistrés pour le modèle, ils sont appliqués automatiquement quand vous le choisissez.
Si vous passez à un modèle d'une autre famille, les LoRA et autres éléments incompatibles avec le nouveau modèle sont retirés (le nombre d'éléments retirés est signalé).

Le bouton **{{ui:params.profile.title}}**, sous le champ du modèle, affiche la liste des valeurs recommandées pour ce modèle. Quand les réglages actuels s'écartent des valeurs recommandées, le bouton prend une couleur bien visible, et **{{ui:params.profile.apply}}** permet de tout aligner sur les valeurs recommandées. Pour le nombre d'étapes, la plage acceptée va un peu en dessous jusqu'à un peu au-dessus de la valeur recommandée. Les modèles Anima s'effondrent facilement avec peu d'étapes (l'image peut même être remplie d'une seule couleur), donc le bas de leur plage est plus élevé (avec 30 recommandé, 24 ou plus).

> Si aucun modèle n'est installé, le champ affiche « {{ui:params.model.noModels}} » et la génération est impossible. Terminez d'abord [Préparer les modèles](08-models.md).

## Autres réglages

Sous le prompt, les réglages sont regroupés en sections. Cliquez pour les ouvrir ou les fermer.

| Section | Contenu |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (juste sous le prompt) | Des images qui rapprochent l'ambiance ou les personnages de l'image (voir plus loin) |
| **{{ui:params.i2i.title}}** | L'image d'origine pour redessiner à partir d'une image (i2i) et {{ui:params.image.strength}} (voir plus loin) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, largeur et hauteur. Il y a aussi les boutons « {{ui:params.image.swap}} », « {{ui:params.image.lock}} » et « {{ui:params.image.optimal}} » |
| **{{ui:params.generation.title}}** | LoRA (petits modèles supplémentaires qui ajoutent un style ou un personnage), {{ui:params.generation.scheduler}}, {{ui:params.generation.sampler}}, {{ui:params.generation.noiseSchedule}} (choisis directement parmi les noms de ComfyUI ; avec « {{ui:params.generation.engineAuto}} », le planificateur ou la valeur par défaut du modèle s'applique, et le nom alors utilisé s'affiche sous la forme « Auto (nom) » ; pour FLUX.2, seulement l'échantillonneur), {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Une seconde génération qui agrandit l'image dessinée et la redessine (voir plus loin) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (une image sans raccord visible quand on la juxtapose ; utilisable avec les modèles SD1.X et SDXL, et il faut avoir installé au préalable l'extension ComfyUI-seamless-tiling depuis l'écran des extensions), etc. |

En cas de doute, hormis la taille, vous pouvez laisser les valeurs telles qu'elles ont été appliquées au choix du modèle.
Quand vous placez le curseur sur le nom d'un réglage (« {{ui:params.generation.steps}} », « {{ui:params.generation.cfg}} », etc.), une courte explication apparaît. Le titre de chaque section affiche en petit un résumé des valeurs actuelles.

Plus la taille est grande, plus le temps et la charge pour l'ordinateur augmentent. Nous vous conseillons d'essayer d'abord en petit, puis d'agrandir avec la [mise à l'échelle](06-upscaling-workflows.md) si le résultat vous plaît.

## Correction haute résolution

![La section de correction haute résolution ouverte et activée](shot:hires-fix)

Si l'on dessine dès le départ en grande taille, on obtient facilement deux personnages ou des formes déformées. **{{ui:params.hires.title}}** dessine d'abord à la taille réglée, agrandit le résultat, puis le redessine avec le même seed et les mêmes réglages. Une seule génération donne une grande image avec tous les détails. Cette section se trouve dans les onglets {{ui:app.tabs.generate}} et {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}** : Activez-la pour l'utiliser.
- **{{ui:params.hires.scale}}** : De 1,25 à 2 fois. La taille finale s'affiche dans le titre de la section et sur la dernière ligne.
- **{{ui:params.hires.strength}}** : De 0,2 à 0,75. Bas, la première image est presque conservée ; haut, elle est largement redessinée. La valeur de départ est 0,45.
- **{{ui:params.hires.method}}** : **{{ui:params.hires.methodSmooth}}** agrandit sans utiliser de modèle. Si un modèle d'agrandissement utilisé dans l'onglet {{ui:app.tabs.upscaling}} est installé, vous pouvez aussi le choisir.
- **{{ui:params.hires.steps}}** : Le nombre d'étapes de la seconde passe. À 0, elle dessine avec le même nombre que la première.

Le temps nécessaire correspond à deux dessins. La progression est comptée sur l'ensemble des deux passes. Les LoRA et les images de référence sont aussi utilisés à la seconde passe.

Quand le résultat dépasse largement la taille de prédilection du modèle (environ 2048 px pour le côté long avec SDXL, 1536 px avec SD1.X), un avertissement apparaît sous le bouton de génération. La génération reste possible, mais si l'image se dégrade, réduisez l'agrandissement.

L'image enregistre la taille de la première passe et les valeurs de {{ui:params.hires.title}}. Si vous la chargez avec « {{ui:gallery.menu.useAll}} » dans la galerie, {{ui:params.hires.title}} est réglée de la même façon.

## Nombre d'images et bouton de génération

![Le menu ouvert avec la flèche à côté du bouton de génération](shot:invoke-menu)

Les commandes de génération sont regroupées en haut du panneau de gauche.

- **{{ui:params.invoke.invoke}}** (bouton bleu) : Ajoute à la fin de la file d'attente et génère. Vous pouvez aussi le déclencher avec `Ctrl+Enter`.
- **Le nombre à côté de ×** : Le nombre d'images créées en une opération. Avec « 3 », trois images sont créées.
- **Le bouton rouge ×** : Annule ce qui est en train d'être dessiné.
- **∨** à droite de chaque bouton : Le menu des autres opérations.

Quand le bouton ne peut pas être pressé, il devient gris et la raison (aucun modèle choisi, par exemple) s'affiche sur la ligne en dessous. En plaçant le curseur sur le bouton, vous voyez la liste des raisons.
Pendant le dessin, le bouton devient « {{ui:params.invoke.generating}} » et affiche la progression (%) ainsi que le nombre d'éléments en attente dans la file.

### Le menu ∨ du bouton de génération

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`) : Dessine dans l'ordre où vous avez appuyé. C'est la même chose qu'une génération ordinaire.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`) : Passe devant la file des éléments en attente. À utiliser pour essayer rapidement une seule image.
- **{{ui:xyplot.menu}}** : À partir des réglages actuels, aligne dans un seul tableau des images où 1 ou 2 réglages seulement ont changé. Comme elles sont dessinées avec le même seed, la seule différence vient des réglages modifiés. Choisissez en horizontal et en vertical l'échelle CFG, le nombre d'étapes, le modèle, etc., saisissez les valeurs et appuyez sur **{{ui:xyplot.run}}**.

### Le menu d'annulation

Un clic sur ∨, à droite du bouton rouge ×, ouvre le menu suivant.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`) : Supprime tout, ce qui attend comme ce qui est en cours de dessin. Aucune confirmation n'est demandée.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}** : Met le traitement de la file en pause ou le reprend.
- **{{ui:params.invoke.openQueue}}**

## Voir l'image terminée

![L'écran après la génération. L'image s'affiche dans la visionneuse au centre et figure aussi dans la galerie à droite](shot:generate-result)

Dès que vous appuyez, le centre passe à la visionneuse.
Pendant le dessin, une bande « {{ui:gallery.generating.title}} » apparaît au-dessus de la galerie à droite, avec l'image en cours, le nombre d'étapes et la progression. La fine ligne au bord supérieur du centre indique aussi la progression. La même image figure aussi en tête de la galerie, sous forme d'une petite vignette. Un clic sur cette vignette affiche l'image en cours en grand dans la visionneuse centrale. Quand la génération se termine, elle est remplacée par l'image finale.

Une fois terminée, l'image est ajoutée à la galerie et s'affiche dans la visionneuse.
L'image est enregistrée dans la planche actuellement sélectionnée (celle qui porte la marque « {{ui:gallery.boards.autoBadge}} » dans le panneau de droite). Pour les planches, ainsi que pour ranger, comparer et refaire des images, voir [La galerie et la visionneuse](03-gallery.md).

> Si le passage automatique de la visionneuse à la nouvelle image vous gêne, désactivez « {{ui:gallery.settings.autoSwitch}} » dans {{ui:gallery.settings.title}} (le bouton en forme d'engrenage).

## Préréglages

![La liste des préréglages. Les préréglages intégrés et ceux que vous avez enregistrés y figurent](shot:presets)

Vous pouvez enregistrer sous forme de préréglage les combinaisons de réglages que vous utilisez souvent. Un clic sur la carte « {{ui:presets.label}} », tout en haut du panneau de gauche, ouvre la liste.

Un préréglage regroupe les éléments suivants.

- Le prompt (positif et négatif)
- Le modèle et les réglages (taille, nombre d'étapes, CFG, planificateur, VAE, etc.)
- Les LoRA et les images de référence
- {{ui:params.hires.title}}, les réglages de l'onglet **{{ui:app.tabs.upscaling}}**, les réglages d'inpainting (flou du masque, extension, etc.) et la manière de créer les prompts dynamiques

Le seed, le nombre d'images et l'image à agrandir n'en font pas partie.

Voici comment les utiliser.

- Un clic sur un élément de la liste applique ces réglages (**{{ui:presets.apply}}**).
- **{{ui:presets.saveNew}}**, sous la liste (ou le bouton d'enregistrement à côté de la carte), enregistre les réglages actuels sous un nom.
- Le « … » à droite d'un élément permet de **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** et **{{ui:presets.delete}}**.
- La liste est divisée en « {{ui:presets.group.mine}} » et « {{ui:presets.group.builtin}} ». Les préréglages intégrés sont des exemples fournis dès le départ.

### Faire tourner les préréglages au hasard

Vous pouvez alterner au hasard entre plusieurs préréglages et générer le tout d'un coup. C'est utile pour créer à la suite de nombreuses images dont le prompt et la taille diffèrent beaucoup.

1. Appuyez sur le bouton à flèches croisées ({{ui:presets.run.title}}) à droite de la carte « {{ui:presets.label}} ».
2. Cochez les préréglages à utiliser.
3. Saisissez {{ui:presets.run.count}} dans le champ « × » et appuyez sur **{{ui:presets.run.queue}}**.

Pour chaque image, l'un des préréglages cochés est choisi avec la même probabilité, et le seed est aléatoire. Les réglages absents du préréglage reprennent ceux du panneau de gauche. Les réglages du panneau de gauche ne changent pas.

- Si les modèles diffèrent d'un préréglage à l'autre, le chargement du modèle prend du temps à chaque changement.
- Si le prompt contient un prompt dynamique, un seul prompt est choisi à partir du seed pour chaque image (toutes les combinaisons ne sont pas créées).
- Si l'un des préréglages cochés ne peut pas générer, son nom et la raison s'affichent et l'ajout à la file est impossible.
- Les cases cochées et le nombre d'images sont conservés à la prochaine ouverture.

## Préréglages de prompt

![Les préréglages de prompt. Les mots et leur sens sont classés par catégorie, avec des boutons d'ajout « Positif » et « Négatif »](shot:prompt-book)

**{{ui:params.promptBook.open}}** permet de composer un prompt même si vous ne vous souvenez pas des mots anglais. Il s'ouvre avec le bouton situé au-dessus des champs positif et négatif.

- Quand vous choisissez à gauche une catégorie (nombre de personnes, relations et interactions entre les personnages, pose, mouvement, expression, regard, composition, coiffure, vêtements, etc.), seuls les mots de cette catégorie s'affichent. Le champ de recherche en haut cherche à la fois dans les mots, les sens, les catégories et les notes.
- Un clic sur « {{ui:params.prompt.positive}} » ou « {{ui:params.prompt.negative}} » à droite d'un mot ajoute ce mot au prompt. Un mot ajouté reçoit une coche, qui disparaît si vous appuyez de nouveau.
- Saisissez un mot et son sens dans le champ tout en haut, puis appuyez sur **{{ui:params.promptBook.register}}** pour ajouter vos propres mots. Le crayon à droite d'un mot permet de le modifier, la corbeille de le supprimer.

## Images de référence

**{{ui:params.refImage.sectionLabel}}** sert à rapprocher une nouvelle image de l'« ambiance » ou du « style » d'une image existante. Elle ne la copie pas telle quelle : elle s'appuie sur les couleurs, le style graphique et l'impression générale.

1. Appuyez sur le bouton **＋** sous le prompt pour ajouter un cadre.
2. Faites glisser une image de la galerie dans ce cadre. Vous pouvez aussi y déposer un fichier image de votre ordinateur.
3. Cliquez sur le cadre pour ouvrir sa petite fenêtre de réglages.

La petite fenêtre permet de décider de ce qui suit.

- **{{ui:params.refImage.model}}** : Le modèle dédié aux images de référence (IP-Adapter). Il en faut un qui correspond à la famille du modèle choisi.
- **{{ui:params.refImage.methodLabel}}** : Ce qui sert de repère : l'ensemble, le style seulement, la composition seulement, etc. (n'apparaît pas pour certaines familles de modèles).
- **{{ui:params.refImage.weight}}** : La force du rapprochement.
- **{{ui:params.refImage.begin}}** et **{{ui:params.refImage.end}}** : Le moment, dans le déroulement du dessin, où l'effet commence et où il s'arrête.

Quand un modèle ou une extension nécessaire n'est pas installé, le cadre affiche une marque d'avertissement et un message apparaît dans la petite fenêtre et sous le bouton de génération. Vous pouvez installer l'élément manquant avec le bouton du message.

> Les images de référence servent à « rapprocher l'ambiance ». Pour « redessiner à partir de cette image », utilisez l'i2i ci-dessous.

## i2i (redessiner à partir d'une image)

Si vous placez une image dans la section **{{ui:params.i2i.title}}**, elle sert de dessin de base pour redessiner. Utilisez-la quand vous voulez garder la composition et les couleurs tout en les modifiant selon le prompt.

1. Ouvrez la section et déposez une image de la galerie (ou un fichier image de votre ordinateur) dans le cadre. Vous pouvez aussi la placer avec **{{ui:params.refImage.openI2i}}**, dans la petite fenêtre de l'image de référence.
2. La largeur et la hauteur passent à la taille de prédilection du modèle la plus proche de la forme de l'image placée. Vous pouvez ensuite les modifier à la main.
3. **{{ui:params.image.strength}}** décide dans quelle mesure l'image est redessinée. Plus proche de 0, plus l'image d'origine est conservée ; plus proche de 1, plus elle est dessinée sans s'en soucier. Nous vous conseillons d'essayer autour de 0,5.

Si vous activez {{ui:params.hires.title}}, l'image redessinée à partir de l'image d'origine est agrandie puis redessinée une nouvelle fois. Pour la retirer, appuyez sur le × en haut à droite du cadre. Pour redessiner seulement la partie que vous avez peinte, utilisez [Dessiner davantage sur la toile](05-canvas.md).

### Personnages

Dans le champ « {{ui:character.row.label}} », au-dessus de l'image de référence, vous pouvez appeler un personnage enregistré (autant d'images du même personnage que vous voulez, avec des mots décrivant son apparence).
Quand vous en choisissez un, ses images de référence et les mots de son apparence sont réglés. L'enregistrement d'un personnage est expliqué dans [Retoucher et réutiliser les images](04-improve.md).

## File d'attente

![L'onglet File d'attente. Les éléments en cours de traitement et ceux qui attendent y sont listés](shot:queue)

L'onglet **{{ui:app.tabs.queue}}** permet de voir et de manipuler la file d'attente de génération. Quand des éléments attendent, un badge numérique apparaît sur {{ui:app.tabs.queue}} dans la navigation latérale.

En haut de l'écran, on trouve les éléments suivants.

- L'état du traitement (« {{ui:queue.processor.running}} » ou « {{ui:queue.processor.paused}} ») et les boutons de commande.
- Le détail du nombre d'éléments ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- En haut à droite, la progression de l'élément en cours de dessin.

Voici le rôle des boutons.

| Bouton | Rôle |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Met en pause ou reprend le traitement de la file d'attente. Ce qui est en cours de dessin va jusqu'au bout |
| **{{ui:queue.action.cancelCurrent}}** | Arrête ce qui est en cours de dessin |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Annule tout ce qui attend |
| **{{ui:queue.action.prune}}** | Retire de la liste les éléments terminés (terminés, échoués, annulés) |
| **{{ui:queue.action.clear}}** | Supprime tous les éléments. Une fenêtre de confirmation s'affiche |

Un clic sur une ligne de la liste du bas ouvre les informations détaillées de l'élément (heure, image obtenue, raison de l'échec, contenu des réglages).
Le × à droite d'une ligne annule uniquement cet élément. Pour un élément échoué ou annulé, un bouton de nouvelle tentative apparaît.

## Raccourcis clavier

Pour ceux qui ne fonctionnent pas pendant la saisie de texte, quittez d'abord le champ avant d'appuyer.

| Action | Touche |
|---|---|
| Générer (ajouter à la fin de la file) | `Ctrl+Enter` (fonctionne aussi pendant la saisie du prompt) |
| Ajouter en tête de la file et générer | `Ctrl+Shift+Enter` |
| Annuler ce qui est en cours de dessin | `Shift+X` |
| Vider toute la file (sans confirmation) | `Ctrl+Shift+X` |
| Aller au champ du prompt | `Alt+A` |
| Ouvrir ou fermer le panneau de gauche, celui de droite | `T`, `G` |
| Ouvrir ou fermer les deux panneaux à la fois | `F` |
| Changer d'onglet (dans l'ordre de la navigation latérale, de {{ui:app.tabs.generate}} à {{ui:app.nav.extensions}}) | `1` à `9` |
| Ouvrir la liste des raccourcis | `Shift+?` |

Vous pouvez aussi consulter les raccourcis dans « {{ui:app.nav.hotkeys}} », dans le menu **{{ui:app.nav.settings}}** de la navigation latérale.
