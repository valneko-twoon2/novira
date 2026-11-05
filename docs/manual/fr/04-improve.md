# Retoucher et réutiliser les images

Ce chapitre rassemble les fonctions pour quand vous vous dites, devant une image terminée : « je voudrais la retoucher un peu », « j'en voudrais encore quelques-unes dans la même ambiance » ou « je voudrais utiliser ce personnage dans une autre scène ».

La plupart des fonctions s'appellent depuis les boutons de la barre d'outils au-dessus de la visionneuse (l'écran où l'on regarde une image en grand) ou depuis le menu du clic droit sur une image de la galerie. Les boutons de la barre d'outils affichent leur nom quand vous placez la souris dessus. Pour les bases de la visionneuse et de la galerie, voir [La galerie et la visionneuse](03-gallery.md).

## Quelle fonction utiliser

| Ce que vous voulez faire | À utiliser | Autre chose de nécessaire |
|---|---|---|
| Créer encore quelques images avec les mêmes réglages, ou recréer en changeant un peu | **{{ui:gallery.derive.menu}}** | Que le modèle utilisé pour l'image d'origine soit installé |
| Retirer l'arrière-plan pour ne garder que la personne ou l'objet | **{{ui:cutout.menu}}** | L'extension ComfyUI-RMBG |
| Supprimer les marges transparentes | **{{ui:gallery.menu.trim}}** (clic droit uniquement) | Rien |
| Peindre une partie de l'image pour l'effacer, la détourer ou la redessiner | **{{ui:gallery.menu.segment}}** | Pour effacer, l'extension comfyui-inpaint-nodes |
| Nettoyer un petit visage déformé | **{{ui:facefix.menu}}** | Les extensions ComfyUI-Impact-Pack et ComfyUI-Impact-Subpack |
| Transformer une image en planche de manga noir et blanc | **{{ui:gallery.manga.menu}}** (barre d'outils de la visionneuse uniquement) | L'extension ComfyUI-MangaScreen |
| Écrire un prompt à partir d'une image | **{{ui:caption.menu}}** | L'extension ComfyUI-Florence2 |
| Enregistrer un personnage pour l'utiliser dans d'autres images | **{{ui:character.menu}}** | L'extension pour les images de référence (IP-Adapter) |
| Aligner dans un seul tableau des images aux réglages différents | **{{ui:xyplot.menu}}** | Rien |
| Choisir parmi des candidats à moitié dessinés | L'onglet **{{ui:app.views.drafts}}** | Rien |
| Appliquer le même traitement à de nombreuses images | **{{ui:gallery.menu.batch}}** (choisir plusieurs images, puis clic droit) | Selon le traitement |

## Utiliser les outils de retouche

{{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}} et {{ui:canvas.poseFromImage.menu}} sont regroupés sous **{{ui:gallery.tools.heading}}** dans le menu du clic droit sur une image de la galerie. Tous s'utilisent dans une bande qui s'ouvre au-dessus de la visionneuse. L'image reste affichée dans la visionneuse, si bien que vous pouvez la vérifier en zoomant et en la déplaçant.

- Choisir un élément le lance aussitôt avec les derniers réglages. L'image s'affiche dans la visionneuse et la progression apparaît dans la bande.
- Le bouton en forme d'engrenage à droite d'un élément ouvre les réglages dans la bande sans lancer le traitement. Modifiez les réglages, puis appuyez sur **{{ui:gallery.tools.run}}**. Les réglages modifiés servent aussi à la prochaine exécution.
- Les boutons **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}** et **{{ui:caption.menu}}** de la barre d'outils de la visionneuse ouvrent eux aussi les réglages de la bande. Un nouvel appui la referme.
- Les boutons à gauche de la bande permettent de passer à un autre outil.
- Une fois terminé, la bande affiche le résultat et les réglages utilisés. En appuyant sur **{{ui:gallery.tools.edit}}**, vous revenez aux réglages, que vous pouvez modifier avant de relancer.
- Le traitement avance dans la file d'attente. Il ne s'arrête pas si vous fermez la bande, si vous passez à une autre image ou à un autre écran. Seul **{{ui:common.cancel}}**, dans la bande, l'arrête. Le résultat d'un traitement qui crée une image est enregistré dans la galerie même si la bande est fermée.

## Quand une extension est nécessaire

Des fonctions comme la suppression de l'arrière-plan et la correction des visages fonctionnent en ajoutant des « extensions » au moteur qui crée les images (ComfyUI). Quand l'extension n'est pas installée, la bande affiche un message du type « … nécessite l'extension ○○. » et des boutons d'installation.

1. Appuyez sur **{{ui:gallery.tools.install}}**. Ce qui est nécessaire est téléchargé et installé automatiquement. L'installation se déroule en arrière-plan, et la progression apparaît dans l'affichage des téléchargements. Elle ne s'arrête pas si vous fermez la bande.
2. Quand l'installation est terminée, le bouton de la bande devient **{{ui:gallery.tools.restart}}**. En appuyant dessus, vous redémarrez ComfyUI.
3. Une fois le redémarrage terminé, l'outil est directement utilisable.

À la première utilisation, le téléchargement des modèles que l'extension utilise commence aussi, ce qui prend du temps. Une connexion à Internet est nécessaire. Ce téléchargement se déroule au cours du traitement lancé ; il ne s'arrête donc pas si vous fermez la bande.

> Certaines extensions demandent du temps et de la place pour s'installer. ComfyUI-Impact-Pack a besoin de Git pour s'installer. Sur un ordinateur où Git n'est pas installé, l'installation échoue. Si un message s'affiche, lisez-le avant d'agir.

Les extensions peuvent aussi s'installer depuis l'onglet « {{ui:workflows.panel.packs}} » des [workflows](06-upscaling-workflows.md). Si cela ne marche pas, consultez aussi [Dépannage](10-troubleshooting.md).

## Recréer avec les mêmes paramètres (dériver)

![Le menu « Dériver » ouvert dans la barre d'outils de la visionneuse](shot:derive-menu)

Ouvrez dans la visionneuse une image qui vous plaît et appuyez sur le bouton **{{ui:gallery.derive.menu}}** de la barre d'outils (icône de ramification). Dans la galerie, faites un clic droit sur l'image et choisissez **{{ui:gallery.derive.menu}}**.

Vous avez le choix entre trois types.

| Élément | Ce que cela fait |
|---|---|
| « Mêmes réglages, autre seed » (1 ou 4 images) | Le prompt, le modèle, la taille, etc. restent identiques et seul le seed change. La composition change, mais l'ambiance est la même. |
| « Recréer en changeant un peu » (1 ou 4 images) | L'image d'origine sert de base et est redessinée en douceur (avec une force de 0,45). La composition et les couleurs sont conservées, seuls les détails changent. |
| **{{ui:gallery.derive.custom}}** | Vous décidez vous-même de l'ampleur du changement (élément suivant). |

Une fois le choix fait, les nouvelles images entrent dans la file d'attente et se placent dans la même planche que l'image d'origine. **Les réglages de l'onglet Générer ne sont pas modifiés.** Le prompt que vous étiez en train de saisir reste lui aussi tel quel.

> Pour rappeler les réglages à l'écran puis les retoucher vous-même avant de créer, utilisez **{{ui:gallery.menu.remix}}**. Dériver sert à « créer d'un seul bouton avec les réglages d'origine ».

### Choisir l'ampleur du changement et recréer

![La boîte de dialogue pour choisir l'ampleur du changement](shot:derive)

Choisir **{{ui:gallery.derive.custom}}** ouvre une boîte de dialogue.

1. Déplacez le curseur **{{ui:gallery.derive.dialog.strength}}**. Plus il est à gauche ({{ui:gallery.derive.dialog.close}}), plus la composition et les couleurs d'origine sont conservées ; plus il est à droite ({{ui:gallery.derive.dialog.free}}), plus l'image se rapproche d'une autre image.
2. Choisissez **{{ui:gallery.derive.dialog.count}}** parmi 1, 2, 4 et 8.
3. Appuyez sur **{{ui:gallery.derive.dialog.create}}**.

À titre indicatif, autour de 0,25 on obtient une image presque identique à l'original, et autour de 0,75 une image où le personnage reste mais où la composition change beaucoup. Cela dépend de l'image : essayez plusieurs valeurs. La valeur du curseur ne sert que pour cette seule fois.

### Ce qui est repris et ce qui ne l'est pas

- Repris : les réglages utilisés pour créer l'image, comme le prompt, le prompt négatif, le modèle, les LoRA, la taille, le nombre d'étapes, l'échelle CFG et le planificateur.
- Les images de référence et les couches de contrôle sont mémorisées avec l'image, donc elles sont utilisées telles quelles. En revanche, si ces images ont été supprimées de la galerie, la création est impossible. La raison s'affiche dans une notification.
- Non repris : le masque, le guidage par région et les réglages des brouillons. Si une image créée avant l'existence de cette fonction utilisait des images de référence, par exemple, elles ne sont pas mémorisées et ne peuvent pas être reprises. Une notification vous prévient quand quelque chose n'a pas pu être repris.

Dans les cas suivants, le bouton ne peut pas être pressé, ou une notification s'affiche et la création est impossible.

- L'image n'a pas été créée à partir d'un texte (y compris image vers image, inpainting et outpainting). Les images agrandies, les vidéos, les sons, etc. sont exclus.
- Le modèle utilisé pour l'image d'origine n'est pas installé. Une notification indique le nom du modèle.

## Supprimer l'arrière-plan

![Dans la bande de la visionneuse, l'arrière-plan est supprimé et comparé avec l'image d'origine](shot:cutout)

L'outil reconnaît automatiquement ce qui est représenté et crée une image sans arrière-plan. Il n'y a rien à désigner par un clic.

1. Faites un clic droit sur une image de la galerie et choisissez **{{ui:cutout.menu}}** sous **{{ui:gallery.tools.heading}}** : il s'exécute aussitôt avec les derniers réglages. Si vous voulez d'abord modifier les réglages, ouvrez la bande avec l'engrenage à droite de l'élément ou avec le bouton en forme de ciseaux de la barre d'outils de la visionneuse.
2. Dans la bande, modifiez au besoin les réglages.
   - **{{ui:cutout.model}}** : Vous pouvez normalement le laisser tel quel.
   - **{{ui:cutout.sensitivity}}** : Plus la valeur est basse, plus les parties à la limite floue sont conservées.
   - **{{ui:cutout.edge}}** : Une valeur positive élargit le contour, une valeur négative le rogne.
   - **{{ui:cutout.background}}** : Choisissez **{{ui:cutout.background.alpha}}** ou **{{ui:cutout.background.white}}**.
3. Appuyez sur **{{ui:gallery.tools.run}}**.

L'image obtenue est enregistrée comme nouvelle image dans la même planche que l'image d'origine. **L'image d'origine est conservée.** La visionneuse passe à un affichage qui compare l'image obtenue et l'image d'origine. Si le résultat ne vous satisfait pas, appuyez sur **{{ui:gallery.tools.edit}}**, modifiez les réglages et relancez.

Un arrière-plan blanc convient quand vous en ferez ensuite l'image de référence d'un [personnage](#enregistrer-et-utiliser-un-personnage). La couleur de l'arrière-plan se transmet alors moins facilement aux nouvelles images.

## Supprimer les marges transparentes

Une image dont l'arrière-plan a été rendu transparent garde des marges transparentes autour d'elle. **{{ui:gallery.menu.trim}}** enregistre une nouvelle image transparente, recadrée au plus près de la partie dessinée. C'est pratique pour s'en servir comme autocollant ou comme matériau.

- Faites un clic droit sur une image de la galerie et choisissez-la. Juste après une suppression d'arrière-plan, vous pouvez aussi le faire avec **{{ui:cutout.trim}}** dans la bande (affiché uniquement quand l'arrière-plan a été rendu transparent).
- Les ombres si pâles qu'elles sont à peine visibles sont rognées comme des marges.
- Si la partie transparente de l'image n'atteint pas le bord, « Aucune marge à rogner » s'affiche et rien n'est enregistré. Une image entièrement transparente ne peut pas non plus être rognée.

## Sélectionner une zone et la corriger

Vous sélectionnez la partie à corriger en la peignant au pinceau. L'image s'ouvre sur la [toile](05-canvas.md), si bien que vous pouvez peindre avec précision en zoomant et en vous déplaçant.

1. Ouvrez l'image dans la visionneuse et appuyez sur **{{ui:gallery.menu.segment}}** (vous pouvez aussi le choisir par le clic droit dans la galerie).
2. La toile s'ouvre avec cette image et un **{{ui:canvas.add.inpaint}}** vide sélectionné. L'outil est **{{ui:canvas.tool.brush}}**.
3. Peignez la partie à corriger. Retirez ce que vous avez peint en trop avec **{{ui:canvas.tool.eraser}}**. Pour sélectionner le reste, faites un clic droit sur le masque et choisissez **{{ui:canvas.entityMenu.invertMask}}**.
4. Choisissez ce qu'il faut faire de la partie peinte. Quand vous sélectionnez la ligne du masque, un champ de saisie et des boutons apparaissent dessous (effacer et détourer se trouvent aussi dans le menu du clic droit du masque).

| Ce que vous voulez faire | Opération | Ce qui est nécessaire |
|---|---|---|
| Effacer en fondant avec le reste de l'image | **{{ui:canvas.partFix.erase}}**. Le résultat est placé provisoirement sur la toile ; choisissez **{{ui:canvas.staging.accept}}** ou rejetez-le. | L'extension comfyui-inpaint-nodes. Avec le modèle LaMa (environ 200 Mo), l'effacement est plus naturel. Sans lui, un effacement simplifié reste possible. |
| Enregistrer seulement la partie peinte comme image transparente | **{{ui:canvas.partFix.cutOutAction}}** | Rien |
| Redessiner à partir d'une instruction écrite | Écrivez dans le champ ce qu'il faut redessiner, par exemple « ruban bleu », puis appuyez sur **{{ui:canvas.partFix.redraw}}**. Seule la partie peinte est redessinée avec le modèle et les réglages de l'onglet Générer. Si le champ est vide, le prompt de l'onglet Générer est utilisé. Le prompt de l'onglet Générer n'est pas modifié. Le résultat est placé provisoirement ; choisissez **{{ui:canvas.staging.accept}}** ou rejetez-le. | Un modèle d'image |
| Appliquer une mosaïque | Sans masque, passez directement sur l'image avec l'outil **{{ui:canvas.tool.mosaic}}**. | Rien |

L'image d'origine ne change pas. Le détourage est enregistré dans la galerie comme nouvelle image.

## Corriger les visages

![La bande de la visionneuse avec les réglages de correction des visages ouverts](shot:facefix)

Dans une image en plan large, les petits visages se déforment souvent. **{{ui:facefix.menu}}** trouve automatiquement les visages de l'image, redessine uniquement les visages en haute résolution et les replace dans l'image d'origine. Rien d'autre que les visages ne change.

1. Faites un clic droit sur une image de la galerie et choisissez **{{ui:facefix.menu}}** sous **{{ui:gallery.tools.heading}}** : il s'exécute aussitôt. Si vous voulez vérifier les réglages avant de lancer, ouvrez la bande avec l'engrenage à droite de l'élément ou avec le bouton **{{ui:facefix.menu}}** de la barre d'outils de la visionneuse.
2. Seulement la première fois, les extensions ComfyUI-Impact-Pack et ComfyUI-Impact-Subpack sont nécessaires. Installez-les avec **{{ui:gallery.tools.install}}** dans la bande, puis appuyez sur **{{ui:gallery.tools.restart}}**. Le modèle qui détecte les visages est préparé par le Subpack lui-même.
3. Vérifiez les réglages.
   - **{{ui:facefix.model}}** : Le modèle utilisé pour l'image d'origine est sélectionné.
   - **{{ui:facefix.detector}}** : Le modèle qui sert à détecter les visages. Vous pouvez normalement le laisser tel quel.
   - **{{ui:facefix.prompt}}** : Le prompt de l'image d'origine est déjà saisi. Ajouter des traits du visage est efficace.
   - **{{ui:facefix.strength}}** : Plus il est bas, plus le visage reste proche de l'original ; plus il est haut, plus il est redessiné.
   - **{{ui:facefix.sensitivity}}** : En l'augmentant, on ne détecte que les visages sûrs ; en le diminuant, on détecte aussi les petits visages et les profils. En revanche, des éléments qui ne sont pas des visages sont plus facilement détectés.
4. Appuyez sur **{{ui:gallery.tools.run}}**.

Le résultat est enregistré dans la même planche que l'image d'origine, et la visionneuse passe à un affichage qui le compare avec l'image d'origine. S'il ne vous plaît pas, appuyez sur **{{ui:gallery.tools.edit}}**, modifiez les réglages et relancez. Le modèle et le contenu à redessiner ne sont mémorisés que tant que vous les utilisez sur la même image.

> Une image créée avec une LoRA est redessinée sans la LoRA. Le style du visage seul peut donc sembler un peu différent.

> Si le message « Le modèle de détection des visages (YOLO) est introuvable » s'affiche, redémarrez ComfyUI ou réinstallez l'extension.

## Finir une image en planche de manga

**{{ui:gallery.manga.menu}}**, dans la barre d'outils de la visionneuse, transforme l'image ouverte en planche de manga noir et blanc où les traits restent nets. Les ombres deviennent des aplats et de vraies trames (points de trame), et les principaux traits à l'intérieur des aplats noirs sont réservés en blanc, finement. Quand vous dessinez, vous obtenez toujours une image couleur ordinaire ; cette finition est une opération que l'on effectue après coup sur une image qui vous plaît.

1. Ouvrez l'image dans la visionneuse et appuyez sur **{{ui:gallery.manga.menu}}**. L'image d'origine s'affiche à gauche.
2. Seulement la première fois, l'extension ComfyUI-MangaScreen est nécessaire. Si elle n'est pas installée, un message apparaît : appuyez sur **{{ui:gallery.manga.installPack}}**, puis, après l'installation, sur **{{ui:gallery.manga.restartEngine}}**. Les boutons du bas ne peuvent pas être pressés tant que l'installation n'est pas terminée.
3. Au besoin, modifiez les valeurs (elles sont mémorisées pour la fois suivante).
   - **{{ui:gallery.manga.screenLines}}** : Le nombre de rangées de points de trame sur la largeur. 120 est grossier, 200 standard, 300 plutôt fin.
   - **{{ui:gallery.manga.whitePoint}}** : Ce qui est plus clair que cette valeur devient le blanc du papier. En l'abaissant, les trames de la peau et des cheveux clairs disparaissent.
   - **{{ui:gallery.manga.blackPoint}}** : Ce qui est plus sombre que cette valeur devient un aplat noir. En l'augmentant, les surfaces noires augmentent.
   - **{{ui:gallery.manga.gradation}}** : Rend les ombres qui s'assombrissent progressivement par la taille des points de trame, sans les découper en paliers. À 0, il ne reste que des aplats.
   - **{{ui:gallery.manga.whiteLines}}** : La quantité de traits réservés en blanc à l'intérieur des aplats noirs. À 0, c'est désactivé.
   **{{ui:gallery.manga.reset}}** remet toutes les valeurs à leur état d'origine.
4. Appuyez sur **{{ui:gallery.manga.tryRun}}** : le résultat apparaît à droite et vous pouvez le comparer avec l'image d'origine. Un simple essai n'enregistre rien.
5. Si le résultat vous plaît, appuyez sur **{{ui:gallery.manga.save}}**. L'image finie est enregistrée comme nouvelle image dans la même planche que l'image d'origine, qui ne change pas. **{{ui:gallery.manga.open}}** ouvre cette image.

À l'enregistrement, la finition est refaite avec les valeurs que vous voyez, ce qui prend autant de temps qu'un essai.

## Créer un prompt à partir d'une image

![Dans la bande de la visionneuse, des tags écrits à partir de l'image](shot:caption)

L'outil regarde une image et écrit le prompt (des tags ou des phrases) qui permettrait de la dessiner. Utilisez-le quand vous voulez créer une image proche de celle que vous aimez, ou quand vous hésitez sur la manière d'écrire un prompt.

1. Faites un clic droit sur une image de la galerie et choisissez **{{ui:caption.menu}}** sous **{{ui:gallery.tools.heading}}** : le texte est écrit aussitôt. Le bouton **{{ui:caption.fromPrompt}}**, au-dessus du champ du prompt de l'onglet Générer, fait la même chose. Ce bouton utilise l'image choisie dans la galerie ; si aucune n'est choisie, il ouvre un écran de choix de fichier image. Vous pouvez aussi déposer sur ce bouton une image de la galerie ou un fichier image de votre ordinateur.
2. Pour changer la manière d'écrire, appuyez sur **{{ui:gallery.tools.edit}}** dans la bande et choisissez **{{ui:caption.style.tags}}** ou **{{ui:caption.style.sentence}}** avec **{{ui:caption.style}}**.
3. Appuyez sur **{{ui:gallery.tools.run}}**.
4. Les mots obtenus peuvent être corrigés sur place dans la bande. Appuyez sur **{{ui:caption.replace}}**, **{{ui:caption.append}}** ou **{{ui:caption.copy}}**.

La destination du remplacement ou de l'ajout est le champ « {{ui:params.prompt.positive}} » de l'onglet Générer. Cette fonction n'ajoute pas d'image à la galerie.

> Cette fonction nécessite l'extension ComfyUI-Florence2. Si elle n'est pas installée, vous pouvez l'installer depuis la bande (voir « Quand une extension est nécessaire » dans ce chapitre). À la première utilisation, le téléchargement du modèle qui transforme l'image en mots (Florence-2 PromptGen) commence.

## Enregistrer et utiliser un personnage

![La boîte de dialogue d'enregistrement d'un personnage](shot:character)

Si vous enregistrez l'image d'un personnage que vous aimez, vous pouvez le dessiner ressemblant dans d'autres scènes. Trois éléments sont enregistrés.

- Les images de référence (des images du même personnage, autant que vous voulez)
- Les mots décrivant l'apparence (couleur des cheveux et des yeux, vêtements, etc. ; ils sont ajoutés au début du prompt)
- La force de ressemblance

### Enregistrer

1. Dans la galerie, choisissez l'image à enregistrer. Pour plusieurs images, cliquez en maintenant `Ctrl`.
2. Choisissez le bouton **{{ui:character.menu}}** de la visionneuse, ou **{{ui:character.menu}}** dans le menu du clic droit. Quand vous ouvrez le champ **{{ui:character.row.choose}}** de l'onglet Générer, **{{ui:character.row.register}}** se trouve tout en bas de la liste, et vous pouvez aussi l'ouvrir de là.
3. Saisissez **{{ui:character.name}}** et **{{ui:character.tags}}**. Écrivez les traits que vous ne voulez pas voir changer (cheveux bruns, chemisier blanc, jupe bleue, etc.).
4. Réglez **{{ui:character.weight}}**. Plus la valeur est haute, plus l'image ressemble aux images de référence, mais plus la liberté de scène et de composition diminue.
5. Appuyez sur **{{ui:character.save}}**.

Avec **{{ui:character.addSelected}}**, vous pouvez ensuite ajouter aux images de référence celles que vous choisissez dans la galerie. **{{ui:character.removePicture}}** est le ✕ en haut à droite de l'image.

Si vous activez **{{ui:character.whiteBg}}**, une image dont l'arrière-plan est remplacé par du blanc est créée à partir de l'image enregistrée, et c'est elle qui sert d'image de référence. Cela évite que la couleur de l'arrière-plan passe dans les images générées. L'image d'origine est conservée, et l'image à fond blanc est enregistrée comme nouvelle image. Si l'extension ComfyUI-RMBG, utilisée pour supprimer l'arrière-plan, n'est pas installée, cet interrupteur est inutilisable et l'image d'origine est utilisée telle quelle.

### Utiliser

1. Dans le panneau de gauche de l'onglet **{{ui:app.tabs.generate}}** (ou de l'onglet de la [toile](05-canvas.md)), ouvrez **{{ui:character.row.choose}}** et choisissez le personnage à utiliser.
2. Les images de référence du personnage se placent dans le champ « {{ui:params.refImage.sectionLabel}} », et les mots d'apparence sont ajoutés au début du prompt.
3. Générez comme d'habitude.

À l'utilisation, l'application peut faire des ajustements automatiques. Une notification vous prévient.

- Avec des images de référence, l'image « brûle » facilement quand l'échelle CFG est élevée ; si l'échelle CFG dépasse 5, elle est ramenée à 4,5.
- Il peut y avoir au plus 8 images de référence en tout. Si, avec les autres images de référence, le total dépasse 8, on utilise d'abord les premières images.
- Quand il y a plusieurs images de référence, la force de chacune est abaissée automatiquement pour éviter qu'elles ne s'additionnent et ne soient trop marquées.
- Les images supprimées de la galerie ne peuvent pas être utilisées. Si elles sont toutes supprimées, le personnage ne peut pas être utilisé.

Pour modifier ou supprimer un personnage enregistré, utilisez le bouton « … » de l'élément dans la liste.

> Cette fonction « rapproche » du même personnage, mais ne donne pas exactement le même visage. La coiffure, la couleur, les vêtements, etc. se conservent bien, mais les traits du visage changent un peu. Les traits que vous voulez conserver sont plus efficaces si vous les écrivez dans les mots d'apparence.

> Pour utiliser des images de référence, l'extension ComfyUI_IPAdapter_plus et un modèle pour images de référence sont nécessaires. S'ils ne sont pas installés, vous pouvez les installer depuis le champ des images de référence de l'onglet Générer. Pour les modèles, voir le chapitre [Modèles](08-models.md).

## Choisir une LoRA pour un personnage

Dans la boîte de dialogue de modification d'un personnage, vous pouvez choisir une LoRA avec **{{ui:lora.section}}**. Une fois choisie, vous pouvez activer ou désactiver **{{ui:lora.use}}** et modifier **{{ui:lora.weight}}** ; quand vous utilisez le personnage, la LoRA et son mot déclencheur sont ajoutés au prompt. L'entraînement des LoRA se fait dans une autre application, novira-train.

## Comparer des paramètres avec une grille de comparaison

![La boîte de dialogue de la grille de comparaison](shot:xyplot)

Comment l'image change-t-elle quand on modifie l'échelle CFG ou le nombre d'étapes ? Cette fonction les présente dans un seul tableau pour les comparer.

1. Dans l'onglet Générer, fixez le prompt et le modèle comme d'habitude.
2. Appuyez sur le « ▼ » à droite du bouton **{{ui:params.invoke.invoke}}** et choisissez **{{ui:xyplot.menu}}**.
3. Choisissez avec **{{ui:xyplot.x}}** et **{{ui:xyplot.y}}** les réglages à faire varier. Un seul des deux suffit.
4. Saisissez les valeurs. Séparez les nombres par des virgules (exemple : 3, 5, 7).
5. Appuyez sur **{{ui:xyplot.run}}**.

En bas de la boîte de dialogue, le nombre d'images à créer s'affiche, par exemple « 3 colonnes × 2 lignes = 6 images seront créées. »

Voici les réglages qu'on peut faire varier.

| Réglage | Comment saisir |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Un nombre (1 à 30) |
| {{ui:xyplot.axis.steps}} | Un entier (1 à 150) |
| {{ui:xyplot.axis.seed}} | Un entier |
| {{ui:xyplot.axis.strength}} | Un nombre (0,05 à 1). N'agit que pour une création image vers image. |
| {{ui:xyplot.axis.scheduler}} | À choisir dans la liste |
| {{ui:xyplot.axis.model}} | Choisissez dans la liste des modèles de la même famille |
| {{ui:xyplot.axis.prompt}} | Écrivez un élément par ligne. Ils sont ajoutés au prompt |

Voici les règles.

- Un réglage accepte au plus 8 valeurs. Le tableau compte au plus 36 images au total.
- Le même réglage ne peut pas être choisi en horizontal et en vertical.
- Toutes les images sont dessinées avec le **même seed** (sauf si vous choisissez le seed comme réglage à faire varier). La seule différence vient du réglage modifié.
- Les réglages sont repris du formulaire de l'onglet Générer à cet instant. Le formulaire n'est pas modifié.
- Une image qui n'a pas pu être créée apparaît comme × dans le tableau. Le tableau est créé avec les autres images.

Le tableau obtenu est enregistré dans la galerie comme une seule image. **{{ui:xyplot.open}}** permet de l'afficher dans la visionneuse. Les images individuelles qui ont servi à faire le tableau restent aussi dans la galerie.

> Plus il y a d'images, plus cela prend du temps. Pour 36 images, il faut 36 générations. Nous vous conseillons de commencer avec 2 ou 3 valeurs.

## Choisir parmi des brouillons

![L'onglet Brouillons avec des candidats à moitié dessinés alignés](shot:drafts)

Selon le seed, l'image change beaucoup. Les brouillons sont une fonction qui dessine « à moitié » seulement avec de nombreux seeds, puis ne termine que les compositions que vous aimez. Cela fait gagner du temps.

Ouvrez l'onglet **{{ui:app.views.drafts}}**, au centre de l'onglet **{{ui:app.tabs.generate}}**.

1. Choisissez **{{ui:drafts.model}}**. Au départ, c'est le modèle de l'onglet Générer qui est sélectionné. Parmi les modèles d'image que l'onglet Générer permet de choisir, on trouve SDXL et SD1.X, mais aussi des modèles « corps seul » comme Anima, Flux, FLUX.2 et Z-Image. Les modèles d'édition (Flux Fill, Flux Kontext, Qwen-Image-Edit) servent à retoucher l'image d'origine et ne figurent donc pas dans la liste ; quand l'un d'eux est sélectionné, son nom s'affiche dessous.
2. Fixez **{{ui:drafts.count}}** (de 1 à 24 images. Au départ 4, modifiable avec **{{ui:settings.draftCount.label}}** dans les paramètres). Le nombre d'images et la position gardent les valeurs choisies à l'écran, même si vous passez à un autre écran, jusqu'à la fermeture de l'application.
3. Fixez **{{ui:drafts.position}}** (25 à 60 %. Au départ 35 %). Plus la valeur est petite, plus c'est rapide, mais plus l'image est grossière.
4. Appuyez sur **{{ui:drafts.start}}**.

Les images de brouillon s'alignent dans l'ordre où elles sont terminées. Le prompt et les autres réglages sont ceux de l'onglet Générer.

Un clic sur une image la sélectionne (un nouveau clic la désélectionne). Un double-clic l'affiche en grand dans la visionneuse. Le bouton en forme d'étoile (**{{ui:drafts.keep}}**) et le ✕ (**{{ui:drafts.reject}}**) sont des repères pour vous-même. En appuyant sur le bouton « ○ image(s) : {{ui:manual.drafts.finish}} » en bas à droite (○ est le nombre d'images choisies), les images choisies sont dessinées jusqu'au bout. Pour refaire la sélection, appuyez sur **{{ui:drafts.clearSelection}}**.

Une image dessinée jusqu'au bout entre dans la galerie comme une génération ordinaire, et « {{ui:drafts.badge.finished}} » s'affiche sur le brouillon. Quand un brouillon a échoué, le bouton « {{ui:manual.drafts.retry}} : ○ échec(s) » apparaît.

> Même avec « {{ui:manual.drafts.finish}} », la génération ne reprend pas en cours de route. Avec le même seed, l'image est redessinée du début à la fin. Le temps nécessaire jusqu'à l'achèvement est donc le même que pour une génération ordinaire. On obtient l'image de la composition que vous avez vue dans le brouillon.

> Les brouillons s'utilisent pour la génération à partir d'un texte, et pour le redessin avec une image placée dans **{{ui:params.i2i.title}}**. Dans {{ui:params.i2i.title}}, selon **{{ui:params.image.strength}}**, le dessin s'arrête à la proportion indiquée par la position parmi les étapes réellement dessinées. Les images de brouillon n'apparaissent pas dans la liste de la galerie.

Les brouillons s'alignent dans les onglets du haut « par ordre de début ». Seuls les 5 plus récents figurent dans les onglets. Tous les brouillons se voient dans l'écran **{{ui:drafts.history.title}}**, que le bouton « Historique » à gauche des onglets ouvre.

- Si vous choisissez dans la colonne de gauche une période ({{ui:drafts.history.period.today}}, {{ui:drafts.history.period.yesterday}}, {{ui:drafts.history.period.week}}, {{ui:drafts.history.period.older}}) et un modèle, seuls ces brouillons s'affichent. Le champ du haut permet de chercher avec des mots du prompt ou du nom du modèle.
- Les brouillons sont séparés par date, avec les images dessinées à ce moment-là, l'heure, la taille, et le nombre d'images en brouillon et finies.
- **{{ui:drafts.history.open}}** ouvre ce brouillon, et **{{ui:drafts.history.reuse}}** remet les réglages de ce brouillon dans les champs de génération.

Quand vous n'en avez plus besoin, fermez-les avec le ✕ de l'onglet ou de l'historique. Avec « {{ui:drafts.closeOlder}} » dans l'écran de l'historique, vous pouvez aussi fermer d'un coup les plus anciens qui ne figurent plus dans les onglets.

## Traiter en lot

![La boîte de dialogue du traitement en lot](shot:batch)

Vous pouvez appliquer d'un coup la suppression de l'arrière-plan ou l'agrandissement à plusieurs images choisies.

1. Dans la galerie, choisissez plusieurs images (clic en maintenant `Ctrl`, ou clic en maintenant `Shift` pour une sélection par plage).
2. Faites un clic droit sur les images choisies et choisissez **{{ui:gallery.menu.batch}}**.
3. Choisissez le traitement.
   - **{{ui:batch.op.removeBackground.title}}** : Rend l'arrière-plan transparent. L'extension ComfyUI-RMBG est nécessaire. Si elle n'est pas installée, un bouton d'installation apparaît.
   - **{{ui:batch.op.upscale.title}}** : Agrandit avec un modèle d'agrandissement. S'il n'y en a pas, installez-en un depuis l'écran des [modèles](08-models.md).
4. Appuyez sur **{{ui:batch.run}}**.

Chaque image entre dans la file d'attente comme un élément distinct. La progression se voit dans l'onglet **{{ui:app.tabs.queue}}**. Les résultats entrent comme nouvelles images dans la même planche que les images d'origine. Les images d'origine ne changent pas.

Pour traiter soigneusement une seule image en modifiant les réglages, utilisez les fonctions de ce chapitre (par exemple [Supprimer l'arrière-plan](#supprimer-l-arrière-plan)). Pour agrandir une seule image, vous pouvez aussi utiliser l'onglet de [mise à l'échelle](06-upscaling-workflows.md).
