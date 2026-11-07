# Agent, paramètres et raccourcis clavier

Ce chapitre présente l'agent, qui règle les paramètres à partir d'une simple phrase, l'écran des paramètres, la liste des raccourcis clavier, l'écran d'informations sur l'application et le journal développeur.

L'écran des paramètres, les raccourcis clavier et les informations sur l'application s'ouvrent depuis **{{ui:app.nav.settingsMenu}}**, en bas à gauche de l'écran.

## Agent

![L'agent dans le panneau de droite. Premier écran, où l'on choisit l'IA à utiliser et où l'on se connecte](shot:agent)

Un clic sur l'onglet **{{ui:app.right.assistant}}**, en haut du panneau de droite, remplace la galerie par **{{ui:agent.title}}**. Il s'utilise dans les écrans {{ui:app.tabs.generate}}, {{ui:app.tabs.canvas}}, {{ui:app.tabs.upscaling}} et {{ui:app.tabs.workflows}}, et quand vous changez d'écran, la discussion et le texte en cours de rédaction sont conservés. L'onglet **{{ui:app.right.gallery}}** ramène à la galerie. Quand vous posez une question à l'agent depuis l'écran {{ui:app.nav.extensions}}, il s'ouvre dans une fenêtre au-dessus de l'écran. Cette fenêtre n'apparaît que sur l'écran où vous avez posé la question, et pas quand vous passez à un autre écran, comme {{ui:app.tabs.models}} ou {{ui:app.tabs.browse}}. On peut déplacer la fenêtre en faisant glisser son titre.

Au lieu de choisir vous-même les modèles et les LoRA ou de régler le prompt et la taille, décrivez ce que vous voulez créer par une phrase, par exemple « une jeune fille de style anime debout sur une plage au coucher du soleil » : l'agent choisit les réglages et les saisit à votre place.

### Commencer (connexion)

L'agent ne fait pas tourner une IA lui-même : novira appelle la commande d'IA présente sur votre ordinateur (Claude ou Codex) pour produire la réponse. Pour l'utiliser, il faut d'abord préparer ceci.

1. Installez sur l'ordinateur l'une des deux commandes : **Claude** d'Anthropic ou **Codex** d'OpenAI.
2. Ouvrez l'agent et cliquez sur celle que vous voulez utiliser (**{{ui:agent.setup.claude}}** ou **{{ui:agent.setup.codex}}**).
3. Une page du navigateur s'ouvre : connectez-vous.

Si la commande est introuvable sur l'ordinateur, un message « La commande ○○ est introuvable sur ce PC. Installez-la d'abord. » s'affiche. Installez d'abord cette commande.

Le service utilisé et son abonnement sont ceux du fournisseur que vous avez choisi. Avec Claude et Codex, novira n'enregistre aucune clé d'API. Le contenu des échanges (le texte envoyé, et les informations de l'application que l'agent a lues pour travailler, par exemple la liste des modèles, les réglages, le contenu de la BD ou du texte ouverts) est envoyé au service choisi. Les informations sur les images de la galerie et les prompts de l'onglet de génération ne sont lus que si vous l'avez autorisé (voir plus bas « Autorisation de lire les images et les prompts »).

L'IA choisie s'affiche sur la première ligne de l'agent. Pour la changer, cliquez sur le bouton **{{ui:agent.changeProvider}}**, à droite de cette ligne.

### Se connecter à un serveur comme Ollama

![L'écran de connexion à un serveur. Le bouton Ollama, l'adresse, le modèle et le résultat du test de connexion](shot:agent-server)

En plus de Claude et Codex, l'agent peut utiliser un serveur doté d'une API compatible OpenAI (Ollama, LM Studio, etc.) qui tourne sur cet ordinateur ou sur le réseau. novira interroge le serveur pour obtenir les réponses et exécute lui-même les outils de l'agent (modification des réglages, actions dans les éditeurs, etc.) : il faut donc un modèle qui prend en charge les appels d'outils.

Voici la marche à suivre.

1. Ouvrez l'agent et cliquez sur **{{ui:agent.setup.openai}}**.
2. Cliquez sur le bouton du serveur à utiliser (pour Ollama, le bouton **Ollama**). L'adresse est saisie et la liste des modèles du serveur est chargée. Pour un autre serveur, saisissez dans **{{ui:agent.endpoint.address}}** une adresse qui se termine en général par « /v1 ».
3. Choisissez **{{ui:agent.endpoint.model}}** dans la liste. Si le serveur ne fournit pas de liste, saisissez le nom.
4. Si le serveur demande une clé, saisissez-la dans **{{ui:agent.endpoint.key}}**. La clé est chiffrée et enregistrée sur cet ordinateur, et envoyée uniquement à ce serveur. Pour un serveur sur votre propre ordinateur, elle n'est en général pas nécessaire.
5. Cliquez sur **{{ui:agent.endpoint.test}}**. Le test vérifie que le serveur répond, que le modèle existe et qu'il peut appeler les outils de l'application.
6. Cliquez sur **{{ui:agent.endpoint.use}}**.

Si le modèle ne peut pas appeler d'outils, le test l'indique avec la raison renvoyée par le serveur. Un avertissement reste aussi au-dessus du champ de saisie, et l'envoi des messages est refusé. Le bouton à côté du nom de la discussion permet de choisir un autre modèle, ce qui relance la vérification. Le test échoue de la même façon quand le contexte du serveur (la longueur qu'il peut lire d'un coup) est trop court pour les demandes de l'agent. C'est le cas du réglage par défaut d'Ollama. Portez la longueur de contexte du serveur à 32768 ou plus (dans les réglages d'Ollama, ou avec la variable d'environnement OLLAMA_CONTEXT_LENGTH), puis cliquez de nouveau sur **{{ui:agent.endpoint.test}}**. novira ne fait pas semblant de pouvoir utiliser des outils.

Quand un serveur est utilisé, le titre de la discussion affiche OpenAI API. Un clic sur **{{ui:agent.changeProvider}}** ramène à l'écran de choix. Le serveur saisi reste dans le formulaire.

Pour un serveur situé hors de cet ordinateur, ce que vous envoyez et, si vous l'avez autorisé, ce que l'agent a lu transitent par le réseau. Un avertissement s'affiche sous l'adresse d'un tel serveur. Pour un serveur sans https, tout, clé comprise, circule sans chiffrement : cet avertissement s'affiche aussi. La confirmation « {{ui:agent.permission.title}} » indique également où le contenu lu sera envoyé. La réponse du serveur est traitée comme un simple texte, et seules les demandes qui passent les mêmes vérifications que pour Claude et Codex sont exécutées.

### Ce que fait l'agent

À partir de votre texte, l'agent décide des points suivants et les applique aux réglages. Ce qu'il a appliqué est listé dans la réponse.

| Contenu | Exemple |
|---|---|
| Choix du modèle | Choisit le plus adapté parmi les modèles installés |
| Ajout de LoRA | Ajoute une LoRA qui correspond au style |
| Prompt | Écrit le prompt et le prompt négatif |
| Changement de paramètres | Taille, nombre d'étapes, CFG, planificateur, seed |
| Workflow | Crée un graphe, corrige le graphe ouvert (il assemble aussi des graphes de musique, de vidéo et de voix avec les nœuds de ComfyUI lui-même. C'est vous qui le lancez, avec **{{ui:params.invoke.invoke}}**) |
| Texte | Corrige le texte ou la bulle ouverts dans **{{ui:media.tab.text}}** |
| Vidéo, musique, voix | Modifie les réglages de chacun de ces écrans |
| BD | Dans **{{ui:app.tabs.comic}}**, modifie le découpage en cases, ajoute et coupe des cases, et modifie le prompt et la pose de chaque case ainsi que les bulles (voir « Se faire aider pour la BD » plus bas) |
| Pose | Place sur **{{ui:app.tabs.canvas}}** un personnage dans la pose demandée par écrit (voir [Dessiner davantage sur la toile](05-canvas.md#créer-une-pose-sur-la-toile)) |
| Génération | Seulement quand vous le demandez (et pour l'essai de dessin ci-dessous), met en file d'attente de génération les réglages actuels ou les cases de la BD |
| Recommandation d'extensions | Indique les extensions qui conviennent à ce que vous voulez faire, installables depuis un bouton |
| Utilisation de l'application | Répond où cliquer, en utilisant les noms affichés à l'écran |
| Explication des extensions | Explique ce qu'elles permettent et comment les utiliser (voir « Poser des questions sur l'utilisation ou les extensions » plus bas) |

L'agent voit quel écran est ouvert. Par exemple, si **{{ui:media.tab.text}}** est ouvert et que vous demandez « mets le texte à la verticale », ce texte change.

L'agent applique à l'écran ce qu'il change au fur et à mesure de son travail. Pendant ce temps, les changements s'affichent l'un après l'autre sous « {{ui:agent.thinking}} ». Il ne crée des images et des vidéos que sur demande (il les met dans la file de génération). Sans demande, il se contente de modifier les réglages : si le résultat vous convient, cliquez sur **{{ui:agent.generate}}** dans la réponse pour lancer directement la création. Quand une BD est ouverte, un bouton « Générer toutes les pages » apparaît à côté : il met d'un coup dans la file toutes les cases qui ont un prompt, pour toutes les pages (rien n'est mis dans la file si vous ne cliquez pas). L'agent ne supprime pas d'images et n'installe ni modèles ni extensions (pour les extensions, il se contente de faire des recommandations). Le gras, les listes à puces, les tableaux, etc. d'une réponse s'affichent avec leur mise en forme, et non sous forme de symboles.

### Questions de l'agent et essai de dessin

Quand ce que vous demandez laisse un point qui changerait beaucoup le résultat (quel personnage modifier, l'arrière-plan ou le personnage, la coiffure ou la couleur des cheveux, etc.), l'agent vous pose la question avant de changer quoi que ce soit. Quand vous répondez, il change exactement ce qui a été dit. Si, après une correction, vous dites « c'était mieux avant » ou « cette fille pouvait rester telle quelle », l'agent retrouve dans cette discussion l'état d'avant le changement et remet cette partie en l'état (une fois l'application fermée, l'état d'avant le changement n'est plus connu).

Quand vous demandez un aspect difficile à exprimer par des mots, comme « une ambiance d'été », l'agent peut générer une seule image d'essai, puis la regarder et vérifier : « C'est bien cette ambiance ? ». L'image d'essai apparaît sous la réponse. Pour regarder l'image, la même confirmation que dans « Autorisation de lire les images et les prompts » ci-dessous s'affiche. Si vous ne voulez pas d'essai de dessin, désactivez **{{ui:settings.assistantTrial.label}}** dans les paramètres (voir « Paramètres » plus bas).

### Se faire aider pour la BD

Si vous demandez quelque chose avec **{{ui:app.tabs.comic}}** ouvert, l'agent lit la page ouverte (la forme des cases, le prompt de chaque case, les poses et les bulles) et la réécrit directement. Par exemple, vous pouvez demander ceci.

- Demandez « Fais 5 cases avec un temps fort. La première en grand, coupée en biais » et il crée le découpage en cases. Si vous ne précisez pas de forme, il compose, comme dans une vraie BD, des bandes de hauteurs et des cases de largeurs inégales, donne une grande case au temps fort et, selon la scène, ajoute des coupes en biais ou des cases qui vont jusqu'au bord de la page. L'espace entre les cases est plus large en haut et en bas que sur les côtés. Le découpage varie d'une page à l'autre. Il peut utiliser un modèle standard ou décider lui-même de la forme des cases.
- Demandez « Écris le prompt de chaque case avec cette histoire » et il écrit pour chaque case un prompt avec un cadrage adapté au déroulement de l'histoire (gros plan, plan large, contre-plongée, etc.).
- Demandez « Écris la description de chaque case avec cette histoire » et il décrit en texte, pour chaque case, la scène (le lieu, le moment, qui fait quoi).
- Demandez « Mets des dialogues dans chaque case » et il place des bulles et y écrit les répliques. Quand une réplique dépasse de la bulle, il réduit la taille du texte pour qu'elle y tienne.
- Demandez « Mets la fille de la case 2 dans une pose de course » et il donne une pose à cette case. Il écrit aussi les personnages (l'apparence de chacun) pour que les visages et les vêtements restent identiques dans toutes les cases. Les bulles sont placées à côté de celui qui parle, à une taille qui ne chevauche pas les autres.
- Demandez « Crée une nouvelle BD et construis le découpage de 30 pages » et il crée la BD, ajoute les pages, puis mène à terme le découpage, les prompts et les dialogues. Même si vous le demandez depuis un autre écran, il passe à l'écran de la BD pour travailler. Même un long travail va jusqu'au bout au sein d'une seule demande. Pour l'interrompre en route, cliquez sur **{{ui:agent.stop}}**.

Il ne dessine les images que sur demande (il les met dans la file de dessin). Sans demande, une fois les prompts en place, cliquez sur **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}** ou **{{ui:comic.comic.drawAll}}**. Si vous demandez « dessine toutes les pages », toutes les cases de toutes les pages sont mises d'un coup dans la file. Le bouton « Générer toutes les pages » sous la réponse fait la même chose. Un clic sur **{{ui:agent.undo}}** remet en l'état, d'un seul coup, les pages de BD modifiées par cette réponse.

### Joindre une image

Vous pouvez joindre une image à un message et demander par exemple « imagine un prompt à partir de cette image ».

- Avec le bouton en forme de trombone (**{{ui:agent.attach.add}}**), à gauche du champ de saisie, choisissez une image de l'ordinateur.
- Vous pouvez aussi faire glisser dans le champ de saisie une image de la galerie ou un fichier image de l'ordinateur.
- Vous pouvez aussi coller dans le champ de saisie une image copiée.

Les images jointes s'alignent au-dessus du champ de saisie, et la croix en haut à droite permet de les retirer. On peut joindre jusqu'à 4 images par message. Si vous envoyez une image sans écrire de texte, cela revient à demander « {{ui:agent.attach.defaultAsk}} ». Les images jointes depuis l'ordinateur entrent aussi dans la galerie. L'image est envoyée avec ce message à l'IA choisie (Claude, Codex ou le serveur connecté). Elle n'accompagne pas les messages suivants : pour redemander quelque chose sur la même image, joignez-la de nouveau. Avec un modèle qui ne sait pas lire les images, les réponses ne seront pas bonnes.

### Autorisation de lire les images et les prompts

Les informations sur les images de la galerie (prompt, modèle, etc.) et le champ de prompt de l'onglet de génération peuvent contenir des choses que vous ne voulez pas montrer. C'est pourquoi, quand l'agent veut les lire, une confirmation « {{ui:agent.permission.title}} » s'affiche d'abord dans la discussion. Elle indique aussi ce qu'il veut lire.

- **{{ui:agent.permission.once}}** : il peut lire cette fois seulement. À la prochaine tentative, la confirmation s'affichera de nouveau.
- **{{ui:agent.permission.always}}** : il peut désormais lire sans confirmation (le réglage passe à **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}** : il ne peut pas lire. L'agent continue sans lire, ou répond ce dont il a besoin.

Quand l'écran de la BD est ouvert, l'agent peut regarder l'image d'une page qu'il vient de dessiner (à votre demande, pour vérifier l'apparence des personnages et les bulles). La même confirmation s'affiche alors, et l'image de la page n'est envoyée que si vous l'autorisez. Il ne regarde rien sur les autres écrans.

Le fait de demander ou non la confirmation se change dans **{{ui:settings.assistantRead.label}}**, sous **{{ui:settings.section.assistant}}**, dans l'onglet **{{ui:settings.tab.generation}}** des paramètres (voir « Paramètres » plus bas). Le contenu des écrans que l'agent corrige pour vous, comme la BD, le texte, les workflows, les écrans de vidéo, de musique et de voix, et la pose sur la toile, est lu sans confirmation.

### Recherche sur Wikipédia

Quand il construit une histoire (époque, vêtements, lieux, métiers, vocabulaire, etc.), l'agent peut chercher des faits sur Wikipédia en japonais ou en anglais et lire le début de 3 articles au maximum. Seuls de courts mots de recherche quittent l'ordinateur, et uniquement vers Wikipédia. C'est le corps de l'application qui les envoie, l'écran ne se connecte jamais directement. Comme les mots de recherche sortent sur Internet, une confirmation « {{ui:agent.permission.webTitle}} » s'affiche dans la discussion avant la recherche, avec les mots de recherche qui seront envoyés.

- **{{ui:agent.permission.once}}** : il peut chercher cette fois seulement. À la prochaine tentative, il demandera de nouveau.
- **{{ui:agent.permission.always}}** : il peut désormais chercher sans confirmation (le réglage passe à **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}** : il ne peut pas chercher. L'agent avance avec ce qu'il sait et, pendant cette demande, ne redemande pas.

C'est un réglage distinct : **{{ui:settings.assistantWeb.label}}**, sous **{{ui:settings.section.assistant}}**, dans l'onglet **{{ui:settings.tab.generation}}** des paramètres. Autoriser la lecture des images n'autorise pas la recherche (et inversement). Les textes de Wikipédia sont sous licence CC BY-SA 4.0 : quand l'agent utilise un fait, il indique le nom de l'article d'origine. Les réponses peuvent être fausses : vérifiez ce qui est important.

### Choisir le modèle et le niveau de réflexion

Cliquez sur le petit bouton en forme de cerveau, à droite du nom de la discussion, pour choisir le **{{ui:agent.model.label}}** et le **{{ui:agent.effort.label}}** utilisés par l'agent. Ce choix s'applique dès le prochain message envoyé. Claude et Codex mémorisent chacun leur propre choix.

- Pour Claude, le modèle se choisit parmi Fable 5.1, Opus 5.5, Sonnet 5.5 et Haiku 5.5. La version utilisée est exactement celle du nom. Le niveau de réflexion compte 5 degrés, de **{{ui:agent.effort.low}}** à **{{ui:agent.effort.max}}**.
- Pour Codex, le modèle se choisit dans la liste des modèles que Codex indique comme utilisables avec votre compte (la liste est lue dans ce que Codex a enregistré sur l'ordinateur). Seuls les niveaux de réflexion acceptés par le modèle choisi sont proposés (certains modèles vont jusqu'à **{{ui:agent.effort.ultra}}**).
- Pour un serveur, les modèles que le serveur liste s'affichent. Vous pouvez aussi saisir un nom. Il n'y a pas de niveau de réflexion. Le modèle faisant partie des réglages du serveur, en choisir un autre l'enregistre.

Tant que vous n'avez rien choisi, c'est Sonnet 5.5 pour Claude et le premier modèle de la liste pour Codex, et le bouton en affiche le nom. C'est toujours le modèle dont le nom figure sur le bouton qui répond (seulement quand Codex n'a pas enregistré de liste, **{{ui:agent.model.default}}** s'affiche et Codex choisit le modèle). Un niveau de réflexion est toujours sélectionné. Au début, c'est le niveau standard du modèle ; quand vous changez de modèle et que le nouveau n'accepte pas le niveau actuel, on revient au niveau standard de ce modèle.

### Changer la hauteur du champ de saisie

Faites glisser vers le haut la poignée allongée au bord supérieur du champ de saisie pour l'agrandir, et vers le bas pour le réduire. Vous pouvez aussi sélectionner la poignée et appuyer sur les flèches haut et bas. La hauteur est conservée à la prochaine ouverture.

### Appeler un modèle de demande

Tapez « / » au début du champ de saisie pour ouvrir la liste des modèles de demandes fréquentes. Continuez à taper après le « / » pour ne garder que ceux dont le nom, la commande ou le texte contient ces caractères (par exemple « /BD » ou « /comic »).

Choisissez avec les flèches haut et bas, puis validez avec Entrée ou Tab. Un clic sur une ligne de la liste valide aussi. Le texte du modèle choisi est placé dans le champ de saisie : complétez-le, puis envoyez-le (le choisir ne l'envoie pas). La touche Échap ferme la liste.

### Poser des questions sur l'utilisation ou les extensions

Vous pouvez aussi poser des questions, pas seulement demander des réglages. Par exemple, si vous demandez « comment supprimer l'arrière-plan ? » ou « où cliquer pour ajouter un modèle ? », l'agent répond où cliquer en utilisant les noms affichés à l'écran. La réponse arrive dans la langue que vous utilisez actuellement.

On peut aussi l'interroger sur les extensions. Il explique en termes simples ce qu'elles permettent, quand les utiliser et comment. Il y a 3 façons de demander.

- Cliquer sur une carte dans la liste de **{{ui:app.nav.extensions}}** pour ouvrir ses détails, puis cliquer sur **{{ui:agent.ask.button}}**. Une question sur cette extension est envoyée dans une nouvelle discussion.
- Saisir un mot dans le champ de recherche au-dessus de **{{ui:app.nav.extensions}}**, puis cliquer sur **{{ui:agent.ask.resultsButton}}** qui apparaît. L'agent répond sur les différences entre les extensions trouvées (jusqu'aux 8 premières) et par laquelle commencer.
- Écrire dans la discussion le nom d'une extension (en lettres latines) et poser la question. L'agent cherche, parmi les extensions publiées, celles dont le nom ou la description correspondent, puis répond (si la liste n'est pas encore chargée, il la charge à ce moment-là).

Pour une extension déjà installée, il indique aussi le nom des nœuds ajoutés et à quoi les relier. Pour une extension pas encore installée, une carte est jointe à la réponse et **{{ui:workflows.packs.install}}** permet de l'installer directement.

> L'explication des extensions se fonde sur la description publiée et sur les informations des nœuds. L'agent devrait répondre « je ne sais pas » quand il ne sait pas, mais il peut aussi se tromper. Avant d'installer, vérifiez également la page du distributeur.

### Annuler

Une réponse qui a modifié des réglages ou des éditions comporte un bouton **{{ui:agent.undo}}**. Un clic remet d'un seul coup les réglages et les éditions modifiés par cette demande dans l'état d'avant. Ce qui a été mis dans la file de génération n'est pas annulé (annulez-le dans la file).

En revanche, après la réouverture de l'application, les modifications antérieures ne peuvent plus être annulées (le bouton n'est plus actif).

### Faire dessiner à répétition jusqu'à la ressemblance

Si vous demandez « fais-la ressembler à cette image » ou « rapproche-toi petit à petit en générant plusieurs images », l'agent répète les essais de dessin. À chaque image, il la compare à l'image cible, ne corrige que les différences, puis dessine la suivante.

- Même quand une réponse est terminée, l'application demande automatiquement l'image suivante. L'agent ne s'arrête que s'il juge s'être rapproché de la cible, ou si 2 images de suite ne s'en sont pas rapprochées.
- Le maximum est de 30 images.
- La discussion affiche « Rapprochement : image N / M ».
- Pour arrêter, cliquez sur **{{ui:agent.stop}}** ou envoyez un nouveau message. Le message envoyé prend la place de l'image suivante.
- Si {{ui:settings.assistantTrial.label}} est désactivé, cette répétition ne démarre pas.

### Vérifier la longueur de la conversation

Dans une même discussion, l'agent répond en gardant en mémoire les échanges précédents. Les images jointes et celles qu'il a montrées conservent aussi leur nom, et il les revoit si nécessaire.

- Au-dessus du champ de saisie s'affiche la taille de la conversation qui accompagnera le prochain envoi, sous la forme « environ N / M jetons ». Ces nombres sont indicatifs.
- Tant que l'interrupteur « {{ui:agent.context.limit}} » de la même ligne est activé (il l'est dès le départ), quand la conversation risque de dépasser 30000 jetons, les anciens messages sont envoyés sous forme de courts résumés d'une ligne chacun. Les messages récents sont envoyés tels quels, et le nombre de messages résumés s'affiche sur la ligne. Le résumé reprend environ les 140 premiers caractères : les formulations précises ne sont pas conservées. Si l'agent oublie la conversation précédente à cause de cette coupe, désactivez l'interrupteur pour envoyer toute la conversation (si elle est longue, elle peut dépasser la limite du modèle utilisé).
- Tant que cet interrupteur est activé, les prompts que l'agent écrit dans le champ de prompt de {{ui:app.tabs.generate}} sont aussi limités à 77 jetons par champ (le nombre affiché sous le champ). L'application refuse un prompt plus long, et l'agent le raccourcit et le réécrit. Désactivez l'interrupteur si vous voulez qu'il écrive de longs prompts.
- Quand vous changez de sujet, démarrez une nouvelle discussion avec {{ui:agent.session.new}} : la conversation ne sera pas influencée par l'ancienne.

### Historique des discussions

Les échanges avec l'agent sont conservés sous forme de « discussions ». Un clic sur le nom de la discussion, en haut de la fenêtre, ouvre la liste **{{ui:agent.session.history}}**.

- Choisissez-en une dans la liste pour reprendre cette discussion.
- **{{ui:agent.session.rename}}** permet de lui donner un nom.
- **{{ui:agent.session.delete}}** permet de la supprimer.
- **{{ui:agent.session.new}}**, juste à côté, démarre une nouvelle discussion.

Le texte de la discussion peut être sélectionné en le faisant glisser, puis copié. Le bouton en bas à droite de chaque message (**{{ui:agent.copy}}**) copie le message en entier.

> Un message écrit et envoyé pendant que l'on attend une réponse est mis en attente et envoyé automatiquement quand la réponse en cours est terminée. Les messages en attente s'affichent en clair, et la croix permet de les retirer. Si la réponse échoue, les messages en attente reviennent dans le champ de saisie. Pour interrompre, annulez avec le bouton **{{ui:agent.stop}}**. Ce qui a changé jusqu'à l'annulation reste en l'état, et **{{ui:agent.undo}}** permet de tout remettre d'un coup.

La largeur du panneau de droite se change en faisant glisser la limite du panneau. La fenêtre ouverte au-dessus de l'écran peut être redimensionnée en faisant glisser l'un quelconque de ses quatre bords ou de ses quatre coins, et le coin inférieur droit porte un repère pour cela. Sa taille est mémorisée. Quand une réponse est accompagnée de son raisonnement, il apparaît sur une ligne au-dessus de la réponse. Un clic l'ouvre en entier (**{{ui:agent.thoughts.label}}**). C'est un court résumé de la façon dont l'IA a compris la demande et de ses raisons, et non la pensée interne de l'IA telle quelle.

## Paramètres

![L'écran des paramètres. Les onglets sont alignés à gauche et les éléments de l'onglet choisi s'affichent à droite](shot:settings)

Dans **{{ui:app.nav.settingsMenu}}**, en bas à gauche, choisissez **{{ui:app.nav.settings}}** pour ouvrir l'écran des paramètres. Quand vous choisissez un onglet à gauche, ses éléments s'affichent à droite. Les changements s'appliquent tout de suite et sont conservés même après la fermeture de l'application. À la réouverture, c'est le dernier onglet consulté qui s'ouvre.

> Cette image est un écran d'exemple qui tourne dans le navigateur. **{{ui:settings.uiZoom.label}}**, qui n'existe que dans la version de bureau, n'y figure pas.

### {{ui:settings.tab.general}}

| Élément | Contenu |
|---|---|
| {{ui:settings.language.label}} | Choisissez parmi {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} et {{ui:settings.language.de}}. Les textes de l'écran changent immédiatement |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (par défaut) ou **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | Version de bureau uniquement. La taille de l'ensemble de l'écran. On peut choisir de 50 % à 300 %. On peut aussi la changer avec `Ctrl` et `+` / `-` |
| {{ui:settings.startTab.label}} | L'onglet affiché en premier à l'ouverture de l'application. Au départ, c'est **{{ui:app.tabs.generate}}**. Avec **{{ui:settings.startTab.last}}**, l'onglet de la dernière fermeture s'ouvre |
| {{ui:settings.waitForEngine.label}} | Activé au départ : l'écran de démarrage attend la fin du chargement du moteur d'images. Désactivé, l'application s'ouvre même si le chargement n'est pas terminé. L'état du moteur s'affiche dans la bannière |
| {{ui:settings.toastSeconds.label}} | Le nombre de secondes avant la disparition automatique d'une notification. On peut choisir de 2 à 15 secondes (3,5 au départ) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}** : affiche en douceur l'image en cours de génération dans le cadre « {{ui:gallery.generating.title}} » de la galerie. Désactivé, elle apparaît en points grossiers.
- **{{ui:settings.draftCount.label}}** : la valeur initiale du nombre d'images à l'ouverture de l'écran des brouillons (de 1 à 24 ; 4 au départ). Vous pouvez aussi la changer à chaque fois dans l'écran.
- **{{ui:settings.draftPosition.label}}** : la valeur initiale de la position à l'ouverture de l'écran des brouillons (de 25 à 60 % ; 35 % au départ).
- **{{ui:settings.lowMemory.label}}** : pour les ordinateurs dont le GPU a peu de mémoire. Activé, les modèles ne restent pas en mémoire GPU, ce qui permet de créer avec moins de mémoire, mais la création est plus lente. Le basculement redémarre le moteur. S'il y a des éléments en cours de création, le réglage s'applique au prochain démarrage du moteur. Il est inutilisable quand on est connecté à un moteur lancé ailleurs.
- **{{ui:settings.assistantRead.label}}** (**{{ui:settings.section.assistant}}**) : détermine si l'agent peut lire les informations sur les images de la galerie et les prompts de l'onglet de génération. Choisissez parmi **{{ui:settings.assistantRead.ask}}** (par défaut), **{{ui:settings.assistantRead.always}}** et **{{ui:settings.assistantRead.never}}**.
- **{{ui:settings.assistantWeb.label}}** (**{{ui:settings.section.assistant}}**) : détermine si l'agent peut chercher des faits sur Wikipédia. Le choix se fait de la même façon, et c'est un réglage distinct de la lecture des images.
- **{{ui:settings.assistantTrial.label}}** (**{{ui:settings.section.assistant}}**) : détermine si l'agent peut générer de lui-même une seule image d'essai quand l'intention de la demande est peu claire. Activé au départ.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}** : ce sont les mêmes éléments que **{{ui:gallery.settings.title}}**, qui s'ouvre avec le bouton en forme d'engrenage de la galerie. Un changement fait à l'un ou à l'autre endroit a le même effet.
- **{{ui:settings.confirmOnDelete}}** : affiche une confirmation avant de supprimer une image. Si vous choisissez « {{ui:common.dontAskAgain}} » dans l'écran de confirmation, ce réglage passe aussi à désactivé.
- **{{ui:settings.clearIntermediates}}** : supprime les images qui n'apparaissent pas dans la galerie, comme les résultats intermédiaires de la toile. Le nombre d'éléments à supprimer s'affiche sur le bouton.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}** : le nombre d'opérations que l'on peut annuler dans l'édition de la toile, de la BD, du texte et des workflows. On peut choisir de 10 à 200 (60 au départ). Plus il est élevé, plus la mémoire utilisée est importante.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}** : la police utilisée pour le texte des bulles dont vous n'avez pas choisi la police. Vous pouvez choisir parmi les polices de l'application et celles installées sur cet ordinateur. **{{ui:common.font.standard}}** est la police standard de l'application.
- **{{ui:settings.textFont.label}}** : la police utilisée pour les nouveaux textes ajoutés dans l'écran du texte. Elle se choisit comme la police des bulles.
- **{{ui:settings.section.comicPage}}** : détermine **{{ui:comic.page.size}}**, **{{ui:comic.page.direction}}**, **{{ui:settings.comicPage.panels}}** (de 1 à 6), **{{ui:comic.page.frameWidth}}** et **{{ui:comic.page.margin}}** des nouvelles BD et des pages ajoutées plus tard. Les pages existantes ne changent pas.

### {{ui:settings.tab.engine}}

L'emplacement où l'application place ses données, et la façon de démarrer le moteur d'images (ComfyUI). Ce que vous changez ici s'applique à partir du prochain démarrage de l'application (une indication s'affiche en haut).

| Élément | Contenu |
|---|---|
| {{ui:settings.engine.dataDir.label}} | Le dossier où se trouvent les images créées, les modèles, le moteur d'images, etc. Au départ, c'est `novira-data` dans le dossier utilisateur. Un clic sur **{{ui:settings.engine.dataDir.change}}** vous fait d'abord choisir ce qu'il advient des données actuelles. **{{ui:settings.engine.dataDir.dialog.move}}** déplace les données actuelles dans le dossier choisi. Cela fonctionne même si le dossier contient d'autres choses, tant qu'aucun élément n'a le même nom (le déplacement se fait au tout début du prochain démarrage, et il prend du temps s'il y en a beaucoup). **{{ui:settings.engine.dataDir.dialog.use}}** ouvre le dossier choisi sans déplacer les données (s'il contient des données, elles sont utilisées ; s'il est vide, on repart de zéro). Une fenêtre de choix du dossier s'ouvre ensuite, et l'emplacement choisi est utilisé à partir du prochain démarrage. **{{ui:settings.engine.dataDir.cancel}}** permet d'abandonner. Si le déplacement échoue, la raison s'affiche et l'application démarre avec le dossier actuel. Quand l'emplacement est fixé par la variable d'environnement `NOVIRA_DATA_DIR`, on ne peut pas le changer ici |
| {{ui:settings.engine.comfyui.label}} | Le ComfyUI utilisé. En temps normal, il se trouve dans `comfyui`, dans le dossier de données, et cet emplacement s'affiche. Si vous avez indiqué un autre ComfyUI dans un fichier de configuration, c'est cet emplacement qui s'affiche. **{{ui:settings.engine.comfyui.change}}** permet de changer l'endroit où l'application installe ComfyUI. Si le dossier choisi est vide, une nouvelle installation se fait au prochain démarrage (c'est un gros téléchargement). S'il contient déjà une installation, elle est utilisée telle quelle. Les fichiers de l'ancien emplacement ne sont pas supprimés automatiquement. Pour revenir dans le dossier de données, choisissez le dossier `comfyui` qui s'y trouve |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** ou **{{ui:settings.engine.package.amd}}**. Utilisé la prochaine fois que ComfyUI est téléchargé (première installation ou changement de version). Si ComfyUI est déjà installé et que vous choisissez un autre type, une confirmation s'affiche. Si vous confirmez, ComfyUI est réinstallé avec le type choisi au prochain démarrage de novira (le téléchargement est volumineux et long) |
| {{ui:settings.engine.timeout.label}} | Le nombre de secondes d'attente d'une réponse de ComfyUI après son démarrage. On peut choisir de 30 à 1800 secondes. Allongez-le sur un ordinateur lent |
| {{ui:settings.engine.modelRoots.label}} | Des dossiers où chercher des modèles, en plus du dossier models du dossier de données. **{{ui:settings.engine.modelRoots.add}}** ouvre une fenêtre de choix du dossier. La structure des dossiers de ComfyUI et de Stability Matrix est reconnue. Les modèles supplémentaires de vidéo, de musique, de voix et d'effacement y sont aussi trouvés (ils sont seulement lus ; les nouvelles installations vont toujours dans le dossier de données). On peut en ajouter jusqu'à 16. On ne peut pas ajouter l'intérieur du dossier de données ni un dossier déjà présent. Le bouton × permet de retirer un dossier. Quand l'application est ouverte dans un navigateur, on ne peut pas en ajouter, seulement en retirer |

### {{ui:settings.tab.accounts}}

Ces champs servent quand le site de distribution des modèles exige une connexion. Ce que vous saisissez est chiffré et enregistré sur cet ordinateur, et n'est pas affiché à l'écran.

| Élément | Contenu |
|---|---|
| {{ui:settings.civitaiKey.label}} | Sert à télécharger des modèles qui exigent une connexion |
| {{ui:settings.hfToken.label}} | Sert à télécharger des modèles qui demandent une autorisation d'accès |

Collez la valeur et cliquez sur **{{ui:settings.civitaiKey.save}}**. Vous pouvez ensuite utiliser **{{ui:settings.civitaiKey.change}}** ou **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![La rubrique de sauvegarde de l'écran des paramètres. Un bouton pour créer une sauvegarde et un bouton pour restaurer à partir d'une sauvegarde](shot:settings-backup)

Les images que vous avez créées, ainsi que ce que vous avez réglé et enregistré dans l'application, peuvent être regroupés dans un seul fichier zip. Cela sert à déménager vers un autre ordinateur ou à se prémunir contre un incident.

- **{{ui:share.backup.createLabel}}** : ouvre une fenêtre pour choisir l'emplacement d'enregistrement. Le nom de fichier est d'emblée « novira-backup-date-heure.zip ». S'il y a beaucoup d'images, cela prend du temps, et l'avancement s'affiche dans cette rubrique.
- **{{ui:share.backup.restoreLabel}}** : choisissez le fichier zip d'une sauvegarde. Après vérification de son contenu, une fenêtre de confirmation s'affiche.

Voici ce que la sauvegarde contient et ce qu'elle ne contient pas.

| Inclus | Non inclus |
|---|---|
| Images, vidéos et sons de la galerie, avec leurs miniatures | Modèles |
| Planches, workflows, BD, historique de la file | Moteur d'images (ComfyUI) et extensions |
| Personnages, préréglages, listes de prompts, brouillons, discussions de l'agent, réglages de l'écran | Clés d'API et jetons, réglages propres à l'ordinateur comme l'emplacement de ComfyUI |

![La fenêtre de confirmation de la restauration. Elle indique la date et l'heure de création de la sauvegarde, le nombre d'éléments qu'elle contient et un avertissement sur le remplacement](shot:restore-confirm)

La fenêtre de confirmation indique la date et l'heure de création de la sauvegarde ainsi que le nombre d'images, de planches et de workflows qu'elle contient. Un clic sur **{{ui:share.backup.confirm}}** ferme l'application, la relance, et les données actuelles sont remplacées par le contenu de la sauvegarde. En cas d'échec, les données d'origine sont rétablies et l'application vous en informe.

> Les données remplacées ne peuvent pas être récupérées. Si nécessaire, faites une sauvegarde de l'état actuel avant de restaurer. Les clés d'API et les jetons étant chiffrés pour cet ordinateur uniquement, saisissez-les de nouveau dans **{{ui:settings.tab.accounts}}** après la restauration. Quand l'application est ouverte dans un navigateur, on ne peut ni créer ni restaurer de sauvegarde. Utilisez l'application de bureau.

#### {{ui:settings.section.unfinished}}

Quand un téléchargement s'interrompt en cours de route, un fichier inachevé reste dans le dossier de données. Cette rubrique permet de vérifier le nom des fichiers restants, le dossier où ils se trouvent et leur taille. **{{ui:settings.unfinished.delete}}** supprime un fichier à la fois, **{{ui:settings.unfinished.deleteAll}}** les supprime tous (une confirmation est d'abord demandée). Un fichier restant est repris là où il en était au prochain démarrage du même téléchargement. Si vous le supprimez, ce téléchargement est refait depuis le début. Un fichier en cours d'utilisation n'est pas supprimé et reste.

#### {{ui:settings.section.reset}}

Choisissez l'étendue de la remise à zéro avec **{{ui:settings.reset.scope.label}}**, cliquez sur **{{ui:settings.resetWebUi}}**, puis confirmez en cliquant de nouveau sur **{{ui:settings.resetConfirm}}**. Les images, les modèles, les BD et la toile ne sont pas supprimés.

L'état de l'écran (paramètres, préréglages, brouillons, historiques, etc.) est enregistré dans le dossier de données. Tant que vous utilisez le même dossier de données, le contenu est le même dans l'application de bureau et dans le navigateur. Comme on ne peut pas ouvrir les deux en même temps, il est repris quand on les utilise l'un après l'autre. La remise à zéro s'applique aussi aux deux.

| Étendue | Ce qui revient à la valeur initiale |
|---|---|
| {{ui:settings.reset.scope.settings}} | Les éléments de l'écran des paramètres. Le retour est immédiat |
| {{ui:settings.reset.scope.generation}} | Le prompt, le modèle et les paramètres de l'écran de génération |
| {{ui:settings.reset.scope.gallery}} | L'affichage de la galerie (taille des miniatures, ordre, etc.) |
| {{ui:settings.reset.scope.assistant}} | Les conversations avec l'agent. Tout est effacé |
| {{ui:settings.reset.scope.all}} | Tous les réglages et états d'écran enregistrés dans le navigateur. Les préréglages, les personnages, les listes de prompts et les conversations de l'agent sont aussi effacés |

Pour tout sauf « {{ui:settings.reset.scope.settings}} », la remise à zéro s'applique quand, après la confirmation, vous cliquez sur **{{ui:settings.reload}}** pour recharger.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}** : fait apparaître un bouton « {{ui:app.devlog.short}} » dans la navigation de gauche (voir « Journal développeur » plus bas).

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
| `G` | Ouvrir ou fermer le panneau de droite (galerie et agent) |
| `F` | Ouvrir ou fermer les deux panneaux à la fois |
| `1` à `9` | Aller à l'onglet portant ce numéro |
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

![L'écran d'informations sur l'application. Le logo, la version, la licence et la liste des logiciels open source utilisés](shot:about)

Lorsque vous choisissez **{{ui:app.nav.about}}** dans le **{{ui:app.nav.settingsMenu}}** en bas à gauche, le nom de l'application, sa version, sa licence et son copyright apparaissent en haut. En dessous se trouvent deux onglets.

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
