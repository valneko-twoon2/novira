# Dépannage

Ce chapitre rassemble les causes des problèmes et ce qu'il faut essayer. Cherchez à partir des mots qui s'affichent à l'écran.

Pour commencer, ces 2 éléments donnent souvent une piste sur la cause.

- Onglet **{{ui:app.tabs.queue}}** : pour un élément en échec, la raison est indiquée (voir [plus bas](#échec-de-la-génération)).
- {{ui:app.devlog.title}} : l'enregistrement interne de l'application (voir [L'assistant IA et les paramètres](09-assistant-settings.md)).

## Démarrage et moteur

Pour créer des images et le reste, novira utilise un « moteur de génération d'images » (ComfyUI et le Python qui le fait tourner). L'application installe et lance elle-même le moteur.

### Le démarrage est long

Au premier démarrage, le téléchargement et l'extraction du moteur prennent du temps. **{{ui:engine.firstRunNote}}**

L'écran de démarrage affiche 3 étapes : **{{ui:splash.step.downloading}}**, **{{ui:splash.step.extracting}}** et **{{ui:splash.step.starting}}**. Pendant le téléchargement, la taille, la vitesse et le temps restant s'affichent aussi. Attendez la fin.

Quand le moteur est prêt, l'écran change. À partir de la deuxième fois, il ne reste que la courte attente entre le lancement et la réponse du moteur.

### Messages affichés en haut de l'écran

Pendant la préparation du moteur, ou en cas de problème, un message s'affiche en haut de l'écran.

| Message | Signification |
|---|---|
| {{ui:engine.title.downloading}} | Le moteur est en cours de téléchargement. Il pèse plusieurs Go. Avec une connexion lente, cela prend du temps |
| {{ui:engine.title.extracting}} | Le fichier téléchargé est en cours d'extraction |
| {{ui:engine.title.starting}} | Le moteur est lancé et l'on attend la connexion |
| {{ui:engine.title.error}} | La préparation a échoué. La raison s'affiche en dessous |

### Le message « {{ui:engine.title.error}} » s'affiche

Quand il s'affiche sur l'écran de démarrage, cliquez sur **{{ui:splash.open}}** pour ouvrir l'application sans le moteur. Dans ce cas, vous ne pouvez pas créer d'images ni le reste, mais vous pouvez regarder les images et organiser les modèles.

Ce qu'il faut essayer :

1. Lisez le texte de la raison. Vérifiez que l'ordinateur est connecté à Internet et qu'il reste de l'espace disque.
2. Recommencez. Même après un échec de la préparation du moteur, l'application refait la préparation à la prochaine génération. Si cela ne règle rien, fermez l'application et rouvrez-la.
3. Si le téléchargement est terminé et que seule l'extraction a échoué, le fichier téléchargé est conservé, donc la reprise repart de l'extraction.
4. Il arrive que l'extraction se bloque parce qu'un logiciel de sécurité analyse les nouveaux fichiers. L'application réessaie automatiquement plusieurs fois, mais si cela persiste, excluez le dossier de données (voir plus bas) de l'analyse ou désactivez temporairement le logiciel.
5. Si la raison contient « see logs/comfyui.log », le journal du moteur donne le détail (voir [Lire les journaux](#lire-les-journaux)).

> Le moteur est une version de ComfyUI pour Windows, et par défaut c'est la version pour GPU NVIDIA qui est installée. Il existe aussi des réglages pour un GPU AMD ou pour utiliser un ComfyUI que vous avez installé vous-même, mais ils s'adressent aux utilisateurs avancés (voir [Réglages avancés](#réglages-avancés)).

### Le moteur semble s'être arrêté en cours de route

Le temps d'attente entre le lancement du moteur et sa réponse est de 3 minutes par défaut. Passé ce délai, on obtient une erreur signifiant « ComfyUI did not answer in time ». Si le moteur s'arrête pendant le démarrage, « ComfyUI exited while starting » s'affiche. Dans les deux cas, la raison est consignée dans le journal du moteur (`comfyui.log`).

## Impossible de générer

### Le bouton de génération n'est pas actif

Quand vous survolez le bouton de génération de l'écran **{{ui:app.tabs.generate}}**, une liste de raisons intitulée **{{ui:params.invoke.cannotInvoke}}** s'affiche. Dans les écrans de vidéo, de musique, de voix et de logo, les raisons sont listées sous le bouton. Corrigez les raisons affichées une par une et le bouton devient actif.

| Raison affichée | Comment corriger |
|---|---|
| {{ui:params.readiness.noModel}} | Choisissez un modèle. S'il n'est pas installé, passez à « Aucun modèle n'est installé » plus bas |
| {{ui:params.readiness.loraMissing}} | La LoRA choisie est introuvable. Elle a peut-être été supprimée ou déplacée. Choisissez-la de nouveau ou retirez-la |
| La LoRA « ○○ » est incompatible avec le modèle | La base (SDXL, SD1.X, etc.) est différente. Prenez une LoRA de la même base ou retirez-la |
| Image de référence ○ : aucune image choisie, ou aucun modèle choisi | Ajoutez une image et un modèle dans le champ de l'image de référence |
| Les images de référence nécessitent l'extension ○○ | Ajoutez l'extension depuis l'indication du champ de l'image de référence (voir [Extensions manquantes](#extensions-manquantes)) |
| {{ui:params.readiness.upscaleNoImage}} | Choisissez l'image à agrandir |
| {{ui:params.readiness.upscaleNoModel}} | Choisissez un modèle d'agrandissement. S'il n'est pas installé, vous pouvez l'installer depuis **{{ui:models.install.tab.starter}}** dans l'onglet {{ui:app.tabs.models}} |
| {{ui:video.problem.prompt}}, {{ui:music.problem.tags}}, {{ui:voice.problem.text}}, {{ui:logo.problem.text}} | Un champ obligatoire est vide. Remplissez-le |
| {{ui:video.problem.image}} | En mode « à partir d'une image », l'image à animer n'est pas choisie |
| {{ui:voice.problem.description}} | En mode « Décrire une voix », la description de la voix est vide |
| {{ui:video.problem.pack}}, {{ui:music.problem.pack}}, {{ui:voice.problem.pack}}, {{ui:logo.problem.pack}} | Le modèle dédié n'est pas installé. Passez à la rubrique suivante |

### Les modèles de vidéo, de musique, de voix ou de logo ne sont pas installés

Une carte s'affiche dans le panneau de gauche de chaque écran : cliquez sur **{{ui:pack.install}}**. Tant que l'installation n'est pas terminée, on ne peut pas créer.

- Si le téléchargement échoue en cours de route, le bouton de la carte devient **{{ui:pack.retry}}**. Un clic relance.
- Pour la voix, un moteur de lecture à voix haute est aussi installé. Il faut que la préparation du moteur de génération d'images soit déjà terminée.
- Le modèle de vidéo rapide se télécharge séparément du modèle de vidéo standard.

Pour plus de détails, voir [Vidéo, musique, voix, logo et texte](07-media.md).

### Aucun modèle n'est installé

Quand l'onglet **{{ui:app.tabs.models}}** affiche **{{ui:models.empty.title}}**, il n'y a aucun modèle.

- Depuis **{{ui:models.install.tab.starter}}** dans **{{ui:models.import}}**, vous pouvez installer un premier modèle.
- Dans l'onglet **{{ui:app.tabs.browse}}**, vous pouvez aussi chercher et télécharger les modèles de votre choix.
- Si vous avez déjà des fichiers de modèles, **{{ui:models.install.tab.scan}}** dans **{{ui:models.import}}** permet de les intégrer dossier par dossier.

Pour plus de détails, voir [Modèles](08-models.md).

### Extensions manquantes

Certaines fonctions affichent « L'extension ○○ est nécessaire ». C'est le cas pour corriger un visage, choisir une zone, supprimer l'arrière-plan, interpoler les images d'une vidéo, utiliser une image de référence, etc.

1. Cliquez sur **{{ui:params.refImage.installPack}}** à côté du message.
2. Quand l'installation est terminée, cliquez sur **{{ui:params.refImage.restartEngine}}** pour redémarrer le moteur.
3. Après le redémarrage, recommencez.

Les extensions peuvent aussi être installées ou retirées sous forme de liste depuis **{{ui:workflows.panel.packs}}** dans l'onglet **{{ui:app.tabs.workflows}}**.

> Quand vous êtes connecté à un moteur que vous avez préparé vous-même plutôt qu'à celui installé par l'application, l'application ne peut pas installer d'extensions. Installez-les du côté de ce moteur.

### Mémoire GPU insuffisante ou conflit avec d'autres applications

Les images, les vidéos et la musique utilisent le GPU de l'ordinateur. Si d'autres applications (jeux, montage vidéo, vidéos dans le navigateur, etc.) utilisent le GPU, la mémoire peut manquer et la création échouer.

Quand la mémoire manque, les lettres « OOM » (pour manque de mémoire) peuvent apparaître dans l'erreur.

Si la création échoue faute de mémoire, l'application le reconnaît et affiche l'avis **{{ui:queue.oom.title}}**. Cet avis apparaît au-dessus de la galerie, sous l'élément en échec de l'onglet **{{ui:app.tabs.queue}}**, dans les écrans de vidéo, de musique, de voix et de logo, et dans la notification en bas à droite de l'écran.

![L'avis de mémoire GPU insuffisante. Un bouton pour réessayer en plus petit et un bouton pour passer en mode économe en mémoire et redémarrer](shot:out-of-memory)

Les boutons de l'avis permettent d'essayer l'une des deux options.

- **{{ui:queue.oom.retrySmaller}}** : recrée avec les mêmes réglages et la même seed, en conservant le rapport largeur/hauteur et en ramenant la surface à environ 75 %. N'apparaît que pour les images dont on fixe la taille (pas pour la vidéo, la musique, la voix, les logos ni l'agrandissement).
- **{{ui:queue.oom.lowMemory}}** : active **{{ui:settings.lowMemory.label}}** (voir [L'assistant IA et les paramètres](09-assistant-settings.md)) et redémarre le moteur. S'il y a des éléments en cours de création, le réglage s'applique au prochain démarrage du moteur. N'apparaît pas s'il est déjà activé.

Après un échec dû au manque de mémoire, l'application demande au moteur de décharger les modèles chargés pour libérer de la mémoire. La création suivante repart donc du chargement du modèle et prend un peu plus de temps.

Ce qu'il faut essayer :

- Fermez les autres applications qui utilisent le GPU, comme les jeux ou le montage vidéo, puis recréez.
- Réduisez la taille de l'image.
- Réduisez le nombre de LoRA ou d'images de référence utilisées.
- Pour la vidéo, créez-la en petite taille puis agrandissez-la une fois terminée avec **{{ui:video.finish}}**. Vous pouvez aussi essayer **{{ui:video.light.fp8}}** et **{{ui:video.light.tiled}}** dans **{{ui:video.light.title}}**.
- Rouvrez l'application pour libérer la mémoire utilisée.

Les modèles de voix sont déchargés du GPU après un moment d'inactivité. Les créations se déroulent une par une, dans l'ordre.

### Échec de la génération

Quand la création d'une image, d'une vidéo, de musique, etc. échoue, l'élément de l'onglet **{{ui:app.tabs.queue}}** passe à **{{ui:queue.status.failed}}**. Cliquez sur l'élément pour l'ouvrir : la raison s'affiche dans **{{ui:queue.detail.error}}**. Dans les écrans de vidéo, de musique, de voix et de logo, un affichage d'échec avec sa raison apparaît aussi en haut du centre (jusqu'aux 3 plus récents).

Une fois la raison connue, le bouton **{{ui:queue.action.retry}}** de l'élément permet de recommencer avec les mêmes réglages.

Le texte de la raison vient du moteur ou de l'intérieur de l'application, et peut donc être en anglais. Voici les cas courants.

| Texte de la raison (l'essentiel) | Signification et ce qu'il faut essayer |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | Le moteur ne trouve pas ce modèle. Soit le fichier a été déplacé, soit le réglage des dossiers de recherche ne correspond pas. Réinstallez-le dans l'onglet Modèles ou vérifiez l'emplacement |
| ComfyUI is not reachable at ... | Impossible de se connecter au moteur préparé séparément. Vérifiez que ce moteur est lancé |
| ComfyUI exited while starting / did not answer in time | Le moteur n'arrive pas à démarrer. Consultez le journal du moteur |
| ... OOM | La mémoire GPU est insuffisante. Voir la rubrique précédente |
| ... models are not supported by the ComfyUI backend yet | Les modèles FLUX et SD3.X ne peuvent pas encore servir à générer des images. Choisissez un modèle SDXL ou SD1.X |
| Reference images need the ... custom node pack | L'extension nécessaire à l'image de référence n'est pas installée |
| This ComfyUI is too old for video / music | Le moteur utilisé n'a pas les fonctions nécessaires à la vidéo ou à la musique. Cela n'arrive pas avec le moteur installé par l'application. Si c'est un moteur que vous avez préparé, mettez-le à jour |
| The video / music / logo models are not installed yet | Le modèle dédié n'est pas installé. Téléchargez-le depuis l'écran correspondant |
| ComfyUI has no ... node; install the custom node pack | L'extension du nœud utilisé dans le workflow n'est pas installée |
| Interrupted because novira was closed | L'application a été fermée en cours de création. Recréez |

### L'image est créée mais invisible

Si la création est **{{ui:queue.status.completed}}** mais n'apparaît pas dans la galerie, vérifiez ceci.

- **Ce n'est pas la bonne planche** : les nouvelles images vont dans la planche portant la marque **{{ui:gallery.boards.autoBadge}}** (par défaut, **{{ui:gallery.boards.uncategorized}}**). Si vous avez ouvert une autre planche, elles n'y apparaissent pas. Changez de planche, ou choisissez à nouveau la planche qui reçoit les nouvelles images avec **{{ui:gallery.boards.setAutoAdd}}**.
- **Les logos vont dans les « ressources »** : les logos vont dans **{{ui:gallery.view.assets}}** et non dans **{{ui:gallery.view.images}}**.
- **Affichage des vidéos et des sons** : les vidéos sont alignées avec une miniature marquée ▶, les sons avec ♪. Une recherche ou un filtre encore actif les masque.

Si vous ne les trouvez toujours pas, vérifiez **{{ui:queue.col.destination}}** de l'élément dans l'onglet **{{ui:app.tabs.queue}}**. Un élément dont la destination est **{{ui:queue.destination.canvas}}** apparaît sur la toile, pas dans la galerie.

## Emplacement des données et sauvegarde

### Où sont les données

Les images, les modèles et les enregistrements se trouvent tous dans un dossier nommé **`novira-data`**. Son emplacement est le suivant.

- Version distribuée : le dossier choisi à l'installation. Par défaut, le dossier `novira-data` situé dans le même dossier que l'exécutable de l'application (`novira.exe`).
- Version de développement : le dossier `novira-data` situé à la racine du dépôt.

On peut le déplacer ailleurs avec la variable d'environnement `NOVIRA_DATA_DIR`.

| Dossier ou fichier | Contenu |
|---|---|
| `outputs` | Les images, vidéos et sons créés |
| `novira.sqlite` | Les enregistrements : informations sur les images, planches, file, liste des modèles, workflows, etc. |
| `thumbnails` | Les images réduites |
| `models` | Les modèles installés |
| `comfyui` | Le moteur de génération d'images installé par l'application |
| `cache` | Les données temporaires utilisées par le moteur |
| `voice` | La bibliothèque de lecture à voix haute |
| `logs` | Les journaux (voir plus bas) |
| `settings.json` | Les réglages pour utilisateurs avancés (facultatif) |
| `secrets` | Les clés d'API et les jetons (chiffrés) |
| `agent.json` | Le type d'IA choisi dans l'assistant IA |

Le moteur installé par l'application (ComfyUI et Python) et ses données de travail se trouvent aussi dans le dossier de données.

Les réglages de l'écran de l'application (langue, thème, préréglages, historique des discussions de l'IA, etc.) ne sont pas dans `novira-data` mais dans l'espace de stockage de l'interface de l'application.

### Sauvegarde

novira dispose d'une fonction pour créer une sauvegarde et d'une fonction pour restaurer à partir d'une sauvegarde. Pour protéger vos images importantes, utilisez la rubrique **{{ui:share.backup.section}}** de l'écran des paramètres (voir [L'assistant IA et les paramètres](09-assistant-settings.md#sauvegarde)). Une sauvegarde contient les images créées et ce que vous avez réglé ou enregistré dans l'application, mais pas les modèles ni le moteur de génération d'images. Si vous voulez aussi les conserver, copiez vous-même le dossier.

1. Fermez l'application (vérifiez aussi qu'aucune création n'est en cours).
2. Copiez le dossier `novira-data` en entier vers un autre disque, par exemple.

`models` et `comfyui` sont les plus volumineux. Si vous ne gardez que les images et les enregistrements, l'essentiel est `outputs` et `novira.sqlite`. Les modèles de `models` peuvent souvent être retéléchargés depuis leur source, mais ceux dont la distribution a pris fin peuvent ne pas pouvoir être récupérés.

> Les clés d'API et les jetons sont chiffrés par une fonction de Windows. Copiés vers un autre ordinateur ou un autre utilisateur, ils peuvent être illisibles ; dans ce cas, saisissez-les de nouveau dans les paramètres.

Les réglages de l'écran de l'application, les préréglages et l'historique des discussions de l'IA ne sont pas inclus dans cette copie, mais ils figurent dans une sauvegarde.

## Lire les journaux

Les journaux se consultent à 3 endroits.

| Endroit | Contenu |
|---|---|
| {{ui:app.devlog.title}} (dans l'application) | L'enregistrement interne de l'application, ainsi que les avertissements et erreurs de l'écran. Activez l'affichage dans les paramètres (voir [L'assistant IA et les paramètres](09-assistant-settings.md)) |
| `novira-data\logs\novira.log` | L'enregistrement de l'application elle-même. Quand il devient gros (plus de 2 Mo), il passe dans `novira.log.1` |
| `novira-data\logs\comfyui.log` | L'enregistrement du moteur de génération d'images. La raison y figure quand il ne démarre pas ou quand une génération échoue |

Dans les journaux, les nouvelles lignes sont ajoutées en bas. En cas de problème, regardez vers le bas. Les lignes contenant « error » ou « failed » donnent une piste.

## Signaler un problème

Si vous réunissez les éléments suivants, la cause se trouve plus vite.

1. **Ce que vous avez fait et ce qui s'est passé** : l'ordre des opérations, ce que vous attendiez et ce qui s'est réellement produit.
2. **Les mots de l'écran** : recopiez tel quel le texte de l'erreur (**{{ui:queue.detail.error}}** dans l'onglet **{{ui:app.tabs.queue}}**, ou le message apparu en haut de l'écran).
3. **La version de l'application** : elle figure tout en bas de l'écran des paramètres, ou dans **{{ui:app.nav.about}}**.
4. **Le journal développeur** : le texte copié avec **{{ui:app.devlog.copy}}**.
5. **Les fichiers de journal** : `novira.log` et `comfyui.log`, autour de l'heure du problème.
6. **Les informations sur l'ordinateur** : le type de GPU et sa mémoire, la version de Windows.

> Les journaux peuvent contenir des prompts ou des emplacements de fichiers. Avant de les transmettre à quelqu'un, vérifiez qu'ils ne contiennent pas de passages que vous ne voulez pas montrer.

## Réglages avancés

En plaçant un `settings.json` dans le dossier de données, on peut changer le comportement du moteur et d'autres éléments. En général, ce n'est pas nécessaire.

| Nom du réglage | Contenu |
|---|---|
| `comfyuiPackage` | Le type de moteur à installer. `nvidia` (par défaut) ou `amd` |
| `comfyuiUrl` | Se connecter à un ComfyUI déjà en marche (l'application n'installe ni ne lance le moteur) |
| `comfyuiDir` | Utiliser le dossier d'un ComfyUI que vous avez installé vous-même |
| `modelRoots` | Ajouter des dossiers où chercher les modèles |
| `comfyuiStartTimeoutSecs` | Le nombre de secondes d'attente du démarrage du moteur (180 par défaut) |
| `lowMemoryMode` | Le mode économe en mémoire (`true` ou `false`). Quand vous le basculez avec **{{ui:settings.lowMemory.label}}** dans l'écran des paramètres, c'est écrit ici |

Si l'écriture du fichier est cassée, l'application ne démarre pas et affiche la raison. Après une modification, rouvrez l'application.
