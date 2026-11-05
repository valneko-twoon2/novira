# BD

![L'onglet BD en entier. À gauche, les mêmes réglages que pour la génération ; au centre, l'écran d'une BD vide](shot:comic)

**{{ui:app.tabs.comic}}** est l'établi où l'on crée des pages de BD. On l'ouvre avec la dernière icône à droite (l'icône de livre) de la rangée d'icônes tout en haut du panneau de gauche de l'onglet **{{ui:app.tabs.generate}}** (la touche `1` ouvre celui que vous avez utilisé en dernier). Une BD est regroupée en « projet ». On place des « pages » dans le projet, on divise les pages en « cases », et l'on dessine case par case. Une case peut recevoir, en plus des images dessinées, des images de la galerie et des poses. Une fois les bulles et les récitatifs placés, la page peut être enregistrée comme une seule image.

L'écran se divise en trois parties.

- À gauche : tout en haut, la rangée d'icônes (image, vidéo, etc. ; {{ui:app.tabs.comic}} est tout à droite), puis, de haut en bas, les {{ui:presets.label}} et {{ui:params.seed.label}} comme dans l'onglet {{ui:app.tabs.generate}}, le bouton de dessin, la liste des BD et {{ui:params.model.label}}. Le bouton de dessin est au même endroit que le bouton de génération des autres écrans ; le menu à flèche à côté permet de choisir de ne dessiner que la case sélectionnée ou toutes les cases de la page. En dessous se trouve le champ **{{ui:params.prompt.title}}**, qui contient le prompt de la case sélectionnée. Plus bas viennent le champ des images de référence (le même que dans l'onglet {{ui:app.tabs.generate}}, utilisé pour toutes les cases de la BD) et les réglages détaillés de la génération. Un clic sur le titre d'un réglage ouvre ou ferme ce champ.
- Au centre : {{ui:app.views.comic}}. La rangée d'outils du haut contient les réglages de la page, les modèles, l'outil de découpage des cases, les outils de case (bulles et récitatifs, pose, modèles de case), les outils d'image, la corbeille qui supprime ce qui est sélectionné et le bouton qui transforme la page en image. Sous la page se trouvent l'annulation et le rétablissement, les petites vignettes de chaque page et le niveau de zoom.
- À droite : deux onglets, **{{ui:comic.side.assistant}}** et **{{ui:comic.side.gallery}}**. Les images dessinées dans les cases entrent aussi dans la galerie.

## Créer une BD

![La liste des BD en haut à gauche. La vignette de la première page, le nom de la BD et le nombre de pages](shot:comic-project)

1. Ouvrez la liste des BD en haut à gauche, cliquez sur **{{ui:comic.project.new}}** tout en bas et donnez un nom. S'il n'y a aucune BD, **{{ui:comic.project.new}}** au centre permet aussi d'en créer une.
2. La page a d'emblée 3 cases. Pour ajouter des pages, cliquez sur **{{ui:comic.page.add}}** sous la page.
3. Cliquez sur la case à dessiner, sur la page, pour la sélectionner. Dans le champ **{{ui:params.prompt.title}}** à gauche, décrivez l'image de cette case, puis cliquez sur **{{ui:comic.panel.draw}}**.
4. Pour dessiner l'une après l'autre toutes les cases de la page, cliquez sur la flèche à côté du bouton de dessin, choisissez **{{ui:comic.page.drawAll}}**, puis cliquez sur le bouton de dessin. Les cases qui ont un prompt sont dessinées dans l'ordre.
5. Pour dessiner toutes les pages de la BD, choisissez **{{ui:comic.comic.drawAll}}** dans le même menu, puis cliquez sur le bouton de dessin. Les cases qui ont un prompt, sur toutes les pages, sont mises dans la file de dessin dans l'ordre de lecture.

La liste des BD affiche la vignette de la première page de chaque BD et son nombre de pages. Choisir une BD dans la liste l'ouvre. Pour renommer ou supprimer, utilisez le menu à droite de chaque ligne.

Pour créer une image, il faut avoir choisi un modèle. Une case dont le prompt est vide ne peut pas être dessinée. Les prompts sous forme de tags en anglais fonctionnent mieux. L'image dessinée entre dans la case, ainsi que dans la galerie. Pour une case qui n'a pas pu être dessinée, **{{ui:comic.draw.failed}}** s'affiche sur la page.

## Le prompt d'une case

Dans l'onglet BD, le champ **{{ui:params.prompt.title}}** de gauche devient le prompt de la case sélectionnée. Quand vous choisissez une autre case, le texte du champ est remplacé par celui de cette case. Chaque case possède un **{{ui:params.prompt.positive}}** et un **{{ui:params.prompt.negative}}**. Même si vous désélectionnez la case, le champ garde le prompt de la dernière case sélectionnée (ou de la première case de la page si aucune n'a été sélectionnée), et le bouton de dessin dessine aussi cette case.

Le champ s'utilise comme dans l'onglet {{ui:app.tabs.generate}}. Quand vous chargez des {{ui:presets.label}}, le prompt du préréglage entre dans la case sélectionnée. Les mots de **{{ui:params.promptBook.title}}** entrent aussi dans la case sélectionnée. Quand vous revenez à l'onglet {{ui:app.tabs.generate}}, le prompt que vous aviez écrit dans l'onglet {{ui:app.tabs.generate}} est rétabli tel qu'il était.

L'image d'une case est dessinée uniquement avec le prompt de cette case. Les prompts des autres cases et celui de l'onglet {{ui:app.tabs.generate}} n'y sont pas ajoutés.

La syntaxe des prompts dynamiques (accolades de combinaisons et jokers) est aussi utilisable. Avec **{{ui:params.prompt.modeRandom}}**, une image est dessinée avec la combinaison choisie par la seed de cette image. Avec **{{ui:params.prompt.modeCombinatorial}}**, les combinaisons sont dessinées une par une. La première entre dans la case, et les images des combinaisons restantes entrent dans la galerie (pas dans la case). Quand il y a plusieurs combinaisons, un avertissement le signale.

## Les réglages de la page

Un clic sur **{{ui:comic.page.settings}}**, en haut au centre, ouvre les réglages de la page.

Le nombre de cases de la page se change de 1 à 24 dans le champ **{{ui:comic.page.panelCount}}**. Quand le nombre change, le découpage de la page est refait automatiquement. Même une page dont vous avez modifié les formes à la main revient à la disposition automatique quand vous changez le nombre.

Le nombre de colonnes de la page se choisit de 1 à 3 avec **{{ui:comic.page.columns}}**. **{{ui:comic.page.direction}}** permet de choisir le sens de lecture des cases. Pour une BD, « de droite à gauche (manga) » est le sens habituel, et une nouvelle page commence donc dans ce sens. Si vous changez de sens, l'ordre des cases est inversé entre la gauche et la droite.

Si vous réduisez le nombre de cases, les dernières disparaissent. Les images des cases supprimées restent dans la galerie.

**{{ui:comic.effect.comic}}** et **{{ui:comic.effect.page}}** permettent d'appliquer un effet de finition à toute la page. Choisissez parmi **{{ui:comic.effect.mono}}**, **{{ui:comic.effect.ebook}}** (des tons proches du gris, comme du papier) et **{{ui:comic.effect.sepia}}**. Même si vous n'avez pas écrit « monochrome » en dessinant, vous pouvez appliquer ensuite le même effet à toutes les pages. Vous pouvez aussi choisir un effet différent pour chaque page. L'image elle-même ne change pas : l'effet s'applique seulement à l'affichage de la page et à son enregistrement en image, PDF, CBZ ou PSD.

Le format du manuscrit se choisit avec **{{ui:comic.page.size}}** : A4, A5, B4 ou B5. Le rapport hauteur/largeur de la page est celui de ce papier. L'image de la page enregistrée est dessinée à la taille du papier en 200 dpi (environ 1654 × 2339 px pour l'A4).

**{{ui:comic.page.frameWidth}}** permet de changer l'épaisseur du trait des cases de 0 mm à 3 mm (0,6 mm au départ). **{{ui:comic.page.inset}}** détermine la marge entre le trait et l'image, de 0 mm à 10 mm (0 mm au départ : l'image touche le trait). **{{ui:comic.page.margin}}** permet d'ajouter une marge blanche à l'extérieur du trait, de 0 mm à 10 mm (0 mm au départ : aucun bord blanc n'apparaît). **{{ui:comic.page.frameColor}}** permet de choisir la couleur du trait (noir au départ). Tous ces réglages s'appliquent de la même façon à toutes les cases de la page, et quand la page est transformée en image, elle est dessinée avec la même épaisseur, les mêmes marges et la même couleur.

## Changer de page et zoomer

Au centre, sous la page, s'alignent les petites vignettes de chaque page. Une vignette montre les cases et les images de la page, avec le numéro de la page en bas à droite. Un clic sur une vignette passe à cette page. La vignette de la page actuellement ouverte est entourée d'un cadre. Pour une BD qui se lit de droite à gauche (quand le sens de lecture de la première page est de droite à gauche), comme dans une BD imprimée, la première page se place à l'extrémité droite et les pages suivantes s'alignent de plus en plus à gauche (la flèche de gauche permet d'avancer vers les pages suivantes). Seules les pages qui tiennent dans l'espace s'alignent d'un coup (10 pages au maximum). Pour celles qui ne tiennent pas, les flèches gauche et droite (**{{ui:comic.page.prevGroup}}**, **{{ui:comic.page.nextGroup}}**) font défiler les vignettes des pages précédentes ou suivantes. Changer les vignettes avec les flèches ne change pas la page ouverte. **{{ui:comic.page.add}}** ajoute une page, et le bouton de corbeille supprime la page actuellement ouverte (cliquez une seconde fois pour confirmer).

La taille d'affichage de la page se change avec les boutons **{{ui:common.zoomIn}}** et **{{ui:common.zoomOut}}**, en bas à droite sous la page. Vous pouvez aussi zoomer et dézoomer autour du pointeur en tournant la molette de la souris tout en maintenant Ctrl. Un clic sur le chiffre du zoom revient à 100 %.

## Les modèles

![La liste des modèles de page. Les dispositions s'alignent en petits schémas](shot:comic-templates)

Un clic sur **{{ui:comic.template.pageTitle}}**, en haut au centre, ouvre la liste des modèles de page. Chaque modèle est présenté par un petit schéma de sa disposition. Un clic sur un schéma applique ce modèle à la page actuellement ouverte.

La liste contient les dispositions standard ({{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}} et {{ui:comic.template.builtin.nine}}, soit 5 types), des modèles de formes de cases (10 types, avec des coupes en biais ou des combinaisons de grandes et petites cases, par exemple) et les modèles que vous avez enregistrés. Les dispositions standard sont appliquées avec le sens de lecture et le format de manuscrit de cette page. Les modèles de formes de cases sont inversés entre la gauche et la droite pour s'accorder au sens de lecture de cette page. Les modèles enregistrés prennent le sens de lecture et le format de manuscrit qu'ils avaient à l'enregistrement. Quand le nombre de cases diminue, le texte sous le schéma devient **{{ui:comic.template.applyAgain}}**. Un second clic applique le modèle, et les images et bulles des dernières cases disparaissent.

Pour enregistrer la disposition de cette page, saisissez un nom sous la liste et cliquez sur **{{ui:comic.template.savePage}}**. Si le nom est vide, il devient « Modèle » suivi d'un numéro. Les modèles sont enregistrés dans ce projet.

Un modèle de case enregistre le prompt, le prompt négatif, la pose et les bulles de la case sélectionnée. L'image n'est pas enregistrée. Dans le champ qui s'ouvre avec **{{ui:comic.template.panelTitle}}**, en haut au centre, donnez un nom et cliquez sur **{{ui:comic.template.save}}**. Sur une autre case, un clic sur **{{ui:comic.template.apply}}** sur la ligne du modèle enregistré l'applique à cette case. Ce qui entre est le prompt, le prompt négatif, la pose et les bulles. L'image de la case reste.

## Changer la forme des cases

![Une page dont la forme des cases a été changée. La case du haut est coupée en biais, et les points des sommets apparaissent aux coins de la case sélectionnée](shot:comic-shapes)

La forme des cases peut aussi se changer à partir de la disposition standard. Cliquez sur **{{ui:comic.shape.cut}}**, en haut au centre, puis tracez une ligne d'un bord à l'autre de la case à couper : elle se divise en deux. Une ligne qui ne peut pas diviser la case en deux (une ligne qui passe hors de la case ou qui ne touche qu'un coin) ne la coupe pas.

Pour ajouter une case, cliquez sur **{{ui:comic.shape.addPanel}}**, à côté de **{{ui:comic.shape.cut}}**. Les cases existantes restent telles quelles, et une nouvelle case est posée en chevauchement vers le milieu de la page, puis sélectionnée. La page devient alors une page où les cases se placent librement (voir plus bas « Placer les cases librement »). Quand la page a déjà 24 cases, on ne peut plus en ajouter.

Pour supprimer une case, sélectionnez-la puis cliquez sur le bouton de corbeille (**{{ui:comic.shape.removePanel}}**) en haut au centre, ou appuyez sur la touche Suppr. L'image, le prompt et les bulles de cette case disparaissent avec elle. Si la page a une disposition automatique, les cases restantes sont réorganisées. Dans une page dont vous avez modifié les formes à la main, la case voisine la plus proche s'étend jusqu'à l'espace libéré, et son contenu reste tel quel. Si la forme empêche de fusionner avec un voisin, on revient à la disposition automatique. La dernière case d'une page ne peut pas être supprimée. Une case supprimée se récupère avec Ctrl+Z (l'opération qui remet une image dans la case n'est pas annulée).

Pour désélectionner une case, cliquez sur la marge de la page, sur un endroit vide autour de la page, ou sur un espace libre de la rangée d'outils. La touche Échap la désélectionne aussi. Dans une page où une image couvre toute la page, un clic sur la page en dehors des cases sélectionne cette image (voir « Placer une image sur toute la page »).

Des points ronds (les sommets) apparaissent aux coins de la case sélectionnée. En faisant glisser un sommet, vous changez la forme de la case. Un sommet en contact avec une case voisine bouge avec elle. Un double clic sur un côté ajoute un sommet, et un double clic supprime un sommet qui prolonge une ligne droite. Un sommet ne va pas à un endroit où les cases se chevaucheraient ou où des côtés se croiseraient.

Une petite barre (la poignée de côté) apparaît au milieu de chaque côté de la case sélectionnée. En la faisant glisser, ce côté bouge en entier, et la forme des cases voisines s'ajuste en conséquence. Elle ne va pas au-delà de la marge de la page.

Pour une page dont vous avez modifié les formes à la main, **{{ui:comic.shape.reset}}** dans **{{ui:comic.page.settings}}** revient à la disposition automatique. Changer le nombre de cases ou de colonnes revient aussi à la disposition automatique. Un changement de forme s'annule avec Ctrl+Z.

## Placer les cases librement

Sur n'importe quelle page, une case peut être déplacée où l'on veut en la faisant glisser n'importe où à l'intérieur (quelle que soit sa forme, on la déplace depuis l'endroit où l'on a cliqué). Si l'on clique sans la déplacer, la case est seulement sélectionnée. Une fois qu'une case a été déplacée, la page devient une page où les cases se placent librement. Chaque case prend une forme indépendante et ne partage plus ses côtés avec ses voisines. On peut faire se chevaucher les cases ou laisser des espaces. L'aspect d'avant le déplacement (la position des cases et les espaces blancs entre elles) reste tel quel.

Une case peut aussi dépasser en partie de la page. La partie qui dépasse est coupée à l'extérieur de la page, mais le centre de la case reste sur la page. Quand le curseur survole une case, il devient un curseur de déplacement ; sur un coin, il devient une croix, et sur un côté, une flèche orientée selon le côté. Quand vous faites glisser l'intérieur d'une case, c'est toujours la case entière qui bouge. Pour ne déplacer que l'image, faites glisser en maintenant la touche Alt, ou double-cliquez sur l'image pour la sélectionner, puis faites glisser la partie qui dépasse de la case. En faisant glisser la poignée ronde au-dessus de la case sélectionnée (**{{ui:comic.free.rotate}}**), on fait tourner la case à l'angle voulu. Avec la touche Maj, la rotation se fait par pas de 15 degrés. Dans une page à cases libres, les coins et les côtés d'une case ne déplacent que cette case, sans influencer les autres. Quand vous ajoutez une case, une case rectangulaire s'ajoute au milieu de la page. Quand vous supprimez une case, les cases voisines ne s'étendent pas. **{{ui:comic.shape.cut}}** est aussi utilisable, et les cases autour de la case coupée restent telles quelles.

Ce qui tourne, c'est le cadre de la case, et l'image reste droite, découpée par le cadre. L'angle de l'image se change séparément avec les outils d'image. Pour ramener la page à la disposition automatique, cliquez sur **{{ui:comic.shape.reset}}** dans **{{ui:comic.page.settings}}** (on peut revenir en arrière avec l'annulation).

Quand des cases se chevauchent, la dernière est au premier plan. Si vous sélectionnez une case puis cliquez sur **{{ui:comic.order.front}}**, **{{ui:comic.order.forward}}**, **{{ui:comic.order.backward}}** ou **{{ui:comic.order.back}}**, vous changez l'ordre de superposition. Cet ordre est aussi le numéro de la case (l'ordre de lecture) : en changeant l'ordre, on échange donc aussi les numéros.

Après avoir tourné, redimensionné ou déplacé des cases ou des images, **{{ui:comic.reset.title}}**, en haut au centre, permet de revenir en arrière. Vous pouvez remettre en l'état un par un la rotation de la case, la forme et la taille de la case, la rotation, la taille, la position et le retournement de l'image, ou tout remettre d'un coup avec **{{ui:comic.reset.all}}**. Si vous rétablissez la forme et la taille de la case, la case reprend la forme qu'elle avait dans la disposition automatique. Les opérations qui remettent l'image en l'état ne peuvent pas être annulées.

## Les images des cases

![Une image placée dans une case. Autour de l'image réduite et tournée, les quatre coins et la poignée du haut apparaissent](shot:comic-image)

L'image d'une case n'est pas forcément une image dessinée. Si vous faites glisser une image de la galerie sur une case, elle devient l'image de la case. Si vous sélectionnez une case puis cliquez sur **{{ui:comic.panel.imageUpload}}**, en haut au centre, vous pouvez choisir un fichier image de l'ordinateur. Le fichier entre d'abord dans la galerie, puis devient l'image de la case.

L'image d'une case se déplace directement sur la page, comme dans {{ui:app.tabs.canvas}}.

- Si vous cliquez sur l'image et faites glisser, c'est la case entière qui bouge. Pour ne déplacer que l'image, faites glisser en maintenant la touche Alt. Une partie de l'image peut aussi sortir de la case.
- Si vous double-cliquez sur l'image, ou cliquez en maintenant Alt, l'image est sélectionnée et un cadre en pointillés avec des poignées apparaît autour. La partie qui dépasse de la case est visible en transparence.
- En tournant la molette de la souris en maintenant Alt, l'image de la case située sous le pointeur est agrandie ou réduite autour de la position du pointeur.
- En faisant glisser les poignées des quatre coins, l'image est agrandie ou réduite autour de son centre.
- En faisant glisser la poignée ronde du haut, l'image tourne. Avec Maj, la rotation se fait par pas de 15°.
- Une image sélectionnée se déplace par petits pas avec les touches fléchées (avec Maj, par grands pas).
- Même si l'image est sortie de la case, vous pouvez la déplacer en faisant glisser le cadre en pointillés de l'image sélectionnée.

Les outils du haut au centre permettent aussi de modifier l'image. **{{ui:comic.image.fitCover}}** supprime la rotation de l'image et l'étire pour remplir la case. **{{ui:comic.image.fitContain}}** lui donne une taille qui fait tenir toute l'image dans la case. **{{ui:comic.image.rotateLeft}}** et **{{ui:comic.image.rotateRight}}** la font tourner de 90° à chaque fois, et **{{ui:comic.image.flipX}}** et **{{ui:comic.image.flipY}}** la retournent. **{{ui:comic.image.scaleDown}}** et **{{ui:comic.image.scaleUp}}** la réduisent et l'agrandissent petit à petit, et **{{ui:comic.image.center}}** ramène le centre de l'image au centre de la case.

Pour retirer l'image d'une case, sélectionnez-la et appuyez sur la touche Suppr, ou cliquez sur le bouton de corbeille en haut au centre (**{{ui:comic.panel.imageClear}}** quand une image est sélectionnée). Il n'y a qu'un bouton de corbeille : il supprime ce qui est sélectionné (une bulle, une image, une image de toute la page ou une case). Si vous placez le pointeur sur le bouton, ce qu'il va supprimer s'affiche. Même retirée, l'image reste dans la galerie. Si vous cliquez sur **{{ui:comic.history.undo}}** dans la notification qui s'affiche juste après le retrait, l'image revient à sa position et à sa taille d'origine. Quand vous avez mis une autre image, la position et la taille reviennent à celles d'origine.

Une case se souvient de ses images précédentes. Quand vous redessinez la case, mettez une autre image ou retirez l'image, les images précédentes restent dans l'**{{ui:comic.takes.title}}** de cette case (les 12 plus récentes, les plus récentes d'abord). Si vous sélectionnez une case puis cliquez sur **{{ui:comic.takes.title}}**, en haut au centre, l'image actuelle et les précédentes s'alignent. Un clic sur une image précédente la remet dans la case, à la position et à la taille où elle était placée (l'image actuelle entre dans l'historique). Même si vous en retirez une de la liste avec **{{ui:comic.takes.remove}}**, l'image reste dans la galerie. Les images supprimées de la galerie n'apparaissent pas. Comme pour les images, l'annulation ne modifie pas l'historique.

Vous pouvez aussi redessiner seulement une partie de l'image (quand une main ou un visage est déformé, par exemple). Sélectionnez une case qui contient une image, puis cliquez sur **{{ui:comic.fix.start}}** (le bouton en forme de pinceau), en haut au centre : une fine barre apparaît sur la page. Sur la case, peignez l'endroit à redessiner. La barre permet de changer **{{ui:comic.fix.brush}}**, et si vous avez trop peint, **{{ui:comic.fix.undoStroke}}** ou **{{ui:comic.fix.clear}}** revient en arrière. Dans le champ **{{ui:comic.fix.words}}**, écrivez en anglais ce qu'il faut dessiner à cet endroit (s'il est vide, c'est le prompt de la case qui est utilisé). Plus **{{ui:comic.fix.strength}}** est bas, plus le résultat reste proche de l'image d'origine. Quand vous cliquez sur **{{ui:comic.fix.go}}**, seul l'endroit peint est redessiné, et le reste demeure comme dans l'image d'origine. La nouvelle image entre dans la case, et l'image précédente reste dans l'**{{ui:comic.takes.title}}**. Les mots des personnages et les images de référence sont utilisés comme lorsqu'on dessine la case. Si vous choisissez une autre case, la zone peinte disparaît.

## Placer une image sur toute la page

Un clic sur **{{ui:comic.backdrop.title}}**, en haut au centre, permet de placer une image qui couvre toute la page. Cela sert pour une page à grande image, comme une double page, ou pour une page où l'on aligne des photos et des images. Une image de la galerie ou un fichier image de l'ordinateur peut aussi y entrer si on le dépose en dehors des cases de la page (sur une case, déposez-le en maintenant Alt). On peut aussi l'y mettre en le déposant dans ce champ ou en choisissant un fichier avec **{{ui:comic.panel.imageUpload}}**. L'image est placée derrière les cases, tout en bas de la page, et la partie qui dépasse de la page est coupée. À travers les cases qui n'ont pas d'image, on voit l'image du fond. Les traits des cases et les bulles sont dessinés par-dessus.

Un clic sur **{{ui:comic.backdrop.edit}}** fait apparaître sur la page le cadre de l'image. En faisant glisser n'importe quel endroit de l'image, on la déplace ; avec les ronds des quatre coins, on change sa taille ; avec le rond du haut, on la fait tourner à l'angle voulu (par pas de 15 degrés en maintenant Maj). Pendant ce temps, les cases ne sont pas manipulables. La touche Échap ou le choix d'une autre case y met fin. Les boutons du même champ permettent aussi d'ajuster à la page entière, de tout montrer, d'agrandir ou de réduire, de recentrer, de tourner de 90 degrés, de retourner à gauche-droite ou haut-bas, et de retirer l'image. La touche Suppr la retire aussi. On peut revenir en arrière avec **{{ui:comic.history.undo}}** dans la notification qui suit le retrait. Cette image est incluse quand la page est transformée en image, comme quand toutes les pages sont enregistrées dans un fichier.

Sur la page aussi, on peut manipuler cette image. Un clic sur la page en dehors des cases (les espaces entre les cases ou la marge de la page) sélectionne l'image et fait apparaître son cadre. Pendant qu'elle est sélectionnée, la touche Suppr ou le bouton de corbeille en haut au centre (**{{ui:comic.backdrop.clear}}**) la retire. Si vous déposez sur la page une image de la galerie ou un fichier pendant qu'elle est sélectionnée, elle est remplacée par cette image. En tournant la molette de la souris en maintenant Alt en dehors des cases, vous agrandissez ou réduisez autour de la position du pointeur.

## Choisir la pose

![L'écran du bonhomme en bâtons qui sert à choisir la pose d'une case](shot:comic-pose)

Sélectionnez une case, cliquez sur le bouton de pose, en haut au centre, pour ouvrir le champ, puis cliquez sur **{{ui:comic.panel.pose}}** : l'écran où l'on choisit la pose avec un bonhomme en bâtons s'ouvre. La pose est dessinée dans la forme de cette case, et un clic sur **{{ui:comic.pose.use}}** en fait la pose de la case. On peut rouvrir la pose pour la corriger. La pose choisie dans cet écran est celle d'une seule personne. Pour la retirer, cliquez sur **{{ui:comic.panel.poseRemove}}**.

![Le champ des poses prédéfinies à mettre dans une case. On choisit la catégorie et la pose](shot:comic-presets)

Dans le même champ, on peut aussi mettre l'une des poses prédéfinies, les mêmes que sur la toile. Choisissez une catégorie avec **{{ui:comic.panel.poseCategory}}**, une pose avec **{{ui:comic.panel.posePreset}}**, puis cliquez sur **{{ui:comic.panel.poseApply}}**. Un dessin du bonhomme en bâtons est créé à la taille de la case et devient la pose de la case. Selon la composition, plusieurs personnes sont alignées. Dans ce cas, elles entrent toutes dans la case.

Pour que la pose soit prise en compte dans l'image, il faut avoir installé un modèle ControlNet de pose (OpenPose, ou un modèle union). Pour un modèle union, on lui indique que le dessin est une pose avant de dessiner. S'il n'est pas installé, la pose n'est pas utilisée pour l'image et un avertissement l'indique.

## Placer avec un brouillon 3D

Sélectionnez une case et cliquez sur **{{ui:comic.rough.open}}** dans le champ de pose : un écran 3D, à la forme de la case, s'ouvre. Placez les personnes sous forme de poupées faites de cylindres et de boîtes, et le décor avec des boîtes, des plaques, des cylindres et un sol, en 3D. Vous choisissez aussi la direction, la distance et l'angle de vue de la caméra.

- En faisant glisser l'arrière-plan, on fait tourner la caméra. En faisant glisser avec Maj (ou avec le bouton droit), on la déplace ; avec la molette, on s'approche ou on s'éloigne.
- Dans le champ de droite, placez avec **{{ui:comic.rough.kind.person}}**, **{{ui:comic.rough.kind.box}}**, **{{ui:comic.rough.kind.plane}}** et **{{ui:comic.rough.kind.cylinder}}**. Une plaque est posée au fond, les autres sur le côté. Les personnes et les accessoires peuvent être déplacés sur le sol en les faisant glisser.
- Le champ de droite permet de changer l'orientation de l'objet sélectionné, sa hauteur au-dessus du sol et sa taille (largeur, hauteur, profondeur ; pour une personne, la taille est exprimée avec un adulte égal à 100). **{{ui:comic.rough.remove}}** le supprime.
- En faisant glisser les points de couleur d'une personne sélectionnée, on plie ses membres. En faisant glisser le point du cou, on déplace la personne entière.
- Les petites images en bas à droite sont la pose et la profondeur transmises à ControlNet.

Un clic sur **{{ui:comic.rough.apply}}** crée deux images à la taille de la case et les met dans la case. L'une est l'image de la pose vue depuis la caméra. Les articulations cachées, comme le visage d'une personne vue de dos ou les jambes cachées par un bureau, ne sont pas dessinées. L'autre est l'image de profondeur, où la perspective des objets est exprimée par la luminosité. Au dessin, en plus de la pose, l'image de profondeur est transmise à ControlNet, pour rapprocher les personnes et le décor de la disposition du brouillon 3D. La profondeur est réglée faible et n'agit que du début jusqu'à la moitié des étapes, car une valeur forte ferait dessiner telles quelles les formes des poupées et des boîtes.

Pour utiliser l'image de profondeur, il faut avoir installé un modèle ControlNet de profondeur (depth, ou un modèle union). S'il n'est pas installé, la profondeur n'est pas utilisée pour l'image et un avertissement l'indique.

Si, après avoir utilisé un brouillon 3D, vous changez la pose avec l'écran de pose, une pose prédéfinie ou l'agent, l'image de profondeur est retirée (car la position des personnes serait périmée). Le brouillon 3D lui-même reste dans la case. Quand vous le rouvrez, la caméra et les accessoires sont comme avant, et l'on repart avec la personne de la pose actuelle debout. Un clic sur **{{ui:comic.rough.apply}}** recrée aussi l'image de profondeur.

Quand la forme des cases change parce que vous avez changé le découpage ou la taille de la page, l'image de profondeur n'est pas non plus utilisée et un avertissement l'indique. Une image créée avec l'ancienne forme serait étirée et décalerait la position des personnes et du décor. Ouvrez le brouillon 3D et cliquez sur **{{ui:comic.rough.apply}}** pour la recréer avec la forme actuelle.

## Garder les personnages cohérents

Quand on dessine les cases une par une, les visages et les vêtements changent peu à peu. Pour limiter cela, enregistrez les personnages. Sélectionnez une case, cliquez sur le bouton **{{ui:comic.cast.title}}** des outils de case, en haut au centre, puis sur **{{ui:comic.cast.add}}**. La liste des personnages s'aligne en haut, et le champ du personnage dont vous avez cliqué le nom s'affiche en dessous (un à la fois). Donnez un nom, et écrivez dans le champ du dessous l'apparence sous forme de tags en anglais : le genre et le nombre, l'âge, les cheveux, les yeux, la couleur des vêtements, etc. (exemple : `1boy, old man, short white hair, flat cap, beige cardigan, blue shirt`). Le champ s'agrandit avec le texte, et tout est lisible. Pour les personnages qui apparaissent dans la case sélectionnée, cochez la case à côté du nom dans la liste. Quand cette case est dessinée, les tags des personnages cochés sont ajoutés tels quels avant le prompt. Dans le prompt, il suffit d'écrire ce qui change (la composition, le lieu, le mouvement). Un personnage non coché n'est pas ajouté à cette case. Si vous supprimez un personnage, il disparaît de toutes les cases.

Avec les mots seuls, les cheveux et les vêtements restent identiques, mais pas le visage. Un personnage peut donc aussi avoir une image de référence. Un clic sur **{{ui:comic.cast.refUse}}** fait de l'image de la case sélectionnée l'image de référence. **{{ui:comic.cast.refClear}}** la retire. Pour décider si cette image est utilisée avec IP-Adapter quand on dessine les cases, utilisez **{{ui:comic.draw.castReference.use}}** dans **{{ui:comic.draw.settings}}**. Par défaut, c'est désactivé, car avec IP-Adapter, le style de dessin se dégrade facilement, et le fond blanc ou la pose debout de l'image de référence passent facilement dans la case. Activé, l'image de référence est utilisée faiblement, seulement dans la première moitié du dessin, et l'échelle CFG n'est pas abaissée (un modèle IP-Adapter doit être installé). Quand c'est activé et que vous dessinez la page entière ou toute la BD, un personnage sans image de référence est d'abord dessiné seul, avec les mots seuls, sur un fond uni, et cette image devient son image de référence. Quand le modèle de l'onglet de génération est FLUX.2, quel que soit ce réglage, les images de référence sont transmises au modèle lui-même sans passer par IP-Adapter (jusqu'à 4 images par case). Dans ce cas, aucun modèle IP-Adapter n'est nécessaire.

Quand une case contient au moins deux personnages et possède une pose, « {{ui:comic.cast.posePerson}} » de la distribution permet de choisir, pour chacun, quelle personne de la pose il est. Une fois choisi, les mots d'apparence et l'image de référence de ce personnage n'agissent qu'autour de cette personne de la pose. Le visage et les vêtements passent moins facilement à un autre personnage (avec des modèles SD 1.5 ou SDXL). Si le nombre de personnes est le même que le nombre de personnages humains de la distribution, ils sont attribués dans l'ordre sans qu'il soit nécessaire de choisir. Les êtres sans pose, comme les créatures étranges ou les animaux, sont dessinés dans les places restantes.

L'apparence peut aussi s'écrire, en plus du champ des tags, en la répartissant dans des champs pour les cheveux, les yeux, les traits du visage, les vêtements, la silhouette et les accessoires. Quand on écrit par partie, seules les parties qui apparaissent dans l'image de cette case sont ajoutées au prompt. Si le prompt de la case contient close-up, ce sont les cheveux, les yeux, le visage et les accessoires ; avec upper body, on y ajoute les vêtements ; avec from behind, tout sauf les yeux et le visage. Si rien n'est écrit, on considère que le corps entier apparaît, et tout est ajouté. Pour une créature étrange ou un animal, cochez « {{ui:comic.cast.nonHuman}} » dans la distribution. Toutes les parties sont alors ajoutées quel que soit le cadrage, et l'image de référence est dessinée sans personnage.

Quand un personnage est lié à un personnage possédant une LoRA (l'enregistrement des personnages), lié dans une version précédente, la case où il apparaît seul est dessinée avec cette LoRA et ses mots d'appel. Dans une case où au moins deux personnages ont une LoRA, elle n'est pas utilisée, car les apparences se mélangeraient. Elle n'est pas non plus utilisée quand la LoRA est d'un autre type que le modèle de l'onglet de génération (SDXL et SD 1.5, par exemple) ou quand la LoRA du personnage est désactivée.

Quand l'agent crée une BD, il écrit aussi les personnages. Seuls les mots sont cohérents, et le visage n'est pas rigoureusement identique : de petites différences peuvent donc rester d'une case à l'autre.

## Garder les lieux cohérents

Quand on dessine les cases une par une, même pour une scène dans la même pièce, l'arrière-plan change d'une case à l'autre. Pour limiter cela, enregistrez les lieux. Sélectionnez une case, cliquez sur le bouton **{{ui:comic.place.title}}** des outils de case, en haut au centre, puis sur **{{ui:comic.place.add}}**. Le nouveau lieu devient le lieu de la case sélectionnée. Donnez un nom et écrivez dans **{{ui:comic.place.tags}}**, en tags anglais, quel est le lieu, les objets qui s'y trouvent, les couleurs et la lumière (exemple : `classroom, wooden desks, green chalkboard, large windows, afternoon sunlight`). Pour les autres cases, choisissez le lieu dans la liste **{{ui:comic.place.inPanel}}**. Quand cette case est dessinée, les mots du lieu sont ajoutés tels quels après le prompt. Les cases du même lieu sont plus facilement dessinées avec le même arrière-plan. Si vous corrigez les mots, cela agit sur toutes les cases de ce lieu. Pour un endroit dont la lumière diffère entre le jour et la nuit, enregistrez deux lieux distincts.

Quand l'agent crée une BD, il enregistre aussi les lieux et choisit un lieu pour chaque case.

## Demander à l'agent

Avec l'onglet **{{ui:comic.side.assistant}}** de la colonne de droite, vous pouvez confier à l'agent la BD ouverte. L'agent lit et écrit les personnages et les lieux de la BD, le découpage des pages, le prompt et la pose de chaque case, et les bulles. Il ne fait que ce qu'on lui demande, et ne dessine les images que quand on le lui demande.

Si vous lui demandez de regarder l'image d'une page déjà dessinée pour la corriger, l'agent regarde l'image de cette page. Comme l'image de la page est envoyée à l'IA choisie, la même confirmation que pour la lecture des images s'affiche avant (voir [L'agent et les paramètres](09-assistant-settings.md)). Si vous ne l'autorisez pas, il ne regarde pas cette page.

## Indications de scène

Pour chaque case, on peut noter la scène sous forme de texte. Comme les indications de scène d'un scénario, on y écrit le lieu, le moment et qui fait quoi. Sélectionnez une case, cliquez sur le bouton de note (**{{ui:comic.panel.note}}**), en haut au centre, pour ouvrir le champ, puis écrivez. Dans une case qui n'a pas encore d'image, l'indication de scène s'affiche en italique (une case sans indication de scène affiche son prompt). Les indications de scène ne servent pas à générer les images. Vous pouvez aussi les faire écrire par l'agent (voir [L'agent et les paramètres](09-assistant-settings.md)).

## Bulles et récitatifs

![Le champ des bulles et des récitatifs. Les types de bulles s'alignent en petits dessins fidèles à leur aspect](shot:comic-balloon-list)

Sélectionnez une case et cliquez sur **{{ui:comic.panel.bubbles}}**, en haut au centre, pour ouvrir le champ : les types de bulles s'alignent en petits dessins fidèles à leur aspect. Un clic sur un dessin ajoute une bulle de ce type à la case, et **{{ui:comic.bubble.editor}}** s'ouvre en se superposant au tableau de droite. Sous le champ, les bulles de la case sont listées avec leur type et leur réplique. Un clic sur une ligne sélectionne cette bulle, et le bouton en forme de crayon (**{{ui:comic.bubble.edit}}**) ouvre **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}, {{ui:comic.bubble.kind.rounded}}, {{ui:comic.bubble.kind.box}} : bulles ovale, rectangulaire à coins arrondis et rectangulaire, auxquelles on peut ajouter une queue.
- {{ui:comic.bubble.kind.thought}} : en forme de nuage, suivi de petits ronds au lieu d'une queue.
- {{ui:comic.bubble.preset.whisper}} : une ellipse en pointillés. Pour une petite voix ou un chuchotement.
- {{ui:comic.bubble.kind.shout}}, {{ui:comic.bubble.kind.explosion}} : bulles au bord à pointes. {{ui:comic.bubble.kind.explosion}} a de grandes pointes irrégulières.
- {{ui:comic.bubble.kind.wavy}}, {{ui:comic.bubble.kind.fuzzy}} : un bord ondulé et un bord fin comme des poils. Pour une voix faible ou un sentiment d'inquiétude.
- {{ui:comic.bubble.kind.electric}} : un cadre à nombreux angles, avec une queue en éclair. Pour la voix d'un téléphone, d'un haut-parleur ou d'une machine.
- {{ui:comic.bubble.kind.icicle}} : une bulle avec des glaçons qui pendent en bas. Pour une voix froide.
- {{ui:comic.bubble.kind.heart}} : une bulle en forme de cœur.
- {{ui:comic.bubble.kind.flash}} : des lignes noires rayonnantes se rassemblent autour de la réplique. Pour la surprise ou un cri du cœur.
- {{ui:comic.bubble.preset.dark}}, {{ui:comic.bubble.preset.double}} : une bulle peinte en noir (texte blanc) et une bulle à double trait.
- {{ui:comic.bubble.kind.caption}} : un cadre à angles, sans queue.
- {{ui:comic.bubble.kind.sfx}} : un texte d'effet sonore comme « BOUM » ou « MURMURE ». Il n'y a pas de cadre de bulle : ce sont de gros caractères noirs à bord blanc, qui commencent grands. **{{ui:comic.bubble.rotation}}** dans **{{ui:comic.bubble.editor}}** permet d'incliner le texte (de -90 à 90 degrés).
- {{ui:comic.bubble.kind.stamp}} : l'effet sonore est collé sous forme d'image plutôt que de texte. Vous choisissez parmi 114 images au total, dans 3 styles d'écriture (anguleux, pinceau tranchant et pinceau sec), avec 38 mots chacun comme « ドン », « ザワ » ou « ゴゴゴゴ ». La liste de **{{ui:comic.bubble.editor}}** se cherche par mot, lecture ou usage (par exemple : don, zawa, tension) et se filtre aussi par style d'écriture. La taille, l'inclinaison et la position se changent comme pour un effet sonore en texte, et l'image est conservée telle quelle dans la page enregistrée et dans le PSD. Les images sont libres d'usage, y compris commercial (CC0).
- {{ui:comic.bubble.kind.plain}} : du texte d'épaisseur normale, sans cadre. Un fin bord blanc le rend lisible même sur une image. L'inclinaison peut aussi se changer.

Les traits des bulles tremblent légèrement, comme dessinés à la main. Le tremblement est déterminé pour chaque bulle et ne change pas quand on la déplace ou qu'on la réécrit.

![Une bulle verticale et la poignée ronde au bout de la queue](shot:comic-tail)

Une bulle ajoutée est placée au milieu de la case. On place une bulle en la faisant glisser sur la page. Même quand l'image de la case est sélectionnée, si vous cliquez sur la bulle, seule la bulle bouge, pas la case ni l'image. Quand vous sélectionnez une bulle, elle est entourée d'un cadre bleu en pointillés, et les poignées de la case sont masquées. Une poignée ronde apparaît aussi au bout de la queue : en la faisant glisser, vous changez la direction et la longueur de la queue. Pour ajouter ou retirer la queue, cliquez sur **{{ui:comic.bubble.tail}}** dans **{{ui:comic.bubble.editor}}**.

![Une bulle vient d'être ajoutée. La modification de la bulle s'ouvre en se superposant au tableau de droite](shot:comic-balloon)

Un double clic sur une bulle de la page ouvre aussi **{{ui:comic.bubble.editor}}**. L'éditeur s'ouvre en se superposant au tableau, à droite de l'écran, et ne cache donc pas la page (quand le panneau de droite est fermé ou étroit, il s'ouvre au bord droit de la page). Vous pouvez y changer **{{ui:comic.bubble.kindLabel}}**, la réplique, **{{ui:comic.bubble.font}}**, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** et **{{ui:comic.bubble.tail}}**. La liste des types montre aussi chaque forme en petit dessin. Changer de type ne change ni la réplique ni la position. Pour fermer, cliquez sur la croix en haut à droite ou appuyez sur Échap. Même fermée, la bulle reste sélectionnée.

Avec **{{ui:comic.bubble.look}}**, vous pouvez changer ceci.

- **{{ui:comic.bubble.lineLabel}}** : choisissez parmi {{ui:comic.bubble.line.solid}}, {{ui:comic.bubble.line.dashed}}, {{ui:comic.bubble.line.double}} et {{ui:comic.bubble.line.none}}.
- **{{ui:comic.bubble.dark}}** : peint la bulle en noir et rend le texte blanc.
- **{{ui:comic.bubble.lineWidth}}** : l'épaisseur du trait (de 0,3 à 4 fois).
- **{{ui:comic.bubble.rough}}** : le tremblement du trait, comme dessiné à la main. À 0, le trait est comme tracé à la règle.
- **{{ui:comic.bubble.width}}**, **{{ui:comic.bubble.height}}** : la largeur et la hauteur de la bulle par rapport à la réplique (de 0,6 à 3 fois).
- **{{ui:comic.bubble.spikes}}**, **{{ui:comic.bubble.depth}}** : le nombre et la profondeur des pointes, des bosses de nuage, des ondulations, des poils, des angles, des glaçons et des lignes. Ils n'apparaissent que pour les types qui en ont.
- **{{ui:comic.bubble.tailWidth}}**, **{{ui:comic.bubble.tailCurve}}** : l'épaisseur de la base de la queue et sa courbure. Ils n'apparaissent que s'il y a une queue.

![Une bulle dont la forme est changée librement. Des points carrés s'alignent sur le contour, et l'un d'eux a été tiré pour changer la forme](shot:comic-balloon-shape)

La forme d'une bulle peut être changée librement. Un clic sur **{{ui:comic.bubble.shapeFreely}}** dans **{{ui:comic.bubble.outline}}** aligne des points carrés sur le contour de la bulle. En faisant glisser un point, on déplace le contour à cet endroit. Un double clic sur un point le supprime (il n'en reste jamais moins de trois), et un double clic sur la bulle ajoute un point sur le contour proche. Les pointes, les bosses de nuage, etc. suivent le contour modifié. **{{ui:comic.bubble.smooth}}** fait basculer entre relier les points par une courbe ou par des lignes droites. **{{ui:comic.bubble.shapeReset}}** revient à la forme d'origine de ce type. Un nouveau clic sur **{{ui:comic.bubble.shapeFreely}}** fait disparaître les points.

On peut mettre une partie de la réplique en gras ou y ajouter des points d'emphase (des points à côté des caractères). Dans le champ, sélectionnez les caractères et cliquez sur **{{ui:comic.bubble.bold}}** ou **{{ui:comic.bubble.dots}}** pour l'appliquer ; sélectionnez les mêmes caractères et cliquez de nouveau pour le retirer. Dans le champ, le gras s'affiche `**texte**` et les points d'emphase `《《texte》》`, et les saisir directement donne le même résultat. Sur la page, les points d'emphase d'un texte horizontal se placent au-dessus des caractères, et ceux d'un texte vertical à leur droite.

Avec **{{ui:comic.bubble.font}}**, vous pouvez choisir parmi les polices de l'application et celles installées sur cet ordinateur. Chaque nom s'affiche dans sa propre police. Si vous choisissez **{{ui:comic.bubble.fontDefault}}**, c'est **{{ui:settings.comicFont.label}}** des paramètres qui est utilisé (voir [L'agent et les paramètres](09-assistant-settings.md)). La taille du texte se change de 40 % à 400 % avec le curseur **{{ui:comic.bubble.size}}**. Un clic sur **{{ui:comic.bubble.vertical}}** met le texte en écriture verticale, les caractères s'alignant de la droite vers le bas. Le texte vertical passe à la colonne suivante à la hauteur de la bulle.

Quand le texte dépasse de la bulle, un cadre rouge en pointillés apparaît autour de la bulle. **{{ui:comic.bubble.fitHelp}}** (le bouton **{{ui:comic.bubble.fit}}**). Après la réduction, la position est aussi corrigée pour que la forme de la bulle tienne dans la case. Les bulles placées par l'agent sont ajustées automatiquement de cette façon.

Ce qui n'est plus nécessaire se supprime avec la corbeille de la ligne du champ, ou avec **{{ui:comic.bubble.remove}}** dans **{{ui:comic.bubble.editor}}**. On peut aussi sélectionner une bulle sur la page et appuyer sur la touche Suppr, ou cliquer sur le bouton de corbeille en haut au centre.

## Calques

Les calques de la page s'affichent toujours, sous les onglets de la colonne de droite (**{{ui:comic.side.assistant}}** et **{{ui:comic.side.gallery}}**), sous forme de la liste **{{ui:canvas.layers.title}}**. Ce sont les mêmes que les calques de l'onglet {{ui:app.tabs.canvas}}. Dès le départ, une page possède deux calques : **{{ui:comic.layers.panels}}** (les traits et les images des cases) et **{{ui:comic.layers.balloons}}** (toutes les bulles et tous les récitatifs). Plus un calque est haut dans la liste, plus il est dessiné au premier plan. Le menu d'ajout (plus) permet d'ajouter vos propres **{{ui:canvas.add.raster}}** et **{{ui:canvas.add.inpaint}}**. Une page peut contenir jusqu'à 32 calques (y compris {{ui:comic.layers.panels}} et {{ui:comic.layers.balloons}}), jusqu'à 8 masques, et un calque peut recevoir jusqu'à 5000 éléments dessinés. À l'approche de la limite, un avertissement s'affiche.

Le bouton en forme d'œil d'une ligne bascule l'affichage et le masquage, et le bouton en forme de cadenas bascule le verrouillage. Un calque masqué n'est dessiné ni sur la page ni quand la page est transformée en image. Quand vous sélectionnez une ligne, vous pouvez changer **{{ui:canvas.entity.opacity}}** et **{{ui:canvas.entity.blend}}** ({{ui:canvas.entity.blend.normal}}, {{ui:canvas.entity.blend.multiply}}, {{ui:canvas.entity.blend.screen}}). Les lignes se réordonnent par glisser-déposer ou avec le menu du clic droit : placé sous **{{ui:comic.layers.panels}}**, un calque devient un dessin de base posé sous les images des cases, et placé au-dessus de **{{ui:comic.layers.balloons}}**, il se superpose aux bulles. Les calques {{ui:comic.layers.panels}} et {{ui:comic.layers.balloons}} peuvent être réordonnés ou masqués, mais pas supprimés ni dessinés. Les masques n'entrent ni dans l'image de la page ni dans le PSD.

## Dessiner sur la page

Avec le commutateur en haut au centre, passez de **{{ui:comic.paint.page}}** à **{{ui:comic.paint.paint}}**. En mode peinture, on ne peut plus manipuler les cases ni les bulles, et vous dessinez sur le **{{ui:canvas.add.raster}}** choisi avec les mêmes outils que dans l'onglet {{ui:app.tabs.canvas}} ({{ui:canvas.tool.brush}}, {{ui:canvas.tool.eraser}}, {{ui:canvas.tool.mosaic}}, {{ui:canvas.tool.rect}}, {{ui:canvas.tool.lasso}}, {{ui:canvas.tool.move}}, {{ui:canvas.tool.bbox}}, {{ui:canvas.tool.colorPicker}}, {{ui:canvas.tool.bucket}}). Choisir dans la liste la ligne d'un calque raster lance aussi la peinture, et choisir la ligne {{ui:comic.layers.panels}} ou {{ui:comic.layers.balloons}}, ou appuyer sur la touche Échap, ramène aux opérations sur la page. On revient aussi à la page quand on ouvre une autre page ou quand on quitte l'écran de la BD.

{{ui:canvas.tool.bucket}} remplit la zone de couleur proche de l'endroit où vous cliquez (**{{ui:canvas.toolbar.bucketTolerance}}** détermine jusqu'où une couleur est considérée comme proche). Avec le bouton **{{ui:canvas.toolbar.filter}}**, vous pouvez appliquer {{ui:canvas.rasterFilter.blur}}, {{ui:canvas.rasterFilter.grayscale}} ou {{ui:canvas.rasterFilter.invert}} à l'image du calque raster sélectionné. Dans les deux cas, on revient en arrière avec l'annulation en cours de peinture (l'annulation et le rétablissement des outils de peinture). Ctrl+Z pendant la peinture annule les calques de cette page. L'annulation de l'ensemble de la BD ne rétablit pas les calques.

Pour ne redessiner qu'une partie de la page, ajoutez un {{ui:canvas.add.inpaint}}, peignez le masque, déterminez avec {{ui:canvas.tool.bbox}} la zone à générer (elle ne peut pas sortir de la page), puis cliquez sur **{{ui:comic.inpaint.run}}** dans la rangée d'outils de peinture. S'il n'y a pas de masque, un message vous demande d'abord d'en peindre un. Le résultat attend dans la barre d'adoption qui s'affiche sur cette page, et **{{ui:canvas.staging.accept}}** le met dans un nouveau calque raster. S'il arrive pendant que vous regardez une autre page, un message le signale, et vous pouvez l'adopter en passant la page d'origine en mode peinture.

## Les réglages de génération

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} et {{ui:params.hires.title}} sont les mêmes que dans l'onglet {{ui:app.tabs.generate}}. Si vous changez les réglages de gauche, ils agissent aussi de la même façon dans l'onglet {{ui:app.tabs.generate}}. Seul le prompt est distinct pour chaque case (voir « Le prompt d'une case »).

Une case reçoit une seule image. La taille de l'image est donc déterminée par la taille de la case, et non par les réglages de l'onglet {{ui:app.tabs.generate}}. Le champ du nombre de générations n'apparaît pas dans la BD.

Dans **{{ui:comic.draw.settings}}**, dans la colonne de gauche, il y a aussi des champs propres à la BD. **{{ui:comic.draw.style.title}}** contient les mots de qualité placés au début du prompt de toutes les cases et le prompt négatif commun à toutes les cases. Si vous ajoutez aux mots de qualité vos tags habituels d'artiste ou de style, le style de dessin de toutes les cases s'uniformise. Quand le champ est vide, des mots par défaut adaptés au modèle sont ajoutés. Le prompt négatif par défaut ne contient pas de mots qui suppriment la couleur. Pour obtenir du noir et blanc, utilisez l'effet de la page. **{{ui:comic.draw.castReference.title}}** détermine si l'image de référence d'un personnage est utilisée avec IP-Adapter, et avec quelle intensité (voir « Garder les personnages cohérents »).

## Transformer la page en une image

Un clic sur **{{ui:comic.page.export}}**, en haut au centre, transforme cette page en une image (PNG) et l'enregistre dans la galerie. Les images des cases ainsi que le texte des bulles et des récitatifs y sont dessinés. Les images des cases sont dessinées avec la position, la taille, la rotation et le retournement qu'elles ont sur la page. Les bulles sont dessinées avec la même forme, le même trait et le même tremblement que sur la page. Le texte est dessiné avec les polices présentes dans Windows, comme celles du japonais. Les calques sont dessinés dans l'ordre de superposition, avec leur opacité et leur mode de fusion, et les calques masqués n'y figurent pas. La taille de l'image est dessinée en 200 dpi selon le format du manuscrit.

Un clic sur **{{ui:comic.page.psd}}** transforme cette page en un fichier PSD à calques et l'enregistre comme un téléchargement du navigateur. De bas en haut, on y trouve le papier blanc, l'image de toute la page, les images des cases (découpées à la forme de la case ; une case sans image est grise), tous les traits des cases et un calque par bulle. Ceux-ci et les calques que vous avez ajoutés sont placés dans l'ordre des calques de la page, avec leur opacité, leur mode de fusion et leur état affiché ou masqué. Le texte des bulles étant dessiné comme une image, on ne peut pas le retaper dans le PSD. L'effet appliqué à la page s'applique aussi à chacun des calques. Le nom du fichier est le nom de la BD suivi du numéro de la page.

## Mettre toutes les pages dans un seul fichier

Un clic sur **{{ui:comic.book.export}}**, en haut au centre, permet d'enregistrer toutes les pages de la BD dans un seul fichier. **{{ui:comic.book.pdf}}** crée un PDF adapté à l'impression et au partage, **{{ui:comic.book.cbz}}** un CBZ lisible dans une visionneuse de BD, et **{{ui:comic.book.psd}}** un ZIP qui regroupe les PSD de chaque page. Les pages sont incluses dans l'ordre où elles sont alignées, et le nom du fichier est le nom de la BD. Le fichier est enregistré comme un téléchargement du navigateur. Quand il y a beaucoup de pages, l'exportation prend un peu de temps.

Chaque page du PDF est une image unique au format du manuscrit. Si la première page est réglée pour une lecture de droite à gauche, le PDF s'ouvre aussi comme un livre qui se lit de droite à gauche. Le CBZ est une suite de PNG, une image par page, dans l'ordre. Les PSD dans le ZIP ont les mêmes calques que **{{ui:comic.page.psd}}** et sont numérotés dans l'ordre des pages.

## Annuler et rétablir

Un clic sur **{{ui:comic.history.undo}}**, en bas à gauche sous la page, annule le dernier changement. Un changement annulé se rétablit avec **{{ui:comic.history.redo}}**. Au clavier, Ctrl+Z annule et Ctrl+Maj+Z (ou Ctrl+Y) rétablit (sur Mac, Commande remplace Ctrl). Ce qui est annulé : la disposition de la page et l'ordre des cases (y compris la forme des cases), le prompt et la pose des cases, et les bulles. Les calques se rétablissent avec l'annulation en cours de peinture (voir « Dessiner sur la page »). Les images des cases (mise en place, retrait, déplacement), les modèles et le nom de la BD ne sont pas annulés. Un texte écrit de suite dans le même champ est annulé en un seul changement. Quand le curseur est dans un champ de texte, Ctrl+Z annule le texte de ce champ.

## Enregistrement et suppression

Une BD est enregistrée automatiquement environ 1 seconde après un changement. Même si vous fermez et rouvrez l'application, le projet enregistré reste dans la liste, avec ses pages, ses cases, ses bulles et ses modèles. Il est aussi inclus dans la sauvegarde.

Pour supprimer un projet, ouvrez le menu de sa ligne dans la liste des BD, cliquez sur **{{ui:comic.project.delete}}**, puis cliquez de nouveau pour confirmer. Quand un projet est supprimé, ses pages, ses cases et ses modèles disparaissent. Les images dessinées restent dans la galerie.

Pour supprimer une page, cliquez sur le bouton de corbeille sous la page (**{{ui:comic.page.delete}}**), puis cliquez de nouveau pour confirmer. Les cases et les bulles de la page disparaissent, mais les images dessinées restent dans la galerie.

## Utiliser les images dessinées

Les images dessinées sont des images ordinaires de la galerie. Les opérations qui utilisent les images de la galerie dans d'autres écrans, comme les faire glisser dans {{ui:app.tabs.canvas}}, restent utilisables telles quelles.
