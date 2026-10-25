# Premiers pas

## Ce que novira permet de faire

novira est une application de bureau Windows qui crée des images, des vidéos, de la musique et de la voix.
Vous écrivez un prompt (une description de ce que vous voulez créer) et vous appuyez sur le bouton **{{ui:params.invoke.invoke}}**. L'image est dessinée sur votre propre ordinateur et apparaît dans la galerie à droite.
La disposition et les commandes s'inspirent de l'outil de génération d'images InvokeAI. Si vous l'avez déjà utilisé, vous serez tout de suite à l'aise.

En gros, vous pouvez faire ceci :

- Créer des images à partir de texte (c'est le sujet principal de ce guide)
- Retravailler une image existante, repeindre seulement une partie de celle-ci ou l'agrandir
- Créer des vidéos, de la musique, de la voix, des logos et des images contenant du texte
- Demander de l'aide à l'assistant IA pour les réglages et les prompts

> Le dessin se fait sur votre propre ordinateur. Les fonctions qui utilisent Internet, comme la recherche et le téléchargement de modèles ou l'assistant IA, ne se connectent que lorsque vous choisissez de les utiliser.

## Comment les images sont créées

novira se compose de quatre éléments.

| Élément | Rôle |
|---|---|
| novira (cette application) | Les écrans, la galerie, la file d'attente et la gestion des modèles |
| Moteur de génération d'images (ComfyUI) | La partie qui dessine réellement. novira l'installe et le démarre lui-même |
| Modèles | Les données d'entraînement utilisées pour dessiner. Chacun est un fichier de plusieurs Go, que l'on obtient séparément du moteur |
| Dossier de données | L'endroit où sont conservés vos images, vos modèles, le moteur lui-même, etc. |

Vous n'avez pas besoin d'installer le moteur vous-même. novira l'installe automatiquement au premier démarrage.
Le moteur et ses composants (comme Python) sont placés uniquement dans le dossier de données de novira. Rien n'est modifié ailleurs sur votre ordinateur, et le Python que vous possédez déjà n'est pas touché.

Le dossier de données s'appelle `novira-data` et se trouve dans le dossier de l'application. Utilisez ce dossier pour déplacer ou sauvegarder vos images et vos modèles.

> La génération d'images utilise le GPU (la carte graphique). Par défaut, novira installe le moteur pour les GPU NVIDIA.

Un modèle détermine « dans quel style graphique dessiner ». Il en faut un pour commencer. La façon d'en ajouter un est expliquée dans [Préparer les modèles](08-models.md).

## Au premier démarrage

À l'ouverture de l'application, l'écran d'accueil apparaît d'abord (le logo et des bulles d'images qui flottent lentement).
En dessous, une carte indique ce que fait l'application en ce moment.

Au premier démarrage, l'installation du moteur de génération d'images commence. La carte affiche trois étapes dans l'ordre.

1. **{{ui:splash.step.downloading}}** : ComfyUI et Python sont téléchargés. La taille, la vitesse et une estimation du temps restant sont également affichées.
2. **{{ui:splash.step.extracting}}** : Les fichiers téléchargés sont décompressés.
3. **{{ui:splash.step.starting}}** : Le moteur est démarré et novira attend qu'il se connecte.

> {{ui:engine.firstRunNote}}

L'installation n'a lieu qu'une seule fois. À partir du deuxième démarrage, l'écran d'accueil disparaît en quelques secondes et le moteur démarre aussitôt.

Lorsque le moteur est prêt, l'écran d'accueil disparaît et l'écran principal s'ouvre.
Pendant le chargement des données, vous verrez « {{ui:splash.wait.heading.loading}} », et pendant le chargement du moteur et des informations nécessaires à l'édition, vous verrez « {{ui:splash.wait.heading.preparing}} ».

### Messages en haut de l'écran

Si le moteur redémarre ou est réinstallé après l'ouverture de l'application, une bannière apparaît en haut au centre de l'écran pour vous dire ce qui se passe.

- « {{ui:engine.title.downloading}} », « {{ui:engine.title.extracting}} » et « {{ui:engine.title.starting}} » : Un travail est en cours. La génération ne démarrera pas avant sa fin. Une fois terminé, la bannière disparaît toute seule.
- « {{ui:engine.title.error}} » : Le moteur n'a pas pu être préparé. La raison est affichée sur la ligne sous la bannière.

Si une erreur s'affiche sur l'écran d'accueil, un bouton **{{ui:splash.open}}** apparaît sous la raison. Un clic dessus ouvre l'application sans le moteur. Vous pouvez consulter vos modèles et modifier les paramètres, mais vous ne pouvez pas créer d'images.
Si l'erreur persiste, consultez [Dépannage](10-troubleshooting.md).

## Découvrir l'écran

![L'onglet Générer en entier : le panneau des paramètres à gauche, l'écran de démarrage au centre, la planche et la galerie à droite](shot:generate)

De gauche à droite, l'écran est organisé comme suit.

- La fine bande verticale à l'extrême gauche : la **navigation latérale**. Elle permet de changer d'onglet.
- Le panneau de gauche : le **panneau des paramètres**. Il contient les réglages pour créer une image, comme le prompt et le modèle.
- Le centre : la **vue principale**. C'est la zone de travail qui change selon l'onglet, comme l'écran de démarrage, la visionneuse d'images et la toile.
- Le panneau de droite : la **galerie**. Elle affiche les planches (un peu comme des dossiers) et les miniatures des images que vous avez créées.

### Navigation latérale (onglets)

| Onglet | À quoi il sert | Touche numérique |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Créer des images. Les icônes du haut permettent aussi de passer à la vidéo, à la musique, à la voix, aux logos, au texte et à la BD | `1` |
| **{{ui:app.tabs.canvas}}** | Placer des images, dessiner dessus ou repeindre seulement une partie | `2` |
| **{{ui:app.tabs.comic}}** | Créer des pages de BD : mise en page des cases, une image par case, bulles et récitatifs. S'ouvre aussi avec l'icône la plus à droite en haut de l'onglet {{ui:app.tabs.generate}} | `3` |
| **{{ui:app.tabs.upscaling}}** | Agrandir une image tout en ajoutant des détails fins | `4` |
| **{{ui:app.tabs.workflows}}** | Relier des éléments (nœuds) pour construire votre propre procédure de génération | `5` |
| **{{ui:app.tabs.models}}** | Lister, installer et supprimer les modèles que vous possédez | `6` |
| **{{ui:app.tabs.browse}}** | Rechercher des modèles sur Internet et les importer | `7` |
| **{{ui:app.tabs.queue}}** | Voir et arrêter la file d'attente de génération. Un badge indique combien d'éléments attendent | `8` |
| **{{ui:app.nav.extensions}}** | Rechercher des extensions ComfyUI, puis les installer ou les retirer | `0` |

Vers le bas de la navigation latérale, on trouve aussi ce qui suit.

- **{{ui:app.tabs.short.agent}}** : Ouvre la fenêtre de l'assistant IA par-dessus l'écran actuel.
- **{{ui:app.nav.settings}}** : Son menu permet d'ouvrir {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} et {{ui:app.nav.about}}.
- Le logo « n » tout en haut : Ouvre {{ui:app.nav.about}}.

L'utilisation de chacun est expliquée dans les chapitres suivants.

- {{ui:app.tabs.generate}}, {{ui:app.tabs.queue}} : [Créer des images](02-generate.md)
- La galerie et la visionneuse : [La galerie et la visionneuse](03-gallery.md)
- {{ui:app.tabs.canvas}} : [Dessiner davantage sur la toile](05-canvas.md)
- {{ui:app.tabs.comic}} : [Dessiner une BD](12-comic.md)
- {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}} : [Mise à l'échelle et workflows](06-upscaling-workflows.md)
- Vidéo, musique, voix, etc. : [Vidéo, musique, voix, logo et texte](07-media.md)
- {{ui:app.tabs.models}}, {{ui:app.tabs.browse}} : [Préparer les modèles](08-models.md)
- {{ui:app.tabs.short.agent}}, {{ui:app.nav.settings}} : [L'assistant IA et les paramètres](09-assistant-settings.md)

### Les onglets du centre (Démarrer, Visionneuse, Brouillons)

En haut du centre de l'onglet {{ui:app.tabs.generate}}, il y a trois petits onglets.

- **{{ui:app.views.launchpad}}** : Un guide pour bien commencer. Il affiche des cartes comme « {{ui:params.launchpad.generate.textTitle}} » et « {{ui:params.launchpad.generate.refTitle}} », ainsi que des indications de raccourcis.
- **{{ui:app.views.viewer}}** : L'endroit pour regarder une image en grand. Lorsque vous choisissez une image dans la galerie, elle s'affiche ici.
- **{{ui:app.views.drafts}}** : Un écran qui aligne de nombreux candidats à moitié dessinés, créés avec les mêmes réglages mais des seeds différents, afin de ne terminer que ceux que vous aimez.

Les autres onglets ont eux aussi leurs propres petits onglets (par exemple, l'onglet {{ui:app.tabs.canvas}} a {{ui:app.views.canvas}}).

### Masquer les panneaux

Pour voir une image plus grande, vous pouvez masquer les panneaux de gauche et de droite.

- Les petits boutons en forme de flèche au bord supérieur du centre ouvrent et ferment les panneaux de gauche et de droite.
- Au clavier, `T` bascule le panneau de gauche, `G` celui de droite et `F` les deux à la fois.
- Faites glisser la limite entre les panneaux pour modifier leur largeur. Les largeurs sont mémorisées tant que l'application est ouverte ; au redémarrage, les panneaux reprennent leur largeur d'origine.

> Les raccourcis à une seule lettre comme `T`, `G` et `F` ne fonctionnent pas pendant que vous saisissez du texte dans un champ. Quittez d'abord le champ, puis appuyez sur la touche.

## Créer votre première image (3 étapes)

Voici le déroulement pour créer une image pour la première fois. Il suppose qu'un modèle est déjà installé.

1. **Choisir un modèle.** Sélectionnez le modèle que vous voulez utiliser dans le champ du modèle, en haut du panneau de gauche. Si le champ indique « {{ui:params.model.noModels}} », terminez d'abord [Préparer les modèles](08-models.md).
2. **Écrire un prompt.** Dans le champ « {{ui:params.prompt.positive}} », décrivez avec des mots l'image que vous voulez. Par exemple, reliez des mots ou de courtes expressions par des virgules, comme `a lighthouse on a cliff at dusk, calm sea, warm light`. Beaucoup de modèles répondent mieux à l'anglais.
3. **Appuyer sur {{ui:params.invoke.invoke}}.** Cliquez sur le bouton ou appuyez sur `Ctrl+Enter`. Un affichage « {{ui:gallery.generating.title}} » apparaît au-dessus de la galerie à droite, et vous voyez l'image en cours de création et son avancement. Quand c'est terminé, l'image apparaît dans la visionneuse au centre et s'ajoute aussi à la galerie.

Si le bouton est grisé et ne peut pas être pressé, la raison est affichée sur la ligne en dessous (par exemple, « {{ui:params.readiness.noModel}} »). Corrigez la cause et le bouton redevient utilisable.

L'image terminée est enregistrée automatiquement dans la galerie. Si elle ne vous plaît pas, modifiez un peu le prompt ou les réglages et appuyez de nouveau sur le bouton.
Pour plus de détails, passez à [Créer des images](02-generate.md).
