# Assistant IA, paramètres et raccourcis clavier

Ce chapitre présente l'assistant IA, qui règle les paramètres à partir d'une simple phrase, l'écran des paramètres, la liste des raccourcis clavier, l'écran d'informations sur l'application et le journal développeur.

L'écran des paramètres, les raccourcis clavier et les informations sur l'application s'ouvrent depuis **{{ui:app.nav.settingsMenu}}**, en bas à gauche de l'écran.

## Assistant IA

![La fenêtre de l'assistant IA. Premier écran, où l'on choisit l'IA à utiliser et où l'on se connecte](shot:agent)

Un clic sur le bouton **IA** (**{{ui:agent.open}}**) de la navigation de gauche ouvre la fenêtre **{{ui:agent.title}}**. On peut déplacer la fenêtre en faisant glisser son titre.

Au lieu de choisir vous-même les modèles et les LoRA ou de régler le prompt et la taille, décrivez ce que vous voulez créer par une phrase, par exemple « une jeune fille de style anime debout sur une plage au coucher du soleil » : l'assistant choisit les réglages et les saisit à votre place.

### Commencer (connexion)

L'assistant IA ne fait pas tourner une IA lui-même : novira appelle la commande d'IA présente sur votre ordinateur (Claude ou Codex) pour produire la réponse. Pour l'utiliser, il faut d'abord préparer ceci.

1. Installez sur l'ordinateur l'une des deux commandes : **Claude** d'Anthropic ou **Codex** d'OpenAI.
2. Ouvrez l'assistant et cliquez sur celle que vous voulez utiliser (**{{ui:agent.setup.claude}}** ou **{{ui:agent.setup.codex}}**).
3. Une page du navigateur s'ouvre : connectez-vous.

Si la commande est introuvable sur l'ordinateur, un message « La commande ○○ est introuvable sur ce PC. Installez-la d'abord. » s'affiche. Installez d'abord cette commande.

Le service utilisé et son abonnement sont ceux du fournisseur que vous avez choisi. novira n'enregistre aucune clé d'API. Le contenu des échanges (le texte envoyé, la liste actuelle des modèles et les réglages, etc.) est envoyé au service choisi.

L'IA choisie s'affiche dans le titre en haut de la fenêtre. Pour la changer, cliquez sur le bouton **{{ui:agent.changeProvider}}** en haut.

### Ce que fait l'assistant

À partir de votre texte, l'assistant décide des points suivants et les applique aux réglages. Ce qu'il a appliqué est listé dans la réponse.

| Contenu | Exemple |
|---|---|
| Choix du modèle | Choisit le plus adapté parmi les modèles installés |
| Ajout de LoRA | Ajoute une LoRA qui correspond au style |
| Prompt | Écrit le prompt et le prompt négatif |
| Changement de paramètres | Taille, nombre d'étapes, CFG, planificateur, seed |
| Workflow | Crée un graphe, corrige le graphe ouvert |
| Texte | Corrige le texte ou la bulle ouverts dans **{{ui:media.tab.text}}** |
| Vidéo, musique, voix | Modifie les réglages de chacun de ces écrans |
| BD | Dans **{{ui:app.tabs.comic}}**, modifie le découpage en cases, ajoute et coupe des cases, et modifie le prompt et la pose de chaque case ainsi que les bulles (voir « Se faire aider pour la BD » plus bas) |
| Pose | Place sur **{{ui:app.tabs.canvas}}** un personnage dans la pose demandée par écrit (voir [Dessiner davantage sur la toile](05-canvas.md#créer-une-pose-sur-la-toile)) |
| Recommandation d'extensions | Indique les extensions qui conviennent à ce que vous voulez faire, installables depuis un bouton |
| Utilisation de l'application | Répond où cliquer, en utilisant les noms affichés à l'écran |
| Explication des extensions | Explique ce qu'elles permettent et comment les utiliser (voir « Poser des questions sur l'utilisation ou les extensions » plus bas) |

L'assistant voit quel écran est ouvert. Par exemple, si **{{ui:media.tab.text}}** est ouvert et que vous demandez « mets le texte à la verticale », ce texte change.

L'assistant se contente de modifier les réglages. Il ne crée pas d'image. Si le résultat vous convient, cliquez sur **{{ui:agent.generate}}** dans la réponse pour lancer directement la création.

### Se faire aider pour la BD

Si vous demandez quelque chose avec **{{ui:app.tabs.comic}}** ouvert, l'assistant lit la page ouverte (la forme des cases, le prompt de chaque case, les poses et les bulles) et la réécrit directement. Par exemple, vous pouvez demander ceci.

- Demandez « Fais 5 cases avec un temps fort. La première en grand, coupée en biais » et il crée le découpage en cases. Il peut utiliser un modèle standard ou décider lui-même de la forme des cases.
- Demandez « Écris le prompt de chaque case avec cette histoire » et il écrit pour chaque case un prompt avec un cadrage adapté au déroulement de l'histoire (gros plan, plan large, contre-plongée, etc.).
- Demandez « Mets des dialogues dans chaque case » et il place des bulles et y écrit les répliques.
- Demandez « Mets la fille de la case 2 dans une pose de course » et il donne une pose à cette case.

Il ne dessine pas les images elles-mêmes. Une fois les prompts en place, cliquez sur **{{ui:comic.panel.draw}}** ou **{{ui:comic.page.drawAll}}**. Un clic sur **{{ui:agent.undo}}** remet en l'état, d'un seul coup, les pages de BD modifiées par cette réponse.

### Choisir le modèle et le niveau de réflexion

Cliquez sur le petit bouton en forme de cerveau, à droite du nom de la discussion, pour choisir le **{{ui:agent.model.label}}** et le **{{ui:agent.effort.label}}** utilisés par l'assistant. Ce choix s'applique dès le prochain message envoyé. Claude et Codex mémorisent chacun leur propre choix.

- Pour Claude, le modèle se choisit parmi **{{ui:agent.model.default}}**, Fable, Opus, Sonnet et Haiku. **{{ui:agent.model.custom}}** permet de saisir directement le nom d'un modèle. Le niveau de réflexion compte 5 degrés, de **{{ui:agent.effort.low}}** à **{{ui:agent.effort.max}}**.
- Pour Codex, le modèle ne peut pas être choisi (c'est le réglage de la commande elle-même qui s'applique). Le niveau de réflexion est **{{ui:agent.effort.low}}**, **{{ui:agent.effort.medium}}** ou **{{ui:agent.effort.high}}**.

Avec **{{ui:agent.model.default}}**, c'est le réglage de la commande elle-même qui s'applique.

### Appeler un modèle de demande

Tapez « / » au début du champ de saisie pour ouvrir la liste des modèles de demandes fréquentes. Continuez à taper après le « / » pour ne garder que ceux dont le nom, la commande ou le texte contient ces caractères (par exemple « /BD » ou « /comic »).

Choisissez avec les flèches haut et bas, puis validez avec Entrée ou Tab. Un clic sur une ligne de la liste valide aussi. Le texte du modèle choisi est placé dans le champ de saisie : complétez-le, puis envoyez-le (le choisir ne l'envoie pas). La touche Échap ferme la liste.

### Poser des questions sur l'utilisation ou les extensions

Vous pouvez aussi poser des questions, pas seulement demander des réglages. Par exemple, si vous demandez « comment supprimer l'arrière-plan ? » ou « où cliquer pour ajouter un modèle ? », l'assistant répond où cliquer en utilisant les noms affichés à l'écran. La réponse arrive dans la langue que vous utilisez actuellement.

On peut aussi l'interroger sur les extensions. Il explique en termes simples ce qu'elles permettent, quand les utiliser et comment. Il y a 3 façons de demander.

- Cliquer sur une carte dans la liste de **{{ui:app.nav.extensions}}** pour ouvrir ses détails, puis cliquer sur **{{ui:agent.ask.button}}**. Une question sur cette extension est envoyée dans une nouvelle discussion.
- Saisir un mot dans le champ de recherche au-dessus de **{{ui:app.nav.extensions}}**, puis cliquer sur **{{ui:agent.ask.resultsButton}}** qui apparaît. L'assistant répond sur les différences entre les extensions trouvées (jusqu'aux 8 premières) et par laquelle commencer.
- Écrire dans la discussion le nom d'une extension (en lettres latines) et poser la question. L'assistant cherche, parmi les extensions publiées, celles dont le nom ou la description correspondent, puis répond (si la liste n'est pas encore chargée, il la charge à ce moment-là).

Pour une extension déjà installée, il indique aussi le nom des nœuds ajoutés et à quoi les relier. Pour une extension pas encore installée, une carte est jointe à la réponse et **{{ui:workflows.packs.install}}** permet de l'installer directement.

> L'explication des extensions se fonde sur la description publiée et sur les informations des nœuds. L'assistant devrait répondre « je ne sais pas » quand il ne sait pas, mais il peut aussi se tromper. Avant d'installer, vérifiez également la page du distributeur.

### Annuler

Une réponse qui a appliqué des réglages comporte un bouton **{{ui:agent.undo}}**. Un clic rétablit les réglages d'avant cette réponse.

En revanche, après la réouverture de l'application, les modifications antérieures ne peuvent plus être annulées (le bouton n'est plus actif).

### Historique des discussions

Les échanges avec l'assistant sont conservés sous forme de « discussions ». Un clic sur le nom de la discussion, en haut de la fenêtre, ouvre la liste **{{ui:agent.session.history}}**.

- Choisissez-en une dans la liste pour reprendre cette discussion.
- **{{ui:agent.session.rename}}** permet de lui donner un nom.
- **{{ui:agent.session.delete}}** permet de la supprimer.
- **{{ui:agent.session.new}}**, juste à côté, démarre une nouvelle discussion.

> Pendant qu'une réponse est attendue, on ne peut pas envoyer de nouveau message. Attendez que l'indication « {{ui:agent.thinking}} » disparaisse, ou annulez avec le bouton **{{ui:agent.stop}}** qui remplace le bouton d'envoi. Ce qui a été annulé n'est pas appliqué aux réglages.

En faisant glisser n'importe lequel des quatre bords ou des quatre coins de la fenêtre, on peut la redimensionner. Le coin inférieur droit porte un repère pour cela. Sa taille est mémorisée. Quand une réponse est accompagnée de son raisonnement, il apparaît sur une ligne au-dessus de la réponse. Un clic l'ouvre en entier (**{{ui:agent.thoughts.label}}**). C'est un court résumé de la façon dont l'IA a compris la demande et de ses raisons, et non la pensée interne de l'IA telle quelle.

## Paramètres

![L'écran des paramètres. Les rubriques Général, Comptes, Génération, Interface et Développeur sont alignées](shot:settings)

Dans **{{ui:app.nav.settingsMenu}}**, en bas à gauche, choisissez **{{ui:app.nav.settings}}** pour ouvrir l'écran des paramètres. Les changements s'appliquent tout de suite et sont conservés même après la fermeture de l'application.

> Cette image est un écran d'exemple qui tourne dans le navigateur. **{{ui:settings.uiZoom.label}}**, qui n'existe que dans la version de bureau, n'y figure pas.

### {{ui:settings.section.general}}

| Élément | Contenu |
|---|---|
| {{ui:settings.language.label}} | Choisissez parmi {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} et {{ui:settings.language.de}}. Les textes de l'écran changent immédiatement |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (par défaut) ou **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

Ces champs servent quand le site de distribution des modèles exige une connexion. Ce que vous saisissez est chiffré et enregistré sur cet ordinateur, et n'est pas affiché à l'écran.

| Élément | Contenu |
|---|---|
| {{ui:settings.civitaiKey.label}} | Sert à télécharger des modèles qui exigent une connexion |
| {{ui:settings.hfToken.label}} | Sert à télécharger des modèles qui demandent une autorisation d'accès |

Collez la valeur et cliquez sur **{{ui:settings.civitaiKey.save}}**. Vous pouvez ensuite utiliser **{{ui:settings.civitaiKey.change}}** ou **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}** : affiche en douceur l'image en cours de génération dans le cadre « {{ui:gallery.generating.title}} » de la galerie. Désactivé, elle apparaît en points grossiers.
- **{{ui:settings.lowMemory.label}}** : pour les ordinateurs dont le GPU a peu de mémoire. Activé, les modèles ne restent pas en mémoire GPU, ce qui permet de créer avec moins de mémoire, mais la création est plus lente. Le basculement redémarre le moteur. S'il y a des éléments en cours de création, le réglage s'applique au prochain démarrage du moteur. Il est inutilisable quand on est connecté à un moteur lancé ailleurs.

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}** (version de bureau uniquement) : la taille de l'ensemble de l'écran. On peut choisir de 50 % à 300 %. On peut aussi la changer avec `Ctrl` et `+` / `-`.
- **{{ui:settings.confirmOnDelete}}** : affiche une confirmation avant de supprimer une image. Si vous choisissez « {{ui:common.dontAskAgain}} » dans l'écran de confirmation, ce réglage passe aussi à désactivé.

### {{ui:share.backup.section}}

![La rubrique de sauvegarde de l'écran des paramètres. Un bouton pour créer une sauvegarde et un bouton pour restaurer à partir d'une sauvegarde](shot:settings-backup)

Les images que vous avez créées, ainsi que ce que vous avez réglé et enregistré dans l'application, peuvent être regroupés dans un seul fichier zip. Cela sert à déménager vers un autre ordinateur ou à se prémunir contre un incident.

- **{{ui:share.backup.createLabel}}** : ouvre une fenêtre pour choisir l'emplacement d'enregistrement. Le nom de fichier est d'emblée « novira-backup-date-heure.zip ». S'il y a beaucoup d'images, cela prend du temps, et l'avancement s'affiche dans cette rubrique.
- **{{ui:share.backup.restoreLabel}}** : choisissez le fichier zip d'une sauvegarde. Après vérification de son contenu, une fenêtre de confirmation s'affiche.

Voici ce que la sauvegarde contient et ce qu'elle ne contient pas.

| Inclus | Non inclus |
|---|---|
| Images, vidéos et sons de la galerie, avec leurs miniatures | Modèles |
| Planches, workflows, BD, historique de la file | Moteur d'images (ComfyUI) et extensions |
| Personnages, préréglages, listes de prompts, brouillons, discussions de l'assistant IA, réglages de l'écran | Clés d'API et jetons, réglages propres à l'ordinateur comme l'emplacement de ComfyUI |

![La fenêtre de confirmation de la restauration. Elle indique la date et l'heure de création de la sauvegarde, le nombre d'éléments qu'elle contient et un avertissement sur le remplacement](shot:restore-confirm)

La fenêtre de confirmation indique la date et l'heure de création de la sauvegarde ainsi que le nombre d'images, de planches et de workflows qu'elle contient. Un clic sur **{{ui:share.backup.confirm}}** ferme l'application, la relance, et les données actuelles sont remplacées par le contenu de la sauvegarde. En cas d'échec, les données d'origine sont rétablies et l'application vous en informe.

> Les données remplacées ne peuvent pas être récupérées. Si nécessaire, faites une sauvegarde de l'état actuel avant de restaurer. Les clés d'API et les jetons étant chiffrés pour cet ordinateur uniquement, saisissez-les de nouveau dans **{{ui:settings.section.accounts}}** après la restauration. Dans le navigateur, on obtient le téléchargement d'un fichier JSON sans les images, et la restauration n'est pas possible.

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}** : fait apparaître un bouton « {{ui:app.devlog.short}} » dans la navigation de gauche (voir « Journal développeur » plus bas).
- **{{ui:settings.clearIntermediates}}** : supprime les images qui n'apparaissent pas dans la galerie, comme les résultats intermédiaires de la toile. Le nombre d'éléments à supprimer s'affiche sur le bouton.
- **{{ui:settings.resetWebUi}}** : remet les réglages et l'état de l'interface à leurs valeurs initiales. Les images et les modèles ne sont pas supprimés. Après le clic, validez avec **{{ui:settings.resetConfirm}}** et rechargez avec **{{ui:settings.reload}}**.

L'écran des paramètres comporte aussi les interrupteurs « {{ui:settings.useCpuNoise}} », « {{ui:settings.enableInformationalPopovers}} », « {{ui:settings.enableImageDebugging}} » et « {{ui:settings.clearIntermediatesOnStartup}} ». Dans la version actuelle, ils ne changent ni la génération ni le comportement de l'écran.

Tout en bas de l'écran s'affiche la version de l'application.

## Raccourcis clavier

![La liste des raccourcis clavier. Les actions et leurs touches sont rangées par catégorie : application, toile, etc.](shot:hotkeys)

Choisissez **{{ui:app.nav.hotkeys}}** dans **{{ui:app.nav.settingsMenu}}**, en bas à gauche, ou appuyez sur `Shift+?` pour ouvrir la liste. Le champ de recherche du haut permet de chercher par nom d'action ou par touche.

Voici les plus utilisés. Pour la liste complète, consultez celle de l'écran.

### Application entière

| Touche | Action |
|---|---|
| `Ctrl+Enter` | Générer (ajouter à la file) |
| `Ctrl+Shift+Enter` | Ajouter en tête de file et générer |
| `Shift+X` | Annuler l'élément en cours de traitement |
| `Ctrl+Shift+X` | Vider toute la file |
| `Alt+A` | Aller au champ du prompt |
| `T` | Ouvrir ou fermer le panneau de gauche |
| `G` | Ouvrir ou fermer le panneau de droite |
| `F` | Ouvrir ou fermer les deux panneaux à la fois |
| `1` à `9`, `0` | Aller à l'onglet portant ce numéro |
| `Shift+?` | Ouvrir la liste des raccourcis |
| `Ctrl` + `+` / `-` | Agrandir ou réduire l'ensemble de l'écran |

### Toile

| Touche | Action |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Déplacer la vue |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Réduire ou agrandir le pinceau |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Basculer avec l'outil utilisé précédemment |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### Galerie et visionneuse

| Touche | Action |
|---|---|
| Touches fléchées | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (charge tout sauf la seed) |
| `P`, `S`, `A` | Charger le prompt, la seed, tout |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Workflow

| Touche | Action |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Supprimer les nœuds et connexions choisis |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Pendant que vous saisissez du texte, les touches d'un seul caractère comme `T` ou `G` ne fonctionnent pas.

## À propos de l'application

![L’écran d’informations sur l’application. Le logo, la version, la licence et la liste des logiciels open source utilisés](shot:about)

Lorsque vous choisissez **{{ui:app.nav.about}}** dans le **{{ui:app.nav.settingsMenu}}** en bas à gauche, le nom de l’application, sa version, sa licence et son copyright apparaissent en haut. En dessous se trouvent deux onglets.

- **{{ui:settings.about.license.title}}** : le texte complet de la licence de novira (Apache License 2.0). Le dossier d'installation contient le même fichier (`LICENSE`).
- **{{ui:settings.about.oss.title}}** : les logiciels open source utilisés par l'application. Chaque ligne indique un nom et une version. Appuyer sur **{{ui:settings.about.oss.showLicense}}** affiche le texte complet de sa licence sous la ligne (appuyez de nouveau pour le fermer). Appuyer sur **{{ui:settings.about.oss.homepage}}** ouvre sa page dans le navigateur. Le moteur de génération et les extensions ne sont pas fournis avec l'application : consultez leur licence complète sur leur page.

Les boutons au-dessus de la liste la limitent à **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** ou **{{ui:settings.about.oss.short.packs}}** (les extensions installées actuellement). Le champ de recherche trouve un logiciel par son nom. Les textes complets des licences des logiciels fournis sont aussi réunis dans `THIRD_PARTY_NOTICES.txt`, dans le dossier d'installation.

Les extensions (nœuds personnalisés de ComfyUI) et les modèles suivent, une fois installés, la licence de leur propre distributeur.

## Journal développeur

C'est un journal qui sert à chercher la cause quand quelque chose ne marche pas. En temps normal, vous n'avez pas besoin de l'utiliser.

Quand vous activez **{{ui:settings.showDevLog}}** dans **{{ui:settings.title}}**, un bouton « {{ui:app.devlog.short}} » apparaît dans la navigation de gauche. Un clic ouvre à droite le panneau **{{ui:app.devlog.title}}**.

On y trouve, avec l'heure, les enregistrements internes de l'application (journal du backend), les avertissements de l'écran et les erreurs non interceptées.

- La sélection du haut permet de filtrer sur **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** ou **{{ui:app.devlog.level.error}}**.
- Si vous saisissez un mot dans le champ de filtre, seules les lignes qui le contiennent s'affichent.
- **{{ui:app.devlog.copy}}** copie sous forme de texte les lignes affichées. Pour signaler un problème, vous pouvez le coller.
- **{{ui:app.devlog.clear}}** permet de l'effacer.

> Le journal est l'enregistrement de la période où l'application est ouverte. À la fermeture, le journal de l'écran disparaît. Pour savoir comment enquêter en détail, voir [Dépannage](10-troubleshooting.md).
