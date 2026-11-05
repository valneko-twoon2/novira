# Utiliser novira depuis un téléphone

Depuis le navigateur d'un téléphone connecté au Wi-Fi de votre domicile, vous pouvez utiliser novira sur votre ordinateur. C'est l'ordinateur qui dessine les images ; le téléphone ne fait qu'afficher l'écran et recevoir vos commandes. Les paramètres, les brouillons, l'historique, etc. sont les mêmes que lorsque vous ouvrez l'application sur l'ordinateur. Quand des écrans de téléphone ou d'ordinateur sont ouverts en même temps, le prompt, le modèle, les LoRA, les réglages de génération, les préréglages, le recueil de prompts et les brouillons modifiés sur l'un se reflètent en une à deux secondes sur les autres écrans ouverts. Les réglages d'affichage comme la langue, le thème et la taille de l'écran, le contenu en cours d'édition de la toile et des workflows, et la conversation avec l'agent sont propres à chaque écran et s'alignent à la prochaine ouverture. La communication est chiffrée, et le téléphone ne se connecte qu'une fois autorisé sur l'ordinateur.

## Se connecter

1. Cliquez sur **{{ui:app.tabs.short.homeLink}}** dans la barre de gauche de l'application novira. Le réseau sur lequel vous avez cliqué est mémorisé comme celui de votre domicile, et la porte d'entrée s'ouvre.
2. Un code QR s'affiche. Scannez-le avec l'appareil photo d'un téléphone connecté au même Wi-Fi que l'ordinateur et ouvrez l'adresse qui apparaît. Si vous l'avez ouverte avec une application de lecture de codes QR, vous pouvez la rouvrir dans Safari ou Chrome avant de vous connecter. Le code expire au bout de 2 minutes et ne sert qu'une fois, pour un seul téléphone. Quand il a expiré, cliquez sur **{{ui:app.lan.newCode}}**.
3. Avec un téléphone qui se connecte pour la première fois, le navigateur affiche un avertissement de certificat. Installez le certificat en suivant la marche à suivre de la section « Installer le certificat » ci-dessous.
4. Sur l'écran du téléphone, vérifiez le nom de l'appareil et appuyez sur « Se connecter ». Un numéro de confirmation à 6 chiffres s'affiche sur le téléphone. Le même numéro s'affiche sur l'écran **{{ui:app.tabs.short.homeLink}}** de l'ordinateur (ou, s'il n'est pas ouvert, dans la notification au coin de l'écran) : s'il est identique, cliquez sur **{{ui:app.lan.allow}}**. novira s'ouvre sur le téléphone.

Quand vous fermez l'application, la porte d'entrée se ferme aussi, et les téléphones qui étaient connectés se reconnectent à leur prochaine ouverture.

### Se connecter depuis la version navigateur

Vous pouvez vous connecter de la même façon depuis la version navigateur, sans ouvrir l'application. Fermez l'application (un seul programme à la fois peut utiliser le dossier de données), ouvrez dans l'Explorateur le dossier de l'application (celui qui contient `server.bat`), saisissez `cmd` dans la barre d'adresse du haut et appuyez sur Entrée. Dans l'invite de commandes qui s'ouvre, saisissez `server.bat` et appuyez sur Entrée : le même écran s'ouvre dans le navigateur de l'ordinateur, et vous cliquez sur **{{ui:app.tabs.short.homeLink}}** dans la barre de gauche. Pour arrêter, appuyez sur Ctrl+C dans l'invite de commandes, ou fermez cette fenêtre.

### Installer le certificat

novira chiffre la communication avec le téléphone grâce à un certificat créé sur cet ordinateur (novira local CA). Tant que le téléphone ne connaît pas ce certificat, le navigateur avertit que « la connexion n'est pas sécurisée ». Il suffit d'installer le certificat une seule fois, au début. Ouvrez « Installer le certificat », en bas de l'écran du téléphone, et téléchargez le certificat avec le lien.

- iPhone : appuyez sur le lien puis sur « Autoriser », et installez le profil depuis « Profil téléchargé », tout en haut de l'app Réglages. Ensuite, dans Réglages, « Général », « Informations », « Réglages des certificats de confiance », activez novira local CA. Si vous oubliez cette dernière étape, l'avertissement ne disparaît pas, même une fois le certificat installé.
- Android (Chrome) : dans les paramètres, « Sécurité », « Installer un certificat », « Certificat d'autorité de certification », choisissez le certificat téléchargé. Firefox n'utilise pas les certificats installés après coup. Ouvrez-le avec Chrome.

### Fermeture

Il n'y a pas de bouton pour fermer la porte d'entrée du réseau domestique. Même si vous fermez la fenêtre contextuelle, les téléphones connectés restent utilisables.

- Quand personne ne l'utilise pendant 30 minutes et qu'aucun code ni aucune demande d'approbation n'est en attente, elle se ferme automatiquement.
- Elle se ferme aussi automatiquement quand le réseau n'est plus un réseau de confiance, par exemple si vous passez sur un autre Wi-Fi.
- Les téléphones connectés peuvent être déconnectés un par un avec la croix de la liste. La connexion d'un téléphone est coupée au bout de 30 minutes sans utilisation, ou 4 heures après la connexion.

### Quand Windows pose la question

À la première ouverture de la porte d'entrée, Windows demande s'il faut autoriser les communications de novira (de novira-server pour la version navigateur). Autorisez les communications sur les réseaux privés.

Si Windows traite le réseau utilisé comme un réseau « public », un avertissement s'affiche à l'écran. N'ouvrez la porte que sur votre propre réseau. Si le téléphone ne parvient pas à se connecter, ouvrez dans les « Paramètres » de Windows, « Réseau et Internet », les propriétés du Wi-Fi (ou du réseau filaire) utilisé, et réglez le type de profil réseau sur « Réseau privé ».

### Appareils qui peuvent se connecter et précautions

- Seuls répondent les appareils situés sur le même réseau que cet ordinateur (la même plage du même routeur). Un téléphone en déplacement ou passant par un VPN ne peut pas se connecter. En déplacement, utilisez la méthode de la section suivante, « Utiliser depuis l'extérieur ».
- Même un appareil sur le même Wi-Fi ne peut pas s'en servir sans l'autorisation donnée sur l'ordinateur. Ne montrez pas le code QR à d'autres personnes. Si le numéro de confirmation est différent, ou si vous ne reconnaissez pas le téléphone, cliquez sur **{{ui:app.lan.deny}}**.
- La communication est chiffrée en https.
- Sur un réseau inconnu (un café, etc.), ne cliquez pas sur **{{ui:app.tabs.short.homeLink}}**. Le réseau sur lequel vous avez cliqué devient un réseau de confiance, et la porte d'entrée s'ouvre.

## Utiliser depuis l'extérieur

Avec [Tailscale](https://tailscale.com/), vous pouvez aussi utiliser novira sur votre ordinateur depuis un téléphone situé à l'extérieur. Il n'est pas nécessaire d'ouvrir des ports sur le routeur. Le téléphone se connecte avec une clé d'accès (visage, empreinte, code) enregistrée une fois chez vous.

### Préparation

1. Installez Tailscale sur l'ordinateur et sur le téléphone, et connectez-vous avec le même compte. Activez la validation en deux étapes sur le compte Tailscale.
2. Dans la console d'administration de Tailscale (réglages DNS), activez MagicDNS et les certificats HTTPS.
3. Ne mettez pas dans le nom de l'ordinateur sur Tailscale des mots que vous ne voulez pas rendre publics, comme votre vrai nom. Quand un certificat est créé, le nom de l'ordinateur et le nom du tailnet figurent dans le journal public des certificats (Certificate Transparency). Le nom seul ne permet pas d'entrer.

### Activer et enregistrer le téléphone

1. Cliquez sur **{{ui:app.tabs.short.homeLink}}** dans la barre de gauche et ouvrez l'onglet **{{ui:app.lan.tabAway}}**.
2. Activez **{{ui:app.remote.switch}}**. Quand le nom de l'ordinateur sur Tailscale (un nom comme `pc.tail1234.ts.net`) s'affiche, tout est prêt. Si l'ouverture est impossible, la raison s'affiche. Le réglage activé est conservé à la prochaine ouverture de novira.
3. Activez Tailscale sur le téléphone, puis scannez le code QR qui s'affiche quand vous cliquez sur **{{ui:app.remote.enrol}}**. L'enregistrement ne peut se faire que chez vous (car il faut l'autoriser sur l'ordinateur).
4. Sur le téléphone, vérifiez le nom et appuyez sur « Commencer l'enregistrement ». Si le numéro de confirmation affiché sur l'ordinateur est identique, cliquez sur **{{ui:app.lan.allow}}**.
5. Sur le téléphone, appuyez sur « Créer une clé d'accès » et validez avec le visage, l'empreinte ou le code. L'appareil enregistré s'ajoute à la liste **{{ui:app.remote.passkeys}}**.

### Ouvrir depuis l'extérieur

Activez Tailscale sur le téléphone, ouvrez l'adresse utilisée lors de l'enregistrement (`https://pc.tail1234.ts.net:numéro-de-port/`) et appuyez sur « Se connecter avec une clé d'accès ». Il est pratique de l'ajouter aux favoris. Il faut que novira (ou la version navigateur) soit ouvert sur l'ordinateur et que Tailscale y soit connecté.

- Ce que l'on peut faire est identique à une connexion par le Wi-Fi du domicile. L'installation de modèles et d'extensions, les réglages du moteur, les clés et les réglages de l'agent ne se font que sur l'ordinateur.
- La connexion est coupée au bout de 30 minutes sans utilisation, ou 4 heures après la connexion. Reconnectez-vous avec la clé d'accès.
- **{{ui:app.remote.log}}** affiche la date et l'appareil de chaque enregistrement, connexion et refus. Si vous voyez quelque chose que vous ne reconnaissez pas, supprimez l'enregistrement de cet appareil et changez aussi le mot de passe de Tailscale.
- Si vous avez perdu votre téléphone, cliquez deux fois sur le bouton de corbeille de **{{ui:app.remote.passkeys}}** pour supprimer son enregistrement. La connexion de cet appareil est aussi coupée immédiatement. Retirez également cet appareil dans la console d'administration de Tailscale.
- {{ui:app.remote.switch}} se désactive automatiquement si aucun enregistrement ni aucune connexion n'a lieu pendant 14 jours.

## L'écran du téléphone

Sur un téléphone, l'écran qui s'ouvre est adapté au téléphone. Il bascule automatiquement sur un écran étroit, y compris en mode paysage. En haut se trouve une barre avec le logo de l'application (et l'image en cours de dessin) et le bouton de l'agent ; en bas s'alignent 6 onglets.

![L'onglet de génération du téléphone. Les préréglages, la seed et le bouton de génération, le modèle et le prompt s'alignent verticalement](shot:phone-generate)

| Onglet | Ce que l'on peut faire |
|---|---|
| **{{ui:app.tabs.generate}}** | Les mêmes éléments que dans le panneau de gauche de l'ordinateur s'alignent verticalement, dans le même ordre ([Générer](02-generate.md)). Les préréglages, {{ui:params.seed.label}} et le bouton **{{ui:params.invoke.invoke}}**, le modèle, le prompt, les images de référence, la correction haute résolution et les réglages détaillés s'utilisent comme sur l'ordinateur. La ligne de {{ui:params.seed.label}} et du bouton **{{ui:params.invoke.invoke}}** reste en haut quand on fait défiler |
| **{{ui:phone.gallery}}** | Quand vous choisissez une **{{ui:phone.board}}**, les images de cette planche s'alignent sur 3 colonnes. L'image en cours de dessin apparaît en premier. Un appui l'ouvre en plein écran |
| **{{ui:app.views.drafts}}** | Comme les brouillons de l'ordinateur ([Choisir parmi des brouillons](04-improve.md#choisir-parmi-des-brouillons)). Le bouton **{{ui:drafts.open}}** d'une proposition permet de voir cette image en plein écran |
| **{{ui:app.tabs.queue}}** | Les éléments en attente s'alignent, du plus récent au plus ancien. L'icône de l'onglet indique le nombre d'éléments en attente et en cours de dessin |
| **{{ui:app.tabs.models}}** | Comme l'onglet {{ui:app.tabs.models}} de l'ordinateur ([Modèles](08-models.md)). L'écran étant petit, les cartes commencent à la plus petite taille |
| **{{ui:app.tabs.browse}}** | Comme l'onglet {{ui:app.tabs.browse}} de l'ordinateur. Vous pouvez chercher et installer des modèles sur Civitai et Hugging Face. La recherche et les filtres se trouvent dans le bouton **{{ui:browse.menu}}** en haut à gauche, où **{{ui:browse.cardSize}}** permet de changer la taille des cartes de la liste (elles commencent à la plus petite taille) |

Pendant qu'une image est dessinée, la barre du haut affiche l'image en cours et l'avancement. Un appui permet de voir en plein écran comment elle se dessine. Une fois le dessin terminé, elle se change en l'image obtenue.

Dans l'onglet **{{ui:app.tabs.models}}**, quand vous appuyez sur un modèle, comme dans l'onglet **{{ui:app.tabs.browse}}**, les détails s'ouvrent sur tout l'écran. **{{ui:models.detail.close}}**, en haut, revient à la liste. La liste du bouton **{{ui:params.promptBook.open}}**, sous le prompt, s'ouvre aussi en plein écran, et la flèche en haut à gauche permet de revenir.

Quand vous ouvrez une liste de modèles, de LoRA, de préréglages, etc., le clavier n'apparaît pas. Pour saisir quelque chose, appuyez sur le champ de recherche.

### Voir en plein écran

![Une image ouverte en plein écran, avec les informations du prompt et du modèle](shot:phone-picture)

- Écartez deux doigts pour zoomer, pincez pour dézoomer. Une image zoomée se déplace avec un doigt.
- Quand elle n'est pas zoomée, glissez le doigt sur le côté pour passer à l'image voisine de la planche. Les boutons gauche et droit le permettent aussi.
- Un double appui bascule entre le zoom et la taille d'origine.
- Le bouton **{{ui:gallery.viewer.toggleMetadata}}** affiche le prompt, le modèle, la seed et la taille.
- Le bouton à trois barres en haut à droite (**{{ui:phone.pictureMenu}}**) ouvre le même menu que le clic droit sur une image dans l'ordinateur. Un appui long sur l'image l'ouvre aussi. Les éléments qui envoient vers des endroits absents de l'écran du téléphone, comme la toile ou les workflows, n'apparaissent pas.
- Les boutons du bas permettent de **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (met les réglages de cette image dans l'onglet de génération) et **{{ui:common.delete}}**. La confirmation avant la suppression suit **{{ui:settings.confirmOnDelete}}** dans les paramètres.

### Gérer la file

![L'onglet de la file du téléphone. Les éléments en cours de dessin et en attente](shot:phone-queue)

- **{{ui:queue.action.pause}}** en haut (**{{ui:queue.action.resume}}** quand elle est arrêtée) arrête ou reprend le traitement de la file.
- **{{ui:queue.action.prune}}** retire de la liste les éléments terminés (réussis, en échec, annulés).
- Les éléments en attente et en cours de dessin s'annulent avec la croix de droite. Les éléments en échec et annulés se relancent avec le bouton **{{ui:queue.action.retry}}** de droite.
- Un appui sur un élément en cours de dessin ou terminé ouvre cette image en plein écran.

### Parler à l'agent

![L'agent sur le téléphone. La demande et ce que l'agent a réglé](shot:phone-chat)

Un appui sur le bouton en forme d'étincelles (**{{ui:agent.open}}**) de la barre du haut ouvre l'agent sur tout l'écran. Il fait la même chose que sur l'ordinateur ([Agent](09-assistant-settings.md#agent)).

- Dans le champ du bas, écrivez l'image que vous voulez ou votre question, et envoyez avec le bouton d'envoi à droite. La touche Entrée fait un retour à la ligne. Le bouton en forme de trombone, à gauche, permet de joindre une photo du téléphone.
- Les réglages modifiés par l'agent entrent dans l'onglet **{{ui:app.tabs.generate}}** du téléphone. **{{ui:agent.generate}}**, sous la réponse, permet de générer tout de suite, et **{{ui:agent.undo}}** de revenir en arrière.
- Le bouton de droite de la barre du haut permet d'ouvrir **{{ui:agent.session.history}}** ou de commencer **{{ui:agent.session.new}}**. La flèche de gauche revient à l'écran précédent.
- Le choix de l'IA à utiliser et la connexion se font sur l'écran de l'ordinateur. Si ce n'est pas encore fait, le téléphone l'indique.

Ce qui ne figure pas parmi les 6 onglets, comme la toile, les workflows, la BD et les paramètres, s'utilise sur l'ordinateur.
