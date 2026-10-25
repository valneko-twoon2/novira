# Gérer et trouver des modèles

Pour créer une image, il faut un « modèle », la base à partir de laquelle l'image est dessinée. novira propose l'onglet **{{ui:app.tabs.models}}**, qui sert à organiser les modèles que vous avez déjà, et l'onglet **{{ui:app.tabs.browse}}**, qui sert à chercher des modèles sur Internet et à les télécharger.

Ce chapitre explique comment utiliser ces deux onglets, les types de modèles et comment lire les licences.

## Types de modèles

Un modèle a une « {{ui:models.sort.base}} » (de quelle famille il vient) et un « {{ui:models.sort.type}} » (quel rôle il joue).

### Base (famille)

Les modèles sont construits par famille, et des familles différentes ne se combinent pas. Par exemple, une LoRA pour SD1.5 ne peut pas être utilisée avec un modèle SDXL.

| Affichage | Contenu |
|---|---|
| SD1.X | Stable Diffusion 1.5 et similaires. Léger à exécuter |
| SD2.X | Famille Stable Diffusion 2 |
| SDXL | Famille Stable Diffusion XL. La plupart des modèles orientés illustration (Illustrious, NoobAI, Pony, etc.) en font partie |
| SD3.X | Famille Stable Diffusion 3 |
| FLUX | Famille FLUX |
| Any | Ce qui ne dépend d'aucune famille (agrandisseurs, etc.) |

> Dans la version de bureau actuelle, seuls les modèles SD1.X, SD2.X et SDXL peuvent servir à générer des images. FLUX et SD3.X apparaissent dans la liste, mais lancer une génération avec eux produit une erreur signifiant « pas encore pris en charge ».

Si la base du modèle et celle d'une LoRA ne correspondent pas, le bouton de création de l'écran **{{ui:app.tabs.generate}}** est désactivé et la raison s'affiche.

### Types

| Type | Rôle |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | Le modèle qui dessine l'image |
| {{ui:models.type.lora}} | Petit modèle ajouté au modèle principal pour apporter un style ou un personnage |
| {{ui:models.type.vae}} | Composant utilisé pour la finition des couleurs et des détails |
| {{ui:models.type.controlnet}} | Impose la forme de l'image : pose, dessin au trait, etc. |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Reprend l'ambiance d'une image de référence dans la génération |
| {{ui:models.rail.upscale}} | Agrandit une image |
| {{ui:models.rail.encoders}} | Composants qui comprennent le texte |
| {{ui:models.rail.diffusion}} | Modèles comme Wan, utilisés pour la vidéo ou des flux dédiés |

Les modèles de vidéo, de musique, de voix et de logo n'apparaissent pas dans cette liste. Ils se téléchargent depuis leurs propres écrans ([Vidéo, musique, voix, logo et texte](07-media.md)).

## Onglet Modèles

![L'onglet Modèles. Les catégories sont à gauche et les cartes de modèles au centre](shot:models)

L'onglet **{{ui:app.tabs.models}}** est la liste des modèles installés.

### Retrouver un modèle

Le panneau **{{ui:models.rail.title}}** à gauche permet de filtrer par type. Le nombre d'éléments s'affiche à droite.

- **{{ui:models.rail.all}}** : tout
- **{{ui:models.rail.favorites}}** : ceux auxquels vous avez mis une étoile
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

La barre du haut permet de filtrer par nom (**{{ui:models.searchPlaceholder}}**), de filtrer par base, de trier avec **{{ui:models.sort.label}}** ({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), de basculer entre **{{ui:models.view.grid}}** et **{{ui:models.view.list}}**, et de régler la taille des miniatures.

En bas à gauche de chaque carte figurent des étiquettes indiquant la base (SDXL, etc.) et le format. Quand vous survolez une carte avec la souris, l'étoile (favori) et un menu apparaissent.

En bas à droite de l'écran s'affichent le nombre de modèles et leur taille totale.

### Ajouter des modèles

Deux boutons se trouvent en haut à droite.

- **{{ui:models.find}}** : passe à l'onglet **{{ui:app.tabs.browse}}** (voir la section plus bas).
- **{{ui:models.import}}** : ajoute un fichier que vous avez sur l'ordinateur ou un modèle dont vous connaissez l'adresse.

Un clic sur **{{ui:models.import}}** ouvre l'écran **{{ui:models.import.title}}**, où l'on choisit parmi 4 méthodes.

| Onglet | Utilisation |
|---|---|
| {{ui:models.install.tab.source}} | Saisissez l'adresse du modèle ou l'emplacement d'un fichier sur l'ordinateur, puis cliquez sur **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | Saisissez l'emplacement d'un dossier et cliquez sur **{{ui:models.install.scan}}** : les modèles qu'il contient sont listés. **{{ui:models.install.installAll}}** permet de tous les installer d'un coup |
| {{ui:models.install.tab.starter}} | L'application sélectionne et liste des modèles pratiques à installer en premier. Les modèles dont ils dépendent (VAE, etc.) sont installés avec |
| {{ui:models.install.tab.huggingface}} | Un champ pour chercher par nom de dépôt Hugging Face (`auteur/nom`) |

Voici ce que l'on peut saisir dans le champ **{{ui:models.install.tab.source}}**.

- L'adresse d'une page de modèle Civitai
- Une adresse directe vers un fichier de modèle (commençant par `https://`)
- L'emplacement d'un fichier sur l'ordinateur (de la forme `C:\models\model.safetensors`)
- Un fichier Hugging Face (de la forme `auteur/nom::nom du fichier`)

Si vous indiquez un fichier de l'ordinateur, il est intégré au dossier des modèles de l'application (sur le même disque, l'espace utilisé n'augmente presque pas ; sur un autre disque, le fichier est copié).

> Après avoir saisi un dépôt (`auteur/nom`) puis appuyé sur **{{ui:models.install.hfLookup}}**, l'onglet **{{ui:models.install.tab.huggingface}}** affiche les fichiers de modèle isolés (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) du dépôt. Les fichiers des dossiers d'un pipeline diffusers, comme `unet` et `vae`, ne sont pas affichés. Si un jeton Hugging Face est enregistré, la liste est récupérée avec lui.

Les installations se déroulent l'une après l'autre. Pour suivre leur avancement, cliquez sur **{{ui:models.dock.queue}}** en bas à gauche de l'écran (« N en cours d'installation » pendant l'activité) : le panneau **{{ui:models.queue.title}}** s'ouvre. Vous pouvez y utiliser **{{ui:models.queue.cancel}}** élément par élément, et nettoyer ceux qui sont terminés avec **{{ui:models.queue.prune}}**.

Un fichier en cours de téléchargement n'entre dans le dossier des modèles qu'une fois complet. Même si vous interrompez en cours de route, aucun fichier incomplet ne reste.

### Détails d'un modèle

![Quand on choisit un modèle, les détails s'affichent à droite : taille, emplacement, licence, source, etc.](shot:models-detail)

Un clic sur une carte ouvre les détails à droite. Pour les fermer, cliquez sur **{{ui:models.detail.close}}** en haut à droite.

Les détails affichent le nom, les étiquettes de base et de type, la description, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (copiable), **{{ui:models.details.license}}** et **{{ui:models.details.source}}**.

Les boutons du haut permettent ceci.

- **{{ui:models.detail.openSource}}** : ouvre dans le navigateur la page du site de distribution (seulement pour les modèles qui ont une adresse).
- **{{ui:common.edit}}** : corrige le nom, la description, la base et le type. À utiliser quand la base ou le type n'ont pas été reconnus correctement.
- **{{ui:common.delete}}** : supprime le modèle (voir plus bas).

### Mots déclencheurs

Certaines LoRA ont des mots (mots déclencheurs) qui font effet quand on les met dans le prompt. Si vous les enregistrez dans **{{ui:models.triggers.title}}**, ils apparaissent sous forme de boutons quand vous choisissez cette LoRA dans l'écran **{{ui:app.tabs.generate}}**. Un clic les ajoute au prompt.

Saisissez un mot dans le champ et cliquez sur **{{ui:common.add}}** pour l'enregistrer. La croix permet de le retirer. Les modifications sont enregistrées immédiatement. Pour un modèle installé depuis Civitai, les mots indiqués par le distributeur sont parfois déjà présents.

### Réglages par défaut

Les modèles principaux ont **{{ui:models.defaults.title}}**. Ce sont les valeurs qui se remplissent automatiquement quand vous choisissez ce modèle dans l'écran de génération.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Largeur et hauteur

Vous pouvez aussi enregistrer **{{ui:models.defaults.vae}}** et **{{ui:models.defaults.vaePrecision}}**. Seuls les éléments dont l'interrupteur est activé sont enregistrés. Cliquez sur **{{ui:common.save}}** pour valider.

Les valeurs recommandées diffèrent d'un modèle à l'autre : si vous les réglez une fois pour les modèles que vous utilisez souvent, vous n'aurez pas à les corriger à chaque fois.

### Suppression

Un clic sur **{{ui:common.delete}}** affiche une confirmation. **{{ui:models.deleteWarning}}**

Cependant, les modèles installés par novira (ceux qui se trouvent dans le dossier de données de l'application) sont supprimés avec leur fichier, alors que les modèles situés dans un dossier que vous avez préparé sont seulement retirés de la liste : le fichier reste.

## Étiquettes de licence

Les modèles ont des conditions d'utilisation (licence) fixées par leur distributeur. novira en montre l'essentiel sous forme d'étiquettes.

| Étiquette | Signification |
|---|---|
| {{ui:browse.commercial.allowed}} | La vente des images générées et l'usage dans un service de génération sont autorisés |
| {{ui:browse.commercial.limited}} | L'usage commercial est soumis à des conditions (vente des images générées uniquement, etc.) |
| {{ui:browse.commercial.denied}} | L'usage commercial n'est pas autorisé. Usage personnel uniquement |

Un clic sur l'étiquette affiche la liste des **{{ui:browse.permission.title}}**. Elle indique, par exemple pour « {{ui:browse.permission.sellImages}} », « {{ui:browse.permission.sellModel}} » ou « {{ui:browse.permission.shareMerges}} », si c'est permis, interdit ou non précisé.

L'étiquette est déterminée à partir des autorisations d'usage définies par l'auteur sur Civitai, et à partir de l'indication de licence sur Hugging Face. Il s'agit d'une indication fondée sur ce qu'affichent les sites : vérifiez toujours le texte de la licence du distributeur. **{{ui:browse.permission.disclaimer}}**

Quand la licence d'un modèle installé est inconnue, **{{ui:models.details.licenseUnknown}}** s'affiche.

> Certains modèles ont une licence non commerciale. Par exemple, **{{ui:video.model.fast}}** pour la vidéo est sous licence non commerciale. Si vous utilisez des images ou des vidéos créées pour le travail ou la vente, vérifiez toujours la licence des modèles utilisés.

## Onglet Explorer

![L'onglet Explorer. En haut : le site, le type, la recherche et les filtres ; en dessous, les cartes de modèles](shot:browse)

L'onglet **{{ui:app.tabs.browse}}** est l'écran où l'on cherche des modèles sur Internet et où on les télécharge directement.

### Où chercher

Le sélecteur en haut à gauche permet de choisir où chercher.

- **{{ui:browse.source.civitai}}** : un site où se concentrent beaucoup d'illustrations et de LoRA.
- **{{ui:browse.source.huggingface}}** : un site où l'on trouve surtout des modèles d'organismes de recherche et d'entreprises. On n'y trouve pas les modèles par leur nom : collez l'URL de la page du modèle (la page d'un dossier ou d'un fichier convient) ou `owner/name` dans la grande zone au centre de l'écran, puis cliquez sur **{{ui:models.install.hfLookup}}**. Cochez les fichiers affichés, puis cliquez sur le bouton d'installation en haut à droite pour lancer le téléchargement. Si vous avez collé l'URL d'un dossier, seuls les fichiers de ce dossier s'affichent d'abord.

À côté, choisissez **{{ui:browse.kind.label}}** : **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** ou **{{ui:browse.kind.all}}**.

### Filtrer

Dans le champ de recherche, saisissez un nom de modèle, un auteur ou un tag. Après un court instant, les résultats sont remplacés.

Les menus de droite permettent de filtrer.

| Élément | Contenu |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}}, etc. |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | Toute la période, 1 an, 1 mois, 1 semaine, 24 heures (uniquement pour Civitai) |
| {{ui:browse.nsfw.label}} | Désactivé par défaut. Activé, il fait aussi apparaître les modèles pour adultes |

Quand vous faites défiler jusqu'en bas, la suite se charge. **{{ui:browse.status.loadMore}}** permet aussi de la charger. Si la récupération échoue, cliquez sur **{{ui:browse.status.retry}}**.

### Lire les cartes et télécharger

Une carte affiche une image d'exemple, le nom du modèle, l'auteur, le nombre de téléchargements, le nombre de mentions « j'aime » et l'étiquette de licence. Pour les LoRA, les mots déclencheurs sont aussi affichés.

- **{{ui:browse.card.download}}** : télécharge le fichier principal de ce modèle.
- L'icône de droite (**{{ui:browse.card.openCivitai}}**) : ouvre dans le navigateur le site du distributeur.

Un clic sur une carte ouvre les détails à droite. On y voit les versions, la liste des fichiers (taille et format), les mots déclencheurs, les tags, la description et la licence. Choisissez une version, puis cliquez sur **{{ui:browse.card.download}}** pour le fichier voulu. Un clic sur un mot déclencheur le copie. Fermez en cliquant à l'extérieur ou avec `Esc`.

Quand un téléchargement démarre, un petit cadre **{{ui:browse.dock.title}}** apparaît en bas à gauche de l'écran et montre l'avancement. **{{ui:browse.dock.cancel}}** permet d'interrompre, et **{{ui:browse.dock.clear}}** efface ceux qui sont terminés. Une carte dont le téléchargement est fini passe à **{{ui:browse.card.installed}}** et le modèle s'ajoute aussi à la liste de l'onglet **{{ui:app.tabs.models}}**.

> Pour télécharger un modèle qui exige une connexion, enregistrez votre clé d'API Civitai dans **{{ui:settings.title}}**. Pour utiliser sur Hugging Face un modèle qui demande une autorisation d'accès, enregistrez votre jeton Hugging Face. Les deux sont chiffrés et enregistrés sur cet ordinateur, et ne sont pas affichés à l'écran. Pour plus de détails, voir [L'assistant IA et les paramètres](09-assistant-settings.md).

Pour passer à la génération d'images, voir [Générer](02-generate.md).
