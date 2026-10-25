# Retoucher et réutiliser les images

Ce chapitre rassemble les fonctions utiles lorsqu'on se dit « j'aimerais retoucher un peu cette image terminée », « j'en voudrais encore quelques-unes dans la même ambiance » ou « je voudrais aussi utiliser ce personnage dans une autre scène ».

La plupart des fonctions s'appellent depuis un bouton de la barre d'outils au-dessus de la visionneuse (l'écran qui affiche une image en grand) ou depuis le menu du clic droit sur une image de la galerie. Un survol de la souris sur un bouton de la barre d'outils en affiche le nom. Pour les bases de la visionneuse et de la galerie, voir [La galerie](03-gallery.md).

## Quelle fonction utiliser

| Objectif | Fonction à utiliser | Autre prérequis |
|---|---|---|
| Créer quelques images de plus avec les mêmes paramètres, ou en refaire une avec de légères modifications | **{{ui:gallery.derive.menu}}** | Le modèle utilisé pour l'image d'origine est installé |
| Supprimer l'arrière-plan pour ne garder que la personne ou l'objet | **{{ui:cutout.menu}}** | L'extension ComfyUI-RMBG |
| Supprimer les marges transparentes | **{{ui:gallery.menu.trim}}** (clic droit uniquement) | Aucun |
| Sélectionner une partie d'une image pour la découper, l'effacer ou la redessiner | **{{ui:gallery.menu.segment}}** | Une extension comme ComfyUI-segment-anything-2 |
| Nettoyer des visages petits et déformés | **{{ui:facefix.menu}}** | Les extensions ComfyUI-Impact-Pack et ComfyUI-Impact-Subpack |
| Obtenir un prompt à partir d'une image | **{{ui:caption.menu}}** | L'extension ComfyUI-Florence2 |
| Enregistrer un personnage et l'utiliser dans d'autres images | **{{ui:character.menu}}** | L'extension pour les images de référence (IP-Adapter) |
| Aligner dans une grille des images aux paramètres différents | **{{ui:xyplot.menu}}** | Aucun |
| Choisir parmi des candidats à moitié dessinés | L'onglet **{{ui:app.views.drafts}}** | Aucun |
| Appliquer le même traitement à de nombreuses images | **{{ui:gallery.menu.batch}}** (en sélectionner plusieurs, puis clic droit) | Selon le traitement |

## Quand une extension est nécessaire

La suppression de l'arrière-plan, la sélection d'une zone, la correction des visages, etc. fonctionnent grâce à des « extensions » ajoutées au moteur qui crée les images (ComfyUI). Si une extension n'est pas installée, la boîte de dialogue indique « … nécessite l'extension XXX. » et des boutons d'installation s'affichent.

1. Appuyer sur **{{ui:cutout.install}}**. Le nécessaire est téléchargé et installé automatiquement.
2. Une fois l'installation terminée, le bouton devient **{{ui:cutout.restart}}**. Un appui redémarre ComfyUI.
3. Après le redémarrage, la même boîte de dialogue est utilisable telle quelle.

À la première utilisation, le téléchargement des modèles utilisés par l'extension démarre aussi, ce qui prend du temps. Une connexion à Internet est nécessaire.

> Certaines extensions demandent du temps et de l'espace disque à l'installation. ComfyUI-Impact-Pack nécessite Git pour s'installer. Sur un ordinateur sans Git, l'installation échoue. Si un message apparaît, le lire avant d'agir.

Les extensions peuvent aussi s'installer depuis l'onglet « {{ui:workflows.panel.packs}} » de [Workflows](06-upscaling-workflows.md). En cas de problème, consulter aussi [Dépannage](10-troubleshooting.md).

## Recréer avec les mêmes paramètres (dériver)

![Le menu « Dériver davantage » ouvert dans la barre d'outils de la visionneuse](shot:derive-menu)

Ouvrir une image appréciée dans la visionneuse et appuyer sur le bouton **{{ui:gallery.derive.menu}}** (l'icône de branches) de la barre d'outils. Dans la galerie, faire un clic droit sur l'image et choisir **{{ui:gallery.derive.menu}}**.

Trois types sont proposés.

| Élément | Ce qu'il fait |
|---|---|
| « Mêmes réglages, nouvelle seed » (1 ou 4 images) | Dessine en ne changeant que la seed, en gardant le prompt, le modèle, la taille, etc. La composition change, mais l'ambiance reste la même. |
| « Refaire avec de petites variations » (1 ou 4 images) | Prend l'image d'origine comme base et la redessine légèrement (avec une force de 0,45). La composition et les couleurs restent, seuls les détails changent. |
| **{{ui:gallery.derive.custom}}** | Il faut décider soi-même de l'ampleur du changement (voir la section suivante). |

Une fois le choix fait, les nouvelles images entrent dans la file et s'alignent dans la même planche que l'originale. **Les paramètres de l'onglet Générer ne sont pas modifiés.** Le prompt en cours de saisie reste lui aussi tel quel.

> Pour ramener les paramètres à l'écran, les modifier soi-même, puis créer une image, utiliser **{{ui:gallery.menu.remix}}**. La dérivation sert à « créer avec les paramètres d'origine en un seul bouton ».

### Choisir l'ampleur du changement et recréer

![La boîte de dialogue pour décider de l'ampleur du changement](shot:derive)

Le choix de **{{ui:gallery.derive.custom}}** ouvre une boîte de dialogue.

1. Déplacer le curseur **{{ui:gallery.derive.dialog.strength}}**. Plus il est à gauche ({{ui:gallery.derive.dialog.close}}), plus la composition et les couleurs d'origine restent ; plus il est à droite ({{ui:gallery.derive.dialog.free}}), plus l'image se rapproche d'une autre image.
2. Choisir le **{{ui:gallery.derive.dialog.count}}** parmi 1, 2, 4 et 8.
3. Appuyer sur **{{ui:gallery.derive.dialog.create}}**.

À titre indicatif, autour de 0,25 on obtient une image presque identique à l'originale, et autour de 0,75 une image où le personnage reste mais où la composition change beaucoup. Cela varie d'une image à l'autre, il faut donc en essayer plusieurs. La valeur du curseur n'est utilisée que pour cette fois.

### Ce qui est repris et ce qui ne l'est pas

- Repris : les paramètres utilisés lors de la création de l'image, comme le prompt, le prompt négatif, le modèle, les LoRA, la taille, les étapes, l'échelle CFG et le planificateur.
- Les images de référence et les calques de contrôle sont eux aussi mémorisés avec l'image, et sont donc utilisés tels quels. Toutefois, si une telle image a été supprimée de la galerie, la création est impossible. La raison apparaît dans une notification.
- Non repris : les masques, le guidage par régions et les paramètres de brouillon. Si une image créée avant l'existence de cette fonction utilisait des images de référence ou similaires, elles n'ont pas été mémorisées et ne peuvent donc pas être reprises. Lorsque quelque chose n'a pas pu être repris, une notification le signale.

Dans les cas suivants, le bouton est désactivé, ou une notification apparaît et la création est impossible.

- Lorsque l'image n'a pas été créée à partir d'un texte (y compris image vers image, inpainting et outpainting). Les images agrandies, les vidéos, les sons, etc. ne sont pas concernés.
- Lorsque le modèle utilisé pour l'image d'origine n'est pas installé. Une notification avec le nom du modèle apparaît.

## Supprimer l'arrière-plan

![La boîte de dialogue pour supprimer l'arrière-plan](shot:cutout)

Elle reconnaît automatiquement ce qui figure dans l'image et crée une image sans arrière-plan. Il n'est pas nécessaire de désigner quoi que ce soit par des clics.

1. Ouvrir l'image dans la visionneuse et appuyer sur **{{ui:cutout.menu}}**, l'icône en forme de ciseaux (elle figure aussi dans le menu du clic droit).
2. Si nécessaire, modifier les paramètres.
   - **{{ui:cutout.model}}** : en général, il peut rester tel quel.
   - **{{ui:cutout.sensitivity}}** : plus la valeur est basse, plus les zones aux limites floues sont conservées.
   - **{{ui:cutout.edge}}** : une valeur positive élargit le contour et une valeur négative le rogne.
   - **{{ui:cutout.background}}** : choisir **{{ui:cutout.background.alpha}}** ou **{{ui:cutout.background.white}}**.
3. Appuyer sur **{{ui:cutout.run}}**.

L'image terminée est enregistrée comme nouvelle image dans la même planche que l'originale. **L'image d'origine reste telle quelle.** Si le résultat ne convient pas, modifier les paramètres et appuyer sur **{{ui:cutout.again}}**. **{{ui:cutout.open}}** l'affiche dans la visionneuse.

Un arrière-plan blanc est un bon choix si l'on veut ensuite utiliser l'image comme image de référence d'un [personnage](#enregistrer-et-utiliser-un-personnage). La couleur de l'arrière-plan a moins tendance à se transmettre aux nouvelles images créées.

## Supprimer les marges transparentes

Une image à l'arrière-plan transparent conserve des marges transparentes autour d'elle. Avec **{{ui:gallery.menu.trim}}**, on enregistre une nouvelle image transparente découpée au plus près de la partie utile. C'est pratique pour un autocollant ou un matériau.

- Faire un clic droit sur une image de la galerie et le choisir. Juste après la suppression d'un arrière-plan, la même chose est possible depuis **{{ui:cutout.trim}}** dans la boîte de dialogue (il n'apparaît que si l'arrière-plan a été rendu transparent).
- Une ombre si légère qu'elle est presque invisible est supprimée comme marge.
- Pour une image dont la zone transparente n'atteint pas le bord, « Aucune marge à rogner. » apparaît et rien n'est enregistré. Une image entièrement transparente ne peut pas non plus être rognée.

## Sélectionner une zone et la corriger

![La boîte de dialogue pour désigner par des clics ce qu'il faut sélectionner dans l'image](shot:segment)

On sélectionne par un clic l'élément voulu dans l'image. On peut ensuite découper, effacer ou redessiner la partie sélectionnée.

1. Ouvrir l'image dans la visionneuse et appuyer sur **{{ui:gallery.menu.segment}}**.
2. Uniquement la première fois, l'extension ComfyUI-segment-anything-2 est nécessaire. L'installer en suivant les indications à l'écran ([Quand une extension est nécessaire](#quand-une-extension-est-nécessaire)).
3. Cliquer sur l'élément à sélectionner. S'il manque quelque chose, cliquer à un autre endroit pour l'ajouter. Pour retirer une zone en trop, basculer le bouton sur **{{ui:segment.mode.exclude}}** et cliquer, ou faire un clic droit (ou cliquer en maintenant `Maj`). Un nouveau clic sur un point déjà posé annule ce point. **{{ui:segment.clear}}** permet de tout recommencer depuis le début.
4. Appuyer sur **{{ui:segment.run}}**. La zone sélectionnée s'affiche en bleu.
5. Si la zone bleue est correcte, choisir l'opération suivante. Pour sélectionner plutôt « le reste », activer **{{ui:segment.invert}}**.

| Bouton | Ce qu'il fait | Prérequis |
|---|---|---|
| **{{ui:segment.cutout}}** | Découpe uniquement la partie sélectionnée et l'enregistre comme image transparente. | Aucun |
| **{{ui:segment.mosaic}}** | Transforme la partie sélectionnée en gros blocs (mosaïque) et enregistre l'image. La taille des blocs se règle avec le nombre à côté du bouton. | Aucun |
| **{{ui:segment.erase}}** | Efface la partie sélectionnée en la fondant dans l'image environnante. | L'extension comfyui-inpaint-nodes. Avec le modèle LaMa (environ 200 Mo), l'effacement est naturel. Sans lui, un effacement simplifié reste possible. |
| **{{ui:segment.redraw.title}}** | Redessine uniquement la partie sélectionnée selon une instruction textuelle. Les autres parties ne changent pas. | Un modèle d'image |
| **{{ui:segment.toCanvas}}** | Envoie l'image et la sélection vers la [toile](05-canvas.md). La sélection devient un masque d'inpainting. | Aucun |

Pour redessiner, on écrit **ce qu'il faut dessiner** en texte (par exemple : blue hair, red scarf). On obtient plus facilement ce qu'on attend en écrivant dans le style que le modèle maîtrise (comme des tags en anglais pour un modèle de style anime). Plus on baisse **{{ui:segment.redraw.strength}}**, plus les formes et les couleurs d'origine sont conservées.

Le résultat est enregistré comme nouvelle image dans la même planche que l'originale. L'image d'origine ne change pas.

## Corriger les visages

![La boîte de dialogue pour corriger les visages](shot:facefix)

Dans les plans larges, les visages qui apparaissent petits sortent souvent déformés. **{{ui:facefix.menu}}** repère automatiquement les visages de l'image, redessine uniquement les visages à haute résolution et les replace dans l'image d'origine. Rien d'autre que les visages ne change.

1. Ouvrir l'image dans la visionneuse et appuyer sur **{{ui:facefix.menu}}** (il figure aussi dans le menu du clic droit).
2. Uniquement la première fois, les extensions ComfyUI-Impact-Pack et ComfyUI-Impact-Subpack sont nécessaires. Les installer avec **{{ui:facefix.install}}**, puis appuyer sur **{{ui:facefix.restart}}**. Le modèle qui repère les visages est préparé par le Subpack lui-même.
3. Vérifier les paramètres.
   - **{{ui:facefix.model}}** : le modèle utilisé pour l'image d'origine est sélectionné.
   - **{{ui:facefix.prompt}}** : le prompt de l'image d'origine est déjà saisi. Ajouter des caractéristiques du visage rend l'effet plus marqué.
   - **{{ui:facefix.strength}}** : plus elle est basse, plus le visage reste proche de l'original ; plus elle est haute, plus il est redessiné.
   - **{{ui:facefix.sensitivity}}** : l'augmenter ne retient que les visages sûrs, la diminuer retient aussi les petits visages et les profils. Cependant, des éléments qui ne sont pas des visages sont alors aussi plus facilement retenus.
4. Appuyer sur **{{ui:facefix.run}}**.

Le résultat est enregistré dans la même planche que l'originale. Appuyer sur **{{ui:facefix.open}}** permet de le comparer avec l'original dans la visionneuse. Si le résultat déplaît, modifier les paramètres et appuyer sur **{{ui:facefix.again}}**.

> Une image créée avec un LoRA est redessinée sans le LoRA. C'est pourquoi le style du seul visage peut paraître légèrement différent.

> Lorsque « Le modèle de détection des visages (YOLO) est introuvable » apparaît, redémarrer ComfyUI ou réinstaller les extensions.

## Créer un prompt à partir d'une image

![La boîte de dialogue après l'écriture des tags d'une image](shot:caption)

Cette fonction examine une image et écrit un prompt (des tags ou une phrase) permettant de la dessiner. Elle sert quand on veut des images proches d'une image appréciée, ou quand on hésite sur la façon d'écrire le prompt.

1. Choisir le bouton **{{ui:caption.menu}}** de la visionneuse, ou **{{ui:caption.menu}}** dans le menu du clic droit de l'image. On peut aussi l'ouvrir depuis le bouton **{{ui:caption.fromPrompt}}** au-dessus du champ de prompt de l'onglet Générer. On peut déposer sur ce bouton une image de la galerie ou un fichier image de l'ordinateur.
2. Sous **{{ui:caption.style}}**, choisir **{{ui:caption.style.tags}}** ou **{{ui:caption.style.sentence}}**.
3. Appuyer sur **{{ui:caption.run}}**.
4. Les mots obtenus peuvent être modifiés sur place. Appuyer ensuite sur **{{ui:caption.replace}}**, **{{ui:caption.append}}** ou **{{ui:caption.copy}}**.

Le remplacement et l'ajout s'appliquent à « {{ui:params.prompt.positive}} » de l'onglet Générer. Cette fonction n'ajoute aucune image à la galerie.

> Cette fonction nécessite l'extension ComfyUI-Florence2. Si elle n'est pas installée, on peut l'installer depuis la boîte de dialogue (voir « Quand une extension est nécessaire » dans ce chapitre). À la première utilisation, le téléchargement du modèle servant à décrire les images (Florence-2 PromptGen) démarre.

## Enregistrer et utiliser un personnage

![La boîte de dialogue d'enregistrement comme personnage](shot:character)

En enregistrant une image d'un personnage apprécié, on peut dessiner dans d'autres scènes des images qui se rapprochent du même personnage. On enregistre les trois éléments suivants.

- Des images de référence (des images du même personnage, autant que l'on veut)
- Des mots d'apparence (couleur des cheveux et des yeux, vêtements, etc. ; ils sont ajoutés au début du prompt)
- La fidélité à la référence

### Enregistrer

1. Dans la galerie, sélectionner l'image à enregistrer. Pour plusieurs images, cliquer en maintenant `Ctrl`.
2. Choisir le bouton **{{ui:character.menu}}** de la visionneuse, ou **{{ui:character.menu}}** dans le menu du clic droit. En ouvrant le champ **{{ui:character.row.choose}}** de l'onglet Générer, **{{ui:character.row.register}}** se trouve tout en bas de la liste, et on peut aussi l'ouvrir à partir de là.
3. Saisir le **{{ui:character.name}}** et les **{{ui:character.tags}}**. Y écrire les caractéristiques qui ne doivent pas changer (cheveux bruns, chemisier blanc, jupe bleue, etc.).
4. Définir le **{{ui:character.weight}}**. Plus il est élevé, plus l'image ressemble aux images de référence, mais plus la liberté sur la scène et la composition diminue.
5. Appuyer sur **{{ui:character.save}}**.

Avec **{{ui:character.addSelected}}**, on peut ensuite ajouter aux images de référence des images sélectionnées dans la galerie. **{{ui:character.removePicture}}** est le ✕ en haut à droite d'une image.

En activant **{{ui:character.whiteBg}}**, une image dont l'arrière-plan est remplacé par du blanc est créée à partir de l'image enregistrée, et c'est elle qui sert d'image de référence. Cela évite que la couleur de l'arrière-plan se transmette aux images générées. L'image d'origine est conservée, et l'image à fond blanc est enregistrée comme nouvelle image. Lorsque l'extension ComfyUI-RMBG, utilisée pour supprimer l'arrière-plan, n'est pas installée, cet interrupteur est inutilisable et l'image d'origine est utilisée telle quelle.

### Utiliser

1. Dans le panneau de gauche de l'onglet **{{ui:app.tabs.generate}}** (ou de l'onglet [Toile](05-canvas.md)), ouvrir **{{ui:character.row.choose}}** et choisir le personnage voulu.
2. Les images de référence du personnage vont dans le champ « {{ui:params.refImage.sectionLabel}} », et les mots d'apparence sont ajoutés au début du prompt.
3. Générer comme d'habitude.

À l'utilisation, l'application peut ajuster certains réglages automatiquement. Une notification le signale.

- Avec des images de référence, une échelle CFG élevée a tendance à brûler l'image ; si l'échelle CFG dépasse 5, elle est donc abaissée à 4,5.
- Il peut y avoir au plus 8 images de référence au total. Lorsque le total avec d'autres images de référence dépasse 8, ce sont les premières images qui sont utilisées.
- Lorsqu'il y a plusieurs images de référence, la force par image est abaissée automatiquement afin qu'ensemble elles ne deviennent pas trop fortes.
- Les images supprimées de la galerie ne peuvent pas être utilisées. Si toutes ont été supprimées, le personnage est inutilisable.

Pour modifier ou supprimer un personnage enregistré, utiliser le bouton « … » d'un élément de la liste.

> Il s'agit d'une fonction qui « se rapproche » du même personnage ; elle ne donne donc pas exactement le même visage. La coiffure, la couleur, les vêtements, etc. ont tendance à être conservés, mais les traits du visage changent un peu. Écrire dans les mots d'apparence les caractéristiques à conserver aide.

> Pour utiliser des images de référence, il faut l'extension ComfyUI_IPAdapter_plus et un modèle pour les images de référence. S'ils ne sont pas installés, on peut les installer depuis le champ des images de référence de l'onglet Générer. Pour les modèles, voir le chapitre [Modèles](08-models.md).

## Comparer des paramètres avec une grille de comparaison

![La boîte de dialogue de la grille de comparaison](shot:xyplot)

Comment une image change-t-elle quand on modifie l'échelle CFG ou le nombre d'étapes ? Cette fonction le présente dans une seule grille pour comparer.

1. Dans l'onglet Générer, définir le prompt et le modèle comme d'habitude.
2. Appuyer sur le « ▼ » à droite du bouton **{{ui:params.invoke.invoke}}** et choisir **{{ui:xyplot.menu}}**.
3. Avec **{{ui:xyplot.x}}** et **{{ui:xyplot.y}}**, choisir les paramètres à faire varier. On peut aussi n'en utiliser qu'un seul.
4. Saisir les valeurs. Les nombres se saisissent séparés par des virgules (par exemple : 3, 5, 7).
5. Appuyer sur **{{ui:xyplot.run}}**.

En bas de la boîte de dialogue, le nombre d'images qui seront créées apparaît, par exemple « 3 colonnes × 2 lignes = 6 images seront créées. »

Les paramètres modifiables sont les suivants.

| Paramètre | Comment le saisir |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Des nombres (1 à 30) |
| {{ui:xyplot.axis.steps}} | Des nombres entiers (1 à 150) |
| {{ui:xyplot.axis.seed}} | Des nombres entiers |
| {{ui:xyplot.axis.strength}} | Des nombres (0,05 à 1). Il n'a d'effet que pour une création à partir d'une image (image vers image). |
| {{ui:xyplot.axis.scheduler}} | À choisir dans une liste |
| {{ui:xyplot.axis.model}} | Choisir dans une liste des modèles de la même famille |
| {{ui:xyplot.axis.prompt}} | Écrire un élément par ligne. Ils sont ajoutés au prompt |

Les règles sont les suivantes.

- On peut saisir jusqu'à 8 valeurs pour un paramètre. La grille peut contenir au plus 36 images au total.
- On ne peut pas choisir le même paramètre à l'horizontale et à la verticale.
- Toutes les images sont dessinées avec la **même seed** (sauf si l'on choisit un paramètre qui change la seed). La seule différence est le paramètre modifié.
- Les paramètres sont repris du formulaire de l'onglet Générer à cet instant. Le formulaire n'est pas modifié.
- Une image qui n'a pas pu être créée apparaît sous la forme × dans la grille. La grille est tout de même créée avec les autres images.

La grille terminée est enregistrée dans la galerie comme une seule image. **{{ui:xyplot.open}}** l'affiche dans la visionneuse. Les images individuelles à partir desquelles la grille a été faite restent aussi dans la galerie.

> Plus il y a d'images, plus cela prend de temps. Pour 36 images, il faut 36 générations. Il est recommandé d'essayer d'abord avec 2 ou 3 valeurs.

## Choisir parmi des brouillons

![L'onglet Brouillons avec des candidats à moitié dessinés alignés](shot:drafts)

Une image change beaucoup selon la seed. Les brouillons sont une fonction qui dessine de nombreuses seeds seulement « à mi-chemin », puis dessine jusqu'au bout uniquement les compositions appréciées. Cela fait gagner du temps.

Ouvrir l'onglet **{{ui:app.views.drafts}}** au centre de l'onglet **{{ui:app.tabs.generate}}**.

1. Choisir le **{{ui:drafts.model}}**. Au départ, c'est le modèle de l'onglet Générer qui est sélectionné.
2. Définir le **{{ui:drafts.count}}** (1 à 24 images ; 8 au départ).
3. Définir la **{{ui:drafts.position}}** (25 à 60 % ; 35 % au départ). Plus elle est petite, plus c'est rapide, mais plus les images sont grossières.
4. Appuyer sur **{{ui:drafts.start}}**.

Les images de brouillon s'alignent dans l'ordre où elles sont terminées. Le prompt et les autres paramètres de l'onglet Générer sont utilisés.

Cliquer sur une image la sélectionne (un nouveau clic la désélectionne). Un double-clic l'affiche en grand dans la visionneuse. Le bouton en forme d'étoile (**{{ui:drafts.keep}}**) et le ✕ (**{{ui:drafts.reject}}**) sont des repères à usage personnel. Un appui sur le bouton « {{ui:manual.drafts.finish}} N images » en bas à droite (N est le nombre sélectionné) dessine les images sélectionnées jusqu'au bout. Pour choisir de nouveau, appuyer sur **{{ui:drafts.clearSelection}}**.

Les images dessinées jusqu'au bout entrent dans la galerie comme une génération normale, et « {{ui:drafts.badge.finished}} » apparaît sur le brouillon. Si certains brouillons ont échoué, un bouton « {{ui:manual.drafts.retry}} N échecs » apparaît.

> Bien que l'on dise « {{ui:manual.drafts.finish}} », la reprise ne se fait pas à partir du milieu. L'image est redessinée du début à la fin avec la même seed. Le temps nécessaire pour terminer est donc le même que pour une génération normale. On obtient une image avec la composition vue dans le brouillon.

> Les brouillons ne sont utilisables que pour la génération qui crée des images à partir d'un texte. Si des images de référence ou similaires sont définies, un message apparaît et le démarrage est impossible. Les images de brouillon ne figurent pas dans la liste de la galerie.

Les brouillons s'alignent dans les onglets du haut « dans l'ordre où on les a lancés ». Lorsqu'un brouillon n'est plus nécessaire, le fermer avec le ✕ de son onglet.

## Traiter en lot

![La boîte de dialogue du traitement en lot](shot:batch)

On peut appliquer la suppression de l'arrière-plan ou l'agrandissement à plusieurs images sélectionnées en une seule fois.

1. Dans la galerie, sélectionner plusieurs images (cliquer en maintenant `Ctrl`, ou cliquer en maintenant `Maj` pour sélectionner une plage).
2. Faire un clic droit sur une image sélectionnée et choisir **{{ui:gallery.menu.batch}}**.
3. Choisir le traitement.
   - **{{ui:batch.op.removeBackground.title}}** : rend l'arrière-plan transparent. L'extension ComfyUI-RMBG est nécessaire. Si elle n'est pas installée, un bouton d'installation apparaît.
   - **{{ui:batch.op.upscale.title}}** : agrandit avec un modèle de mise à l'échelle. Sans modèle, en installer un depuis l'écran [Modèles](08-models.md).
4. Appuyer sur **{{ui:batch.run}}**.

Chaque image entre dans la file comme un élément distinct. La progression se voit dans l'onglet **{{ui:app.tabs.queue}}**. Les résultats vont dans la même planche que les images d'origine, comme nouvelles images. Les images d'origine ne changent pas.

Pour traiter soigneusement une seule image en modifiant les paramètres, utiliser les fonctions individuelles de ce chapitre ([Supprimer l'arrière-plan](#supprimer-l-arrière-plan)). Pour agrandir une seule image, on peut aussi utiliser l'onglet [Mise à l'échelle](06-upscaling-workflows.md).
