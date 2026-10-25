# BD

![L'onglet BD dans son ensemble. À gauche, les mêmes réglages que dans l'onglet Générer ; au centre, une page de BD vide](shot:comic)

**{{ui:app.tabs.comic}}** est l'établi pour créer des pages de BD. Dans la rangée d'icônes en haut du panneau de gauche de l'onglet {{ui:app.tabs.generate}}, appuyez sur l'icône la plus à droite, un livre, pour l'ouvrir (la touche 3 l'ouvre aussi). Les BD sont rangées dans des projets. Un projet contient des pages, chaque page est divisée en cases, et vous dessinez une image pour chaque case. Une case peut recevoir, en plus de l'image dessinée, une image de la galerie ou une pose. En plaçant des bulles et des récitatifs, vous pouvez enregistrer la page en une seule image.

L'écran se divise en trois parties.

- À gauche : de haut en bas, {{ui:presets.label}} et {{ui:params.seed.label}} comme dans l'onglet {{ui:app.tabs.generate}}, la liste des BD et {{ui:params.model.label}}. En dessous se trouve la section **{{ui:params.prompt.title}}**, qui contient les prompts de la case sélectionnée. Plus bas viennent le bouton qui dessine la case sélectionnée et le bouton qui dessine toutes les cases, la section de l'image de référence, puis les réglages de génération détaillés. En cliquant sur le titre d'un réglage, vous pouvez ouvrir ou fermer sa section.
- Au centre : {{ui:app.views.comic}}. La barre d'outils du haut contient les réglages de la page, les modèles, l'outil pour couper les cases, les outils de case (bulles et textes de narration, pose, modèles de case), les outils d'image et le bouton qui transforme la page en image. Sous la page se trouvent l'annulation et le rétablissement, le changement de page et le facteur de zoom.
- À droite : la galerie. Les images dessinées dans les cases entrent aussi dans la galerie.

## Créer une BD

![La liste des BD en haut à gauche. Une miniature de la première page, le nom de la BD et le nombre de pages](shot:comic-project)

1. Ouvrez la liste des BD en haut à gauche, cliquez sur **{{ui:comic.project.new}}** tout en bas et donnez un nom. S'il n'y a encore aucune BD, vous pouvez aussi en créer une avec **{{ui:comic.project.new}}** au centre.
2. La page commence avec 3 cases. Pour ajouter une page, cliquez sur **{{ui:comic.page.add}}** sous la page.
3. Cliquez sur la case que vous voulez dessiner, sur la page, pour la sélectionner. À gauche, dans la section **{{ui:params.prompt.title}}**, écrivez la description de son image, puis cliquez sur **{{ui:comic.panel.draw}}**.
4. Pour dessiner toutes les cases de la page dans l'ordre, cliquez sur **{{ui:comic.page.drawAll}}**, à côté de **{{ui:comic.panel.draw}}**.

La liste des BD affiche, pour chaque BD, une miniature de sa première page et le nombre de pages. Sélectionnez une BD dans la liste pour l'ouvrir. Pour la renommer ou la supprimer, utilisez le menu à droite de chaque ligne.

Pour créer une image, un modèle doit être choisi. Une case dont le prompt est vide ne peut pas être dessinée. Le prompt marche mieux écrit en balises anglaises. L'image dessinée entre dans cette case et aussi dans la galerie. Une case qui n'a pas pu être dessinée affiche **{{ui:comic.draw.failed}}** sur la page.

## Les prompts de la case

Dans l'onglet BD, la section **{{ui:params.prompt.title}}** à gauche contient les prompts de la case sélectionnée. Quand vous sélectionnez une autre case, le texte de la section devient celui de cette case. Chaque case a une paire **{{ui:params.prompt.positive}}** et **{{ui:params.prompt.negative}}**. Dans l'onglet BD, une case est toujours sélectionnée.

La section s'utilise comme dans l'onglet {{ui:app.tabs.generate}}. Quand vous chargez un {{ui:presets.label}}, ses prompts entrent dans la case sélectionnée. La **{{ui:params.promptBook.title}}** et les préréglages de prompt entrent aussi dans la case sélectionnée. Quand vous revenez à l'onglet {{ui:app.tabs.generate}}, les prompts que vous aviez écrits dans l'onglet {{ui:app.tabs.generate}} réapparaissent tels quels.

L'image d'une case est dessinée avec les seuls prompts de cette case. Les prompts des autres cases et ceux de l'onglet {{ui:app.tabs.generate}} ne sont pas ajoutés.

La syntaxe des prompts dynamiques (les accolades de combinaison et les wildcards) fonctionne aussi dans la BD. Avec **{{ui:params.prompt.modeRandom}}**, la combinaison est choisie selon la seed de l'image de la case, et une seule image est dessinée. Avec **{{ui:params.prompt.modeCombinatorial}}**, les combinaisons sont dessinées une par une. La première combinaison entre dans la case, et les images des autres combinaisons vont seulement dans la galerie (elles n'entrent pas dans la case) ; lorsqu'il y en a plusieurs, un avertissement le signale.

## Réglages de la page

Cliquez sur **{{ui:comic.page.settings}}** en haut au centre pour ouvrir les réglages de la page.

Le nombre de cases de la page se règle de 1 à 24 dans le champ **{{ui:comic.page.panelCount}}**. Quand vous changez ce nombre, la mise en page de la page est refaite automatiquement. Une page dont la forme des cases a été modifiée à la main revient aussi à la mise en page automatique quand le nombre change.

Le nombre de colonnes de la page se choisit de 1 à 3 avec **{{ui:comic.page.columns}}**. Avec **{{ui:comic.page.direction}}**, vous choisissez le sens de lecture des cases. Un manga se lit normalement « De droite à gauche (manga) », donc une nouvelle page commence dans ce sens. Quand vous changez de sens, l'ordre des cases s'inverse entre la gauche et la droite.

Si vous réduisez le nombre de cases, les dernières cases disparaissent. Les images des cases supprimées restent dans la galerie.

Le papier se choisit avec **{{ui:comic.page.size}}** : A4, A5, B4 ou B5. Les proportions de la page sont celles de ce papier. L'image enregistrée de la page correspond à la taille du papier à 200 dpi (A4 : environ 1654 × 2339 px).

**{{ui:comic.page.frameWidth}}** règle l'épaisseur des traits du cadre des cases, de 0 mm à 3 mm (0,6 mm au départ). **{{ui:comic.page.inset}}** règle l'espace entre le trait du cadre et l'image, de 0 mm à 10 mm (0 mm au départ : l'image touche le trait). Ces deux réglages valent pour toutes les cases de la page, et l'image de la page enregistrée est dessinée avec la même épaisseur et le même espace.

## Changer de page et zoomer

Sous la page, au milieu, se trouvent les boutons des numéros de page. Cliquez sur un numéro ou sur les flèches gauche et droite pour passer à une autre page. **{{ui:comic.page.add}}** ajoute une page, et le bouton corbeille supprime la page ouverte (cliquez à nouveau pour confirmer). Même quand les pages se multiplient, les boutons des numéros restent sur une seule ligne, et ceux qui ne tiennent pas défilent horizontalement. Le numéro de la page ouverte vient se placer dans la partie visible.

La taille d'affichage de la page se modifie avec les boutons **{{ui:common.zoomIn}}** et **{{ui:common.zoomOut}}**, sous la page à droite. Vous pouvez aussi tourner la molette de la souris en maintenant Ctrl pour zoomer autour de la position du pointeur. Cliquez sur le nombre du facteur de zoom pour revenir à 100 %.

## Modèles de page et de case

![La liste des modèles de page. Les dispositions s'affichent en petits dessins](shot:comic-templates)

Cliquez sur **{{ui:comic.template.pageTitle}}** en haut au centre pour ouvrir la liste des modèles de page. Chaque modèle s'affiche comme un petit dessin de sa disposition. Cliquez sur un dessin pour appliquer ce modèle à la page ouverte.

La liste comprend les 5 dispositions standard, à savoir {{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}} et {{ui:comic.template.builtin.nine}}, les modèles de forme de cases (dix au total, avec des coupes obliques et des combinaisons de grandes et de petites cases), ainsi que les modèles enregistrés. La disposition standard s'applique avec le sens de lecture et le format du papier actuels de la page. Un modèle de forme applique le sens de lecture de cette page, et ses cases sont retournées pour s'y accorder. Un modèle enregistré reprend le sens de lecture et le format du papier qu'il avait lors de son enregistrement. Si le nombre de cases diminue, le texte sous le dessin devient **{{ui:comic.template.applyAgain}}**. Un nouveau clic applique le modèle, et les images et les bulles des dernières cases sont alors supprimées.

Pour enregistrer la disposition de cette page, saisissez un nom sous la liste, puis cliquez sur **{{ui:comic.template.savePage}}**. Si le nom est vide, le modèle reçoit le nom « Modèle » suivi d'un numéro. Les modèles sont enregistrés dans ce projet.

Un modèle de case enregistre le prompt, le prompt négatif, la pose, les bulles et l'image de référence de la case sélectionnée. Il n'enregistre pas l'image de la case. Dans la section qui s'ouvre en cliquant sur **{{ui:comic.template.panelTitle}}** en haut au centre, donnez-lui un nom, puis cliquez sur **{{ui:comic.template.save}}**. Dans une autre case, cliquez sur **{{ui:comic.template.apply}}** sur la ligne du modèle enregistré : il entre dans cette case. Ce qui entre, ce sont le prompt, le prompt négatif, la pose, les bulles et l'image de référence. L'image de cette case reste en place.

## Changer la forme des cases

![Page aux cases remodelées : la case du haut est coupée en diagonale, et les sommets de la case sélectionnée apparaissent en points](shot:comic-shapes)

La forme des cases peut être modifiée à la main, même quand la page a la mise en page automatique. Cliquez sur **{{ui:comic.shape.cut}}**, en haut au centre, puis tracez une ligne sur une case d'un bord à l'autre : la case est coupée en deux. Une ligne qui ne coupe pas la case en deux (une ligne hors de la case, ou une ligne qui ne fait que toucher un angle) ne coupe rien.

Pour ajouter une case, cliquez sur **{{ui:comic.shape.addPanel}}**, à côté de **{{ui:comic.shape.cut}}**. La case sélectionnée (ou la plus grande case si aucune n'est sélectionnée) est coupée en deux par une ligne qui partage en deux son côté le plus long, et la nouvelle case est sélectionnée. On ne peut pas ajouter de case quand la page en compte déjà 24, ni quand la case est trop petite.

Pour supprimer une case, sélectionnez-la et cliquez sur **{{ui:comic.shape.removePanel}}**. Son image, ses prompts et ses bulles disparaissent avec elle. Avec la mise en page automatique, les cases restantes sont de nouveau disposées. Sur une page dont la forme des cases a été modifiée à la main, la case voisine la plus proche s'agrandit dans l'espace libéré et garde son propre contenu ; si la forme ne permet pas cette fusion, la page revient à la mise en page automatique. La dernière case d'une page ne peut pas être supprimée. Une case supprimée peut être rétablie avec Ctrl+Z (le fait de remettre une image dans une case n'est pas annulé).

Pour désélectionner la case, cliquez sur la marge de la page ou sur n'importe quel endroit vide autour de la page.

La case sélectionnée montre ses angles sous forme de points ronds. Faites glisser un angle pour changer la forme de la case. Un angle partagé avec une case voisine bouge avec elle. Double-cliquez sur un bord pour ajouter un angle, et double-cliquez sur un angle droit pour le supprimer. Un angle ne se déplace pas vers un endroit où les cases se chevaucheraient, ni où un bord couperait un autre bord.

Au milieu de chaque bord de la case sélectionnée apparaît une petite barre (la poignée du bord). En faisant glisser la poignée, on déplace tout le bord, et les cases voisines changent de forme avec lui. Un bord ne se déplace pas au-delà de la marge de la page.

Sur une page dont la forme des cases a été modifiée à la main, cliquez sur **{{ui:comic.shape.reset}}** dans **{{ui:comic.page.settings}}** pour revenir à la mise en page automatique. Changer le nombre de cases ou de colonnes revient aussi à la mise en page automatique. Ctrl+Z annule une modification de forme.

## Les images des cases

![Une image dans une case. Autour de l'image réduite et tournée apparaissent les poignées des quatre coins et celle du haut](shot:comic-image)

L'image d'une case ne se limite pas aux images dessinées. Si vous faites glisser une image de la galerie sur une case, cette image devient l'image de la case. Sélectionnez une case et cliquez sur **{{ui:comic.panel.imageUpload}}** en haut au centre pour prendre un fichier image sur votre ordinateur. Le fichier entre d'abord dans la galerie, puis devient l'image de la case.

L'image d'une case se manipule directement sur la page, comme sur la {{ui:app.tabs.canvas}}.

- Faites glisser l'image pour la déplacer. Une partie de l'image peut dépasser de la case.
- Cliquez sur l'image pour la sélectionner : un cadre en pointillés et des poignées apparaissent autour. La partie qui dépasse de la case reste visible en transparence.
- Faites glisser une poignée d'angle pour agrandir ou réduire l'image autour de son centre.
- Faites glisser la poignée ronde du haut pour faire tourner l'image. En maintenant Maj, elle tourne par pas de 15°.
- L'image sélectionnée se déplace petit à petit avec les touches fléchées (avec Maj, elle se déplace davantage).

Les outils en haut au centre modifient aussi l'image. **{{ui:comic.image.fitCover}}** annule la rotation et étend l'image à toute la case. **{{ui:comic.image.fitContain}}** ajuste l'image pour qu'elle tienne entière dans la case. **{{ui:comic.image.rotateLeft}}** et **{{ui:comic.image.rotateRight}}** la font tourner de 90°, et **{{ui:comic.image.flipX}}** et **{{ui:comic.image.flipY}}** la retournent. **{{ui:comic.image.scaleDown}}** et **{{ui:comic.image.scaleUp}}** la réduisent et l'agrandissent petit à petit, et **{{ui:comic.image.center}}** amène le centre de l'image au centre de la case.

Pour retirer l'image d'une case, sélectionnez-la et appuyez sur la touche Suppr, ou cliquez sur **{{ui:comic.panel.imageClear}}** en haut au centre. Même retirée, l'image reste dans la galerie. Si vous cliquez sur **{{ui:comic.history.undo}}** dans la notification qui apparaît juste après, l'image revient avec sa position et sa taille d'avant. Quand vous mettez une autre image, la position et la taille reviennent à leur état initial.

## Échanger des cases

Prenez la poignée à six points (⠿) en haut à gauche de la case, faites-la glisser jusqu'à la case à échanger, puis relâchez : les deux cases changent de place. L'image, les prompts, la pose et les bulles de la case se déplacent avec elle.

Dès que vous appuyez sur la poignée et commencez à la déplacer, une copie semi-transparente de la case en mouvement suit le pointeur. La case de destination est signalée par un cadre.

## Définir la pose

![L'écran du bonhomme bâton pour fixer la pose d'une case](shot:comic-pose)

Sélectionnez une case, cliquez sur le bouton de pose en haut au centre pour ouvrir sa section, puis cliquez sur **{{ui:comic.panel.pose}}** pour ouvrir l'écran où la pose se règle avec un bonhomme bâton. La pose est dessinée selon la forme de la case. En cliquant sur **{{ui:comic.pose.use}}**, elle devient la pose de cette case. Vous pouvez rouvrir l'écran pour la corriger. La pose définie sur cet écran concerne une seule personne. Pour la retirer, cliquez sur **{{ui:comic.panel.poseRemove}}**.

![La zone des préréglages de pose de la case. Choisissez la catégorie et le préréglage](shot:comic-presets)

Dans la même section, une pose peut aussi être mise en place à partir des mêmes préréglages de pose que sur la toile. Choisissez une catégorie avec **{{ui:comic.panel.poseCategory}}**, puis un préréglage avec **{{ui:comic.panel.posePreset}}**, et cliquez sur **{{ui:comic.panel.poseApply}}**. Un bonhomme bâton est dessiné à la taille de la case et devient la pose de cette case. Selon la composition, plusieurs personnes peuvent être placées côte à côte ; dans ce cas, toutes entrent dans la case.

Pour que la pose soit prise en compte dans l'image, un modèle ControlNet pour les poses (OpenPose, ou un modèle union) doit être installé. Sinon, la pose n'est pas utilisée dans l'image et un avertissement l'indique.

## Bulles et récitatifs

![Une bulle qui vient d'être ajoutée. La modification de la bulle est posée sur la planche, à droite](shot:comic-balloon)

Sélectionnez une case, cliquez sur **{{ui:comic.panel.bubbles}}** en haut au centre pour ouvrir la section, puis cliquez sur **{{ui:comic.bubble.kind.speech}}**, **{{ui:comic.bubble.kind.thought}}**, **{{ui:comic.bubble.kind.shout}}** ou **{{ui:comic.bubble.kind.caption}}** : une bulle de ce type est ajoutée à cette case, et **{{ui:comic.bubble.editor}}** s'ouvre posé sur la planche, à droite. La section liste les bulles de la case par type et par texte. Un clic sur une ligne sélectionne cette bulle, et le bouton crayon (**{{ui:comic.bubble.edit}}**) ouvre **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}} : une ellipse, à laquelle on peut ajouter une queue.
- {{ui:comic.bubble.kind.thought}} : une ellipse suivie de petits cercles à la place de la queue.
- {{ui:comic.bubble.kind.shout}} : une bulle au bord dentelé.
- {{ui:comic.bubble.kind.caption}} : un cadre à angles, sans queue.

![Une bulle au texte vertical et la poignée ronde au bout de la queue](shot:comic-tail)

Les bulles se placent en les faisant glisser sur la page. Quand vous sélectionnez une bulle, une poignée ronde apparaît au bout de sa queue. En faisant glisser cette poignée, vous changez la direction et la longueur de la queue. Pour ajouter ou retirer une queue, cliquez sur **{{ui:comic.bubble.tail}}** dans **{{ui:comic.bubble.editor}}**.

Un double-clic sur une bulle de la page ouvre aussi **{{ui:comic.bubble.editor}}**. Ce panneau s'ouvre posé sur la planche, à droite de l'écran, et ne cache donc pas la page (si le panneau de droite est fermé ou étroit, il s'ouvre à la place au bord droit de la page). On peut y changer **{{ui:comic.bubble.kindLabel}}**, le texte, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** et **{{ui:comic.bubble.tail}}**. Pour le fermer, cliquez sur le × en haut à droite ou appuyez sur Échap. Une fois le panneau fermé, la bulle reste sélectionnée.

La taille du texte se choisit de 60 % à 220 % avec **{{ui:comic.bubble.size}}**. Cliquez sur **{{ui:comic.bubble.vertical}}** pour que le texte s'écrive verticalement, en colonnes allant de droite à gauche.

Ce qui n'est plus utile peut être supprimé avec la corbeille de sa ligne dans la section, ou avec **{{ui:comic.bubble.remove}}** dans **{{ui:comic.bubble.editor}}**. Vous pouvez aussi sélectionner une bulle sur la page et appuyer sur la touche Suppr.

## Réglages de génération

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} et {{ui:params.hires.title}} sont les mêmes que dans l'onglet {{ui:app.tabs.generate}}. Si vous modifiez les réglages de gauche, ils s'appliquent aussi à l'onglet {{ui:app.tabs.generate}}. Seuls les prompts sont propres à chaque case (voir « Les prompts de la case »).

Une seule image est dessinée et entre dans chaque case. La taille de l'image dépend donc de la taille de la case, et non des réglages de l'onglet {{ui:app.tabs.generate}}. Le champ Itérations n'apparaît pas dans la BD.

## Image de référence de chaque case

Une case peut recevoir une image de référence à elle, en plus des images de référence de l'onglet {{ui:app.tabs.generate}}. Elle sert à faire suivre à l'image de la case l'allure du visage ou des vêtements d'un personnage. Faites glisser une image de la galerie dans la zone **{{ui:params.refImage.sectionLabel}}** de la case sélectionnée, ou choisissez un fichier image avec **{{ui:comic.panel.imageUpload}}**.

L'image de référence n'est utilisée que pour dessiner l'image de cette case. Les images de référence de l'onglet {{ui:app.tabs.generate}}, s'il y en a, sont utilisées avec elle. Choisissez le modèle IP-Adapter avec **{{ui:params.refImage.model}}** et réglez le poids avec **{{ui:params.refImage.weight}}** (de 0 à 1 ; la valeur par défaut est 0,5). Pour les modèles autres que FLUX, vous pouvez aussi choisir **{{ui:params.refImage.clipVision}}** et **{{ui:params.refImage.methodLabel}}**. La liste des modèles ne montre que les modèles IP-Adapter qui conviennent au modèle principal.

Pour retirer l'image de référence, cliquez sur **{{ui:comic.reference.remove}}**. L'image reste dans la galerie. Une modification de l'image de référence peut être annulée avec Ctrl+Z.

Si aucun modèle IP-Adapter n'est choisi ou installé pour l'image de référence, ou si son image n'est pas dans la galerie, l'image de référence n'est pas utilisée. L'image de référence utilise les mêmes modèles IP-Adapter et la même extension que les images de référence de l'onglet {{ui:app.tabs.generate}}.

## Transformer la page en une seule image

Cliquez sur **{{ui:comic.page.export}}** en haut au centre pour enregistrer la page en une seule image (PNG) dans la galerie. Les images des cases ainsi que le texte des bulles et des récitatifs sont dessinés dans cette image. Les images des cases gardent la position, la taille, la rotation et le retournement que vous leur avez donnés sur la page. Le texte est dessiné avec les polices installées sous Windows, y compris les polices japonaises. La taille de l'image correspond au format du papier, à 200 dpi.

## Annuler et rétablir

Appuyez sur **{{ui:comic.history.undo}}**, en bas à gauche sous la page, pour annuler la dernière modification, et sur **{{ui:comic.history.redo}}** pour rétablir une modification annulée. Au clavier, Ctrl+Z annule une modification et Ctrl+Maj+Z (ou Ctrl+Y) la rétablit (sur Mac, Commande au lieu de Ctrl). L'annulation rétablit la mise en page des pages et des cases (y compris leur forme), les prompts et les poses des cases, les bulles et les images de référence des cases. Les images des cases (les mettre, les retirer, les déplacer), les modèles et le nom de la BD ne sont pas annulés. Un texte saisi dans un même champ sans pause est annulé d'un seul coup. Tant que le curseur est dans un champ de texte, Ctrl+Z ne modifie que le texte de ce champ.

## Enregistrement et suppression

La BD est enregistrée automatiquement environ 1 seconde après une modification. Même si vous fermez l'application puis la rouvrez, les projets enregistrés restent dans la liste, et les pages, les cases, les bulles et les modèles restent tels quels. Les BD sont aussi incluses dans les sauvegardes.

Pour supprimer un projet, ouvrez le menu de sa ligne dans la liste des BD, cliquez sur **{{ui:comic.project.delete}}**, puis cliquez à nouveau pour confirmer. Quand vous supprimez un projet, ses pages, ses cases et ses modèles disparaissent. Les images dessinées restent dans la galerie.

Pour supprimer une page, cliquez sur le bouton corbeille sous la page (**{{ui:comic.page.delete}}**), puis cliquez à nouveau pour confirmer. Les cases et les bulles de la page disparaissent, mais les images dessinées restent dans la galerie.

## Utiliser les images dessinées

Les images dessinées sont des images ordinaires de la galerie. Les opérations des autres écrans qui utilisent les images de la galerie, par exemple faire glisser une image de la galerie dans l'onglet {{ui:app.tabs.canvas}}, fonctionnent telles quelles.
