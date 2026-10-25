# Créer des images

Ce chapitre explique comment créer des images dans l'onglet **{{ui:app.tabs.generate}}**.
Pour savoir lire l'écran, consultez [Premiers pas](01-start.md). Pour regarder et organiser les images que vous créez, consultez [La galerie et la visionneuse](03-gallery.md).

Le déroulement est toujours le même.

1. Choisir un modèle
2. Écrire un prompt
3. Si besoin, ajuster des réglages comme la taille et la seed
4. Appuyer sur **{{ui:params.invoke.invoke}}**

L'image ne commence pas à être dessinée à l'instant où vous appuyez sur le bouton. Elle entre d'abord dans la « {{ui:app.tabs.queue}} ». Quand son tour arrive, les images sont dessinées une par une.

## Écrire un prompt

![L'onglet Générer avec une phrase écrite dans le prompt et la seed fixée](shot:generate-prompt)

Le « {{ui:params.prompt.title}} » du panneau de gauche comporte deux champs.

- **{{ui:params.prompt.positive}}** : Écrivez ce que vous voulez voir dessiné.
- **{{ui:params.prompt.negative}}** : Écrivez ce que vous ne voulez pas voir apparaître. Par exemple, `blurry, watermark` (flou, filigrane). Vous pouvez aussi générer en le laissant vide.

Voici quelques règles pratiques pour écrire.

- Alignez des mots ou de courtes expressions, séparés par des virgules (`,`).
- Avec beaucoup de modèles, l'anglais donne plus souvent ce que l'on attend. Si la description du modèle indique comment écrire pour lui, suivez-la.
- Placez les mots importants vers le début.

Les petits boutons au-dessus des champs font ce qui suit.

| Bouton | Ce qu'il fait |
|---|---|
| **{{ui:params.prompt.recommended}}** | Ajoute au début de « {{ui:params.prompt.positive}} » des mots de qualité adaptés au modèle sélectionné (comme `masterpiece, best quality`), et à la fin de « {{ui:params.prompt.negative}} » des mots couramment évités. Les mots déjà présents ne sont pas ajoutés deux fois |
| **{{ui:params.prompt.expand}}** | Modifie le positif et le négatif côte à côte dans une grande fenêtre |
| **{{ui:params.promptBook.open}}** | Ouvre une liste de mots regroupés avec leur signification (décrite plus bas) |
| **{{ui:caption.fromPrompt}}** | Regarde une image et écrit des mots utilisables comme prompt. Vous pouvez aussi déposer sur ce bouton une image de la galerie ou un fichier d'image de votre ordinateur (expliqué dans [Retoucher et réutiliser les images](04-improve.md)) |
| « {{ui:presets.label}} » de chaque champ | Enregistre et rappelle uniquement le texte du prompt (décrit plus bas) |

### Nombre de tokens

Le « 0 / 77 tokens » au-dessus du champ est une mesure approximative de la quantité de texte écrite.
Un token est une unité que le modèle utilise pour lire les mots. Si vous dépassez la limite, le nombre prend une couleur d'avertissement. Avec certains modèles, la partie au-delà de la limite peut avoir moins d'effet.
Le nombre est « approximatif ». Ce n'est pas un décompte exact.

### Créer toutes les combinaisons d'un coup avec `{red|blue}`

Si vous écrivez dans le champ positif des accolades avec des choix séparés par des barres verticales (`|`), comme `{red|blue}`, une image distincte est créée pour chaque choix.

- Écrire `a {red|blue} flower` donne deux versions : `a red flower` et `a blue flower`.
- Si vous écrivez deux jeux d'accolades ou plus, vous obtenez toutes les combinaisons. `a {red|blue} {cat|dog}` en donne quatre.
- Vous pouvez aussi mettre des accolades à l'intérieur d'accolades.
- Pour utiliser une accolade comme un caractère ordinaire, placez `\` devant (`\{`).
- Le nombre de combinaisons est limité à 100.

Quand le « {{ui:params.invoke.iterations}} » (décrit plus bas) est de 2 ou plus, le nombre d'images créées est le nombre de combinaisons multiplié par ce nombre. Par exemple, 2 combinaisons avec un nombre de 3 donnent 6 images.
Cette syntaxe ne fonctionne que dans le champ positif. Dans le champ négatif, les accolades sont traitées comme de simples caractères.

Vous pouvez vérifier quel texte est obtenu avec le bouton **{{ui:params.prompt.dynamicPreview}}** (l'icône `{ }`) au-dessus du champ positif. Un clic dessus affiche la liste des combinaisons.

### Wildcards `__nom__`

![La fenêtre des wildcards : les listes à gauche, le nom et les entrées de la liste choisie à droite](shot:wildcards)

Écrivez `__nom__` (deux tirets bas avant et après le nom) dans le champ positif, et les entrées de la liste de « {{ui:params.wildcards.title}} » portant ce nom y sont placées, une à la fois. Gardez dans une liste les choix que vous utilisez souvent et vous n'avez plus à écrire `{red|blue}` à chaque fois.

- `1girl, __hair-color__` crée un prompt pour chaque entrée de la liste hair-color.
- Les entrées peuvent utiliser `{a|b}` et d'autres wildcards. Les wildcards imbriqués vont jusqu'à 6 niveaux au plus.
- La limite du nombre de combinaisons (100) est la même que pour `{ }`.
- Un nom sans liste, une liste sans entrées ou une liste qui s'utilise elle-même empêche d'appuyer sur **{{ui:params.invoke.invoke}}**, et la raison s'affiche sous le bouton.

Ouvrez les listes avec **{{ui:params.wildcards.open}}** en bas de la fenêtre du bouton **{{ui:params.prompt.dynamicPreview}}**. Trois listes sont fournies avec l'application : hair-color, expression et time-of-day.

| Commande | Ce qu'elle fait |
|---|---|
| **{{ui:params.wildcards.new}}** | Ajoute une liste vide |
| Le champ « {{ui:params.wildcards.name}} » | Renomme la liste. Utilisez des lettres, des chiffres, `-` et `_`, en commençant et en finissant par une lettre ou un chiffre |
| Le champ « {{ui:params.wildcards.entries}} » | Une entrée par ligne. Les lignes vides et celles qui commencent par `#` ne sont pas des entrées |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lit ou écrit une liste sous forme de fichier .txt avec une entrée par ligne. Un fichier importé devient une nouvelle liste portant le nom du fichier |
| **{{ui:common.delete}}** | Supprime la liste choisie |

Les listes sont conservées dans l'application (sur l'ordinateur que vous utilisez).

### Choisir au hasard

Quand il y a trop de combinaisons, changez « {{ui:params.prompt.dynamicMode}} » dans la fenêtre du bouton **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (par défaut) : crée le nombre d'images pour chaque combinaison.
- **{{ui:params.prompt.modeRandom}}** : crée le nombre d'images et choisit une combinaison pour chacune. Le choix suit la seed de l'image, donc dessiner de nouveau avec la même seed donne le même prompt.

Dans les deux cas, chaque image terminée conserve le prompt réellement utilisé.

## Seed

Une image est créée à partir d'un nombre appelé « {{ui:params.seed.label}} ». La même seed avec les mêmes réglages donne la même image.

Dans la ligne « {{ui:params.seed.label}} » en haut du panneau de gauche, il y a deux boutons.

- **{{ui:params.seed.random}}** (le dé) : Une nouvelle seed est utilisée à chaque génération. Vous obtenez une image différente à chaque fois. C'est le réglage par défaut.
- **{{ui:params.seed.fixed}}** (le cadenas) : Il dessine avec la seed actuelle. Quel que soit le nombre de fois où vous générez avec les mêmes réglages, vous obtenez la même image. C'est pratique pour voir la différence produite par le changement d'un seul mot du prompt.

Quand elle est fixée, le champ numérique de la seed et le bouton « {{ui:params.seed.shuffle}} » sont verrouillés (cela évite de les modifier par accident).
Si vous voulez utiliser un nombre précis, saisissez-le dans le champ numérique pendant que « {{ui:params.seed.random}} » est sélectionné, puis passez à « {{ui:params.seed.fixed}} ».
Si vous voulez utiliser la seed d'une image que vous aimez, ouvrez cette image dans la galerie et appuyez sur « {{ui:gallery.menu.useSeed}} ». Cela charge la seed et la fixe (voir [La galerie et la visionneuse](03-gallery.md)).

Si vous augmentez le nombre d'images alors que la seed est fixée, la deuxième image et les suivantes utilisent des seeds qui augmentent de 1 à chaque fois.

## Choisir un modèle

![La liste des modèles ouverte, divisée par famille comme FLUX, SDXL et SD1.X](shot:model-picker)

Avec la carte du modèle en haut du panneau de gauche, vous choisissez le modèle qui dessine l'image.

1. Cliquez sur le champ du nom du modèle.
2. Choisissez dans la liste. La liste est divisée par famille de modèles (FLUX, SDXL, SD1.X, etc.). Quand ils sont nombreux, saisissez une partie du nom dans le champ de recherche en haut pour restreindre la liste.
3. Le modèle choisi reçoit un ✓, et l'image de la carte (l'image de couverture) change aussi.

Sous la liste, le bouton **{{ui:app.tabs.short.models}}** mène à l'onglet {{ui:app.tabs.models}} (gérer les modèles que vous possédez), et le bouton **{{ui:app.tabs.short.browse}}** mène à l'onglet {{ui:app.tabs.browse}} (rechercher sur Internet). La façon d'ajouter d'autres modèles est expliquée dans [Préparer les modèles](08-models.md).

Si des réglages recommandés (étapes, CFG, planificateur, taille) sont enregistrés pour le modèle, ils sont remplis automatiquement lorsque vous le choisissez.
Quand vous passez à un modèle d'une autre famille, les LoRA et autres éléments qui ne conviennent pas au nouveau modèle sont retirés (on vous indique combien ont été retirés).

Appuyez sur le bouton **{{ui:params.profile.title}}** sous le champ du modèle pour voir sous forme de liste les valeurs recommandées pour ce modèle. Si vos réglages actuels diffèrent des valeurs recommandées, le bouton prend une couleur plus visible, et **{{ui:params.profile.apply}}** règle tout sur les valeurs recommandées.

> Quand aucun modèle n'est installé, le champ indique « {{ui:params.model.noModels}} » et vous ne pouvez pas générer. Terminez d'abord [Préparer les modèles](08-models.md).

## Autres réglages

Sous le prompt, des sections regroupent les réglages. Vous pouvez les ouvrir et les fermer en cliquant.

| Section | Ce qu'elle contient |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (juste sous le prompt) | Des images servant à orienter l'ambiance ou les personnages d'une image (décrites plus bas) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, largeur et hauteur. Il y a aussi les boutons « {{ui:params.image.swap}} », « {{ui:params.image.lock}} » et « {{ui:params.image.optimal}} » |
| **{{ui:params.generation.title}}** | LoRA (un petit modèle complémentaire qui ajoute un style ou un personnage), {{ui:params.generation.scheduler}}, {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Une seconde passe qui agrandit l'image dessinée et la redessine (voir plus bas) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (images qui ne montrent aucune jointure une fois juxtaposées en mosaïque), etc. |

En cas de doute, vous pouvez garder les valeurs remplies au choix du modèle, à l'exception de la taille.
Placez le curseur sur le nom d'un élément (« {{ui:params.generation.steps}} », « {{ui:params.generation.cfg}} », etc.) pour voir une courte explication. Le titre de chaque section affiche un petit résumé de ses valeurs actuelles.

Plus la taille est grande, plus cela demande de temps et de charge à votre ordinateur. Il est recommandé d'essayer d'abord une taille plus petite et, si le résultat est bon, de l'agrandir avec [Mise à l'échelle](06-upscaling-workflows.md).

## Correction haute résolution

![La section de correction haute résolution ouverte et activée](shot:hires-fix)

Dessiner dès le départ à une grande taille donne souvent deux personnes au lieu d'une, ou des formes déformées. **{{ui:params.hires.title}}** dessine d'abord à la taille que vous avez réglée, agrandit l'image, puis la redessine avec la même seed et les mêmes réglages. Une seule génération donne une grande image détaillée partout. Cette section se trouve dans les onglets {{ui:app.tabs.generate}} et {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}** : activez-la pour l'utiliser.
- **{{ui:params.hires.scale}}** : de 1,25 à 2 fois. La taille finale s'affiche dans le titre de la section et sur la ligne du bas.
- **{{ui:params.hires.strength}}** : de 0,2 à 0,75. Une valeur basse garde la première image presque telle quelle ; une valeur élevée redessine davantage. La valeur par défaut est 0,45.
- **{{ui:params.hires.method}}** : **{{ui:params.hires.methodSmooth}}** agrandit sans modèle. Si vous avez des modèles d'agrandissement (ceux qu'utilise l'onglet {{ui:app.tabs.upscaling}}), vous pouvez aussi en choisir un.
- **{{ui:params.hires.steps}}** : les étapes de la seconde passe. 0 en utilise autant que la première passe.

Cela prend à peu près le temps de deux dessins. La progression compte les deux passes ensemble. Les LoRA et les images de référence sont aussi utilisés dans la seconde passe.

Quand le résultat est bien plus grand que ce que le modèle dessine bien (environ 2048 px sur le grand côté pour SDXL, 1536 px pour SD1.X), une note s'affiche sous le bouton de génération. Vous pouvez quand même générer ; si l'image se dégrade, réduisez l'échelle.

L'image conserve la taille de la première passe et les réglages de la {{ui:params.hires.title}}. La charger avec « {{ui:gallery.menu.useAll}} » dans la galerie rétablit la {{ui:params.hires.title}} telle qu'elle était.

## Itérations et bouton Générer

![Le menu ouvert avec la flèche à côté du bouton Générer](shot:invoke-menu)

Les commandes de génération sont regroupées en haut du panneau de gauche.

- **{{ui:params.invoke.invoke}}** (le bouton bleu) : Ajoute à la fin de la file d'attente et génère. Vous pouvez aussi appuyer sur `Ctrl+Enter`.
- **Le nombre à côté de ×** : Combien d'images sont créées en une opération. Réglez-le sur « 3 » et trois images sont créées.
- **Le bouton × rouge** : Annule ce qui est en cours de dessin.
- **Le ∨ à droite de chaque bouton** : Un menu d'autres opérations.

Quand il ne peut pas être pressé, le bouton devient gris et la raison (par exemple, aucun modèle sélectionné) apparaît sur la ligne en dessous. Placez le curseur sur le bouton pour voir la liste des raisons.
Pendant le dessin, le bouton devient « {{ui:params.invoke.generating}} » et affiche la progression (%) et le nombre d'éléments en attente dans la file.

### Le menu ∨ du bouton Générer

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`) : Dessine dans l'ordre où vous avez appuyé. C'est identique à une génération normale.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`) : Passe devant dans la file d'attente. Utilisez-le quand vous êtes pressé et voulez essayer une seule image.
- **{{ui:xyplot.menu}}** : À partir des réglages actuels, il aligne dans une même grille des images où un ou deux réglages ont été modifiés. Elles sont dessinées avec la même seed, la seule différence est donc le réglage modifié. Choisissez l'échelle CFG, les étapes, le modèle ou autre pour les axes horizontal et vertical, saisissez les valeurs et appuyez sur **{{ui:xyplot.run}}**.

### Le menu d'annulation

Appuyez sur le ∨ à droite du bouton × rouge pour afficher le menu suivant.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`) : Retire tout, ce qui attend comme ce qui est en cours de dessin. Aucune confirmation n'apparaît.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}** : Arrête et reprend le traitement de la file d'attente.
- **{{ui:params.invoke.openQueue}}**

## Regarder l'image terminée

![L'écran après la fin de la génération. L'image est affichée dans la visionneuse au centre et figure aussi dans la galerie à droite](shot:generate-result)

Dès que vous appuyez sur le bouton, le centre passe à la visionneuse.
Pendant le dessin, une bande « {{ui:gallery.generating.title}} » apparaît au-dessus de la galerie à droite, et vous voyez l'image en cours, le nombre d'étapes et l'avancement. La fine ligne au bord supérieur du centre indique aussi la progression.

Quand c'est terminé, l'image est ajoutée à la galerie et affichée dans la visionneuse.
L'image est enregistrée dans la planche actuellement sélectionnée (celle marquée « {{ui:gallery.boards.autoBadge}} » dans le panneau de droite). Les planches, ainsi que l'organisation, la comparaison et la reprise des images, sont expliquées dans [La galerie et la visionneuse](03-gallery.md).

> Si le changement automatique de la visionneuse à chaque nouvelle image vous gêne, désactivez « {{ui:gallery.settings.autoSwitch}} » dans « {{ui:gallery.settings.title}} » (le bouton en forme d'engrenage).

## Préréglages

![La liste des préréglages, avec les préréglages intégrés et les préréglages enregistrés](shot:presets)

Vous pouvez enregistrer sous forme de préréglage une combinaison de réglages que vous utilisez souvent. Appuyez sur la carte « {{ui:presets.label}} » tout en haut du panneau de gauche pour ouvrir la liste.

Un préréglage contient ensemble ce qui suit.

- Les prompts (positif et négatif)
- Le modèle et chaque réglage (taille, étapes, CFG, planificateur, VAE, etc.)
- Les LoRA et les images de référence

La seed et le nombre n'y sont pas inclus.

Voici comment les utiliser.

- Cliquez sur un élément de la liste et ses réglages sont appliqués (**{{ui:presets.apply}}**).
- Avec **{{ui:presets.saveNew}}** en bas de la liste (ou le bouton d'enregistrement à côté de la carte), vous enregistrez les réglages actuels sous un nom.
- Le « … » à droite d'un élément permet de **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** et **{{ui:presets.delete}}**.
- La liste est divisée en « {{ui:presets.group.mine}} » et « {{ui:presets.group.builtin}} ». Les préréglages intégrés sont des exemples fournis avec l'application.

Indépendamment de cela, il existe aussi un champ de préréglages au-dessus des champs positif et négatif. Celui-ci enregistre et rappelle uniquement le texte du prompt. Il convient pour enregistrer des formules toutes faites (ensembles de mots de qualité ou de mots à éviter).

## La liste de prompts

![La liste de prompts. Les mots et leurs significations sont alignés par catégorie, avec les boutons d'ajout Positif et Négatif](shot:prompt-book)

Pour que vous puissiez construire des prompts même si vous ne vous souvenez pas des mots anglais, il existe la **{{ui:params.promptBook.open}}**. Ouvrez-la avec le bouton au-dessus des champs positif et négatif.

- Quand vous choisissez une catégorie à gauche (coiffures, expressions, vêtements, composition, etc.), seuls les mots de cette catégorie sont listés. Le champ de recherche en haut cherche en même temps dans les mots, les significations, les catégories et les notes.
- Appuyez sur « {{ui:params.prompt.positive}} » ou « {{ui:params.prompt.negative}} » à droite d'un mot et le mot est ajouté au prompt. Un mot ajouté reçoit une coche, et un nouvel appui le retire.
- Saisissez un mot et sa signification dans le champ de saisie tout en haut et appuyez sur **{{ui:params.promptBook.register}}** pour ajouter votre propre mot. Le crayon à droite d'un mot le modifie, et la corbeille le supprime.

## Images de référence

**{{ui:params.refImage.sectionLabel}}** est une fonction qui oriente une nouvelle image vers l'« ambiance » ou le « style » d'une image existante. Elle ne la copie pas telle quelle. Elle utilise la palette de couleurs, le style graphique et l'impression générale comme indices.

1. Appuyez sur le bouton **＋** sous le prompt pour ajouter un cadre.
2. Faites glisser une image de la galerie et déposez-la sur ce cadre. Vous pouvez aussi déposer un fichier d'image de votre ordinateur.
3. Cliquez sur le cadre et une petite fenêtre de réglages s'ouvre.

Dans la petite fenêtre, vous pouvez décider de ce qui suit.

- **{{ui:params.refImage.model}}** : Le modèle dédié aux images de référence (IP-Adapter). Il en faut un qui convienne à la famille du modèle que vous avez sélectionné.
- **{{ui:params.refImage.methodLabel}}** : Ce qui sert d'indice, comme l'image entière, le style seul ou la composition seule (il n'apparaît pas pour certaines familles de modèles).
- **{{ui:params.refImage.weight}}** : Avec quelle force orienter.
- **{{ui:params.refImage.begin}}** et **{{ui:params.refImage.end}}** : De quel point à quel point du processus de dessin cela agit.

Quand un modèle ou une extension nécessaire n'est pas installé, une marque d'avertissement apparaît sur le cadre, et des indications apparaissent dans la petite fenêtre et sous le bouton Générer. Le bouton affiché dans ces indications permet de l'installer.

> Une image de référence sert à « orienter l'ambiance ». Quand vous voulez « redessiner à partir de cette image », utilisez la toile. Consultez [Dessiner davantage sur la toile](05-canvas.md).

### Personnages

Dans le champ « {{ui:character.row.label}} » au-dessus des images de référence, vous pouvez rappeler des personnages enregistrés (un nombre quelconque d'images d'un même personnage, avec des mots décrivant son apparence).
Quand vous en choisissez un, les images de référence et les mots d'apparence de ce personnage sont définis. La façon d'enregistrer un personnage est expliquée dans [Retoucher et réutiliser les images](04-improve.md).

## File d'attente

![L'onglet File d'attente. L'élément en cours de traitement et les éléments en attente sont listés](shot:queue)

Dans l'onglet **{{ui:app.tabs.queue}}**, vous pouvez voir et gérer la file d'attente de génération. Quand des éléments attendent, un badge numérique apparaît sur {{ui:app.tabs.queue}} dans la navigation latérale.

En haut de l'écran, on trouve ce qui suit.

- L'état du traitement (« {{ui:queue.processor.running}} » ou « {{ui:queue.processor.paused}} ») et les boutons de commande.
- Le détail du nombre d'éléments ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- En haut à droite, l'avancement de l'élément en cours de dessin.

Les boutons font ce qui suit.

| Bouton | Ce qu'il fait |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Arrête ou reprend le traitement de la file d'attente. L'élément en cours de dessin est terminé normalement |
| **{{ui:queue.action.cancelCurrent}}** | Arrête ce qui est en cours de dessin |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Annule tout ce qui attend |
| **{{ui:queue.action.prune}}** | Retire de la liste les éléments finis (terminés, en échec ou annulés) |
| **{{ui:queue.action.clear}}** | Retire tous les éléments. Une fenêtre de confirmation apparaît |

Cliquez sur une ligne de la liste ci-dessous pour ouvrir les informations détaillées de cet élément (les heures, les images créées, la raison de l'échec et le contenu des réglages).
Le × à droite d'une ligne annule uniquement cet élément. Les éléments en échec ou annulés reçoivent un bouton pour réessayer.

## Raccourcis clavier

Pour les raccourcis qui ne fonctionnent pas pendant la saisie, quittez le champ de saisie avant de les utiliser.

| Action | Touche |
|---|---|
| Générer (ajouter à la fin de la file d'attente) | `Ctrl+Enter` (fonctionne même pendant la saisie du prompt) |
| Ajouter au début de la file d'attente et générer | `Ctrl+Shift+Enter` |
| Annuler ce qui est en cours de dessin | `Shift+X` |
| Vider toute la file d'attente (sans confirmation) | `Ctrl+Shift+X` |
| Aller au champ du prompt | `Alt+A` |
| Ouvrir et fermer le panneau de gauche, le panneau de droite | `T`, `G` |
| Ouvrir et fermer les deux panneaux ensemble | `F` |
| Changer d'onglet (dans l'ordre de {{ui:app.tabs.generate}} à {{ui:app.tabs.queue}}) | `1` à `9` |
| Ouvrir la liste des raccourcis | `Shift+?` |

Vous pouvez aussi consulter les raccourcis sous « {{ui:app.nav.hotkeys}} » dans le menu **{{ui:app.nav.settings}}** de la navigation latérale.
