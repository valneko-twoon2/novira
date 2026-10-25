# Upscaling und Workflows

Dieses Kapitel erklärt den Tab **{{ui:app.tabs.upscaling}}**, der Bilder vergrößert, und den Tab **{{ui:app.tabs.workflows}}**, in dem Sie Verarbeitungsschritte selbst verbinden und so eigene Abläufe aufbauen.

## Upscaling

![Der Tab Upscaling. In der Mitte stehen eine Ablagefläche für ein Bild und Karten mit den Schritten](shot:upscaling)

Der Tab **{{ui:app.tabs.upscaling}}** vergrößert ein Bild und fügt dabei feine Details hinzu. Das Bild wird nicht einfach gestreckt. Zuerst wird es mit einem Upscaling-Modell vergrößert, danach werden mit dem Prompt und einem Tile-ControlNet die feinen Stellen neu gezeichnet.

### Was Sie dafür brauchen

Sie benötigen die folgenden zwei Modelle. Sind sie nicht installiert, erscheint im linken Bedienfeld ein Hinweis. Über die Schaltfläche **{{ui:params.upscale.openModels}}** gelangen Sie zur Modellansicht. Wie Sie sie installieren, steht im Kapitel [Modelle](08-models.md).

- {{ui:params.upscale.model}} (ein Modell zum Vergrößern von Bildern, etwa Real-ESRGAN)
- Ein {{ui:params.upscale.tileControlnet}}, das zum ausgewählten Hauptmodell passt

Ist kein Upscaling-Modell installiert, listet das linke Bedienfeld Kandidaten auf. Wählen Sie eines der mit **{{ui:media.choice.recommended}}** markierten aus und installieren Sie es mit **{{ui:models.install.install}}**.

### Vorgehen

1. Ziehen Sie das Bild, das Sie vergrößern möchten, aus der Galerie auf die Karte in der Mitte oder auf den Rahmen **{{ui:params.upscale.title}}** im linken Bedienfeld. Sie können auch ein Bild in der Galerie mit der rechten Maustaste anklicken (im Betrachter die Werkzeugleiste verwenden) und **{{ui:gallery.menu.upscale}}** wählen oder ein Bild im Betrachter öffnen und `Shift+U` drücken; der Tab wechselt, und das Bild wird eingesetzt.
2. Wählen Sie das **{{ui:params.upscale.model}}**.
3. Wählen Sie den **{{ui:params.upscale.scale}}** aus 2x, 4x und 8x. Die Größe des Ergebnisses wird angezeigt, etwa „Ausgabe: 2048×2048“.
4. Stellen Sie das Ergebnis mit den folgenden zwei Reglern ein.
   - **{{ui:params.upscale.creativity}}**: Je höher der Wert, desto weiter weicht das Ergebnis vom Originalbild ab und desto mehr neue Details kommen hinzu.
   - **{{ui:params.upscale.structure}}**: Je höher der Wert, desto stärker bleiben Formen und Anordnung des Originalbilds erhalten.
5. Wählen Sie das **{{ui:params.upscale.tileControlnet}}**. Bei Bedarf wählen Sie auch das **{{ui:params.upscale.postProcessing}}** (es veredelt das gezeichnete Bild, danach wird es auf die Ausgabegröße angepasst).
6. Klicken Sie auf **{{ui:params.invoke.invoke}}**.

Das fertige Bild landet in der Galerie.

- Die Ausgabegröße beträgt höchstens 8192 Pixel pro Seite. Wird das überschritten, erscheint eine Warnung; senken Sie dann die Skalierung.
- Der Prompt beeinflusst die hinzugefügten Details. Wenn Sie den Prompt des Originalbilds eingeben, passt die Richtung des Bildes eher.
- Weicht das vergrößerte Bild zu stark vom Original ab, senken Sie **{{ui:params.upscale.creativity}}** und erhöhen Sie **{{ui:params.upscale.structure}}**.

> Um mehrere Bilder auf einmal zu vergrößern, wählen Sie in der Galerie mehrere aus und verwenden **{{ui:gallery.menu.batch}}** im Rechtsklickmenü ([Bilder verbessern und wiederverwenden](04-improve.md)). Dabei wird nur mit dem Upscaling-Modell vergrößert.

## Workflows

![Der Tab Workflows. Rechts die Ansicht, in der die Verbindungen zwischen den Schritten gezeichnet werden, links das Formular](shot:workflows)

Ein Workflow ist eine Funktion, mit der Sie einen Verarbeitungsablauf wie „Modell laden → Prompt eingeben → Bild erzeugen → speichern“ aus verbundenen Bausteinen (Nodes) zusammensetzen. So können Sie detaillierte Abläufe oder Abfolgen mehrerer Verarbeitungsarten aufbauen, die im alltäglichen Tab Generieren nicht möglich sind.

Für den Anfang empfiehlt es sich, unter **{{ui:workflows.panel.templates}}** (siehe den Abschnitt weiter unten) eine Vorlage zu öffnen und zu verwenden.

Der Bildschirm besteht aus zwei Teilen.

- Mitte: der **{{ui:app.views.editor}}**. Hier ordnen Sie Nodes an und verbinden sie mit Linien.
- Linkes Bedienfeld: fünf Tabs, **{{ui:workflows.panel.workflow}}** (das Formular), **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** und **{{ui:workflows.panel.data}}**.

Um einen Workflow auszuführen, klicken Sie oben im linken Bedienfeld auf **{{ui:params.invoke.invoke}}**. Gibt es ein Problem, etwa keinen Ausgabe-Node (wie „{{ui:workflows.nodes.save_image.title}}“) oder kein ausgewähltes Modell, wird der Grund angezeigt, warum nicht generiert werden kann.

### Nodes hinzufügen und verbinden

1. Klicken Sie links oben im Editor auf **{{ui:workflows.toolbar.addNode}}** (＋). Die Liste öffnet sich auch mit `Shift+A` oder `Space` auf der Tastatur.
2. Wählen Sie in der Liste einen Node aus. Mit Wörtern im Suchfeld oben können Sie die Auswahl eingrenzen. Die Liste links grenzt sie nach Art der eingebauten Nodes oder nach installierter Erweiterung ein.
3. Ziehen Sie von einem Kreis (Ausgang) auf der rechten Seite eines Nodes zu einem Kreis (Eingang) auf der linken Seite eines anderen Nodes, um beide zu verbinden. Verbunden werden können nur Anschlüsse derselben Art.

![Die Liste beim Hinzufügen eines Nodes](shot:workflows-add-node)

Beim Verbinden helfen einige praktische Funktionen.

- Lassen Sie eine Linie an einer leeren Stelle los, erscheinen in der Liste nur die Nodes, die dort angeschlossen werden können. Wählen Sie einen aus, wird der Node hinzugefügt und sofort verbunden.
- Lassen Sie eine Linie auf einem Node los, verbindet sie sich automatisch mit einem passenden Eingang.
- Ein ausgewählter Node wird mit `Delete` entfernt. `Ctrl+C` und `Ctrl+V` duplizieren Nodes. `Ctrl+Z` macht rückgängig, `Ctrl+Shift+Z` stellt wieder her.
- Ziehen Sie ein Bild aus der Galerie in den Editor, wird ein Node „{{ui:workflows.nodes.image.title}}“ mit diesem Bild hinzugefügt.
- Der Pfeil links neben dem Namen eines Nodes klappt den Node zusammen. Ein Doppelklick auf den Namen benennt ihn um.

Die Einstellwerte eines Nodes geben Sie direkt im Node ein. Der Wert eines verbundenen Eingangs stammt von dem, womit er verbunden ist.

### Die Schaltflächenleiste

Das sind die Schaltflächen links oben im Editor.

| Schaltfläche | Was sie bewirkt |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | Fügt einen Node hinzu. |
| **{{ui:workflows.toolbar.library}}** | Öffnet die Liste der Workflows. |
| **{{ui:workflows.toolbar.new}}** | Beginnt einen leeren Workflow. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Speichert. Beim ersten Speichern werden Sie nach einem Namen gefragt. |
| **{{ui:workflows.toolbar.optimize}}** | Fasst doppelte Nodes zusammen, entfernt Nodes ohne Verbindung zu einer Ausgabe sowie unnötige Verbindungen und ordnet alles von links nach rechts neu an. Das lässt sich auch rückgängig machen. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

Mit dem Zahnrad **{{ui:workflows.settings.title}}** rechts oben schalten Sie unter anderem die Anzeige der Minimap und das Einrasten am Raster um.

**{{ui:workflows.settings.autoTidy}}** ist von Anfang an eingeschaltet. Wenn Sie Nodes oder Linien hinzufügen oder entfernen, ordnet es nach kurzer Zeit die Nodes automatisch von links nach rechts an und fasst doppelte Nodes zusammen, die dieselbe Aufgabe erfüllen. Wird etwas zusammengefasst, erscheint eine Benachrichtigung, und `Ctrl+Z` stellt es wieder her. Nodes ohne Verbindung werden nicht automatisch entfernt. Wenn Sie selbst anordnen möchten, schalten Sie es aus.

Gibt es ungespeicherte Änderungen, erscheint neben dem Namen ein Punkt. Wechseln Sie zu einem anderen Workflow, werden Sie gefragt, ob die Änderungen verworfen werden dürfen.

### Mit dem Formular arbeiten

Bei vielen Nodes wird der Editor unübersichtlich. Deshalb können Sie ein „Formular“ erstellen, das nur die Einträge versammelt, die Sie bei der Nutzung oft ändern.

1. Klicken Sie im Editor mit der rechten Maustaste auf einen Eintrag (ein Feld) und wählen Sie **{{ui:workflows.node.addToForm}}**.
2. Der Eintrag wird im Tab **{{ui:workflows.panel.workflow}}** des linken Bedienfelds eingereiht.
3. Mit **{{ui:workflows.form.editForm}}** ordnen Sie Einträge neu an oder entfernen sie.

Das ist praktisch, wenn Sie etwas oft ausführen und nur den Prompt oder die Größe ändern. Bei verbundenen Einträgen steht „{{ui:workflows.form.connected}}“.

Im Tab **{{ui:workflows.panel.details}}** können Sie Name, Autor, Tags, Beschreibung usw. eintragen. Im Tab **{{ui:workflows.panel.data}}** können Sie den Inhalt des Workflows (JSON) ansehen und kopieren.

### Die Workflow-Bibliothek

![Die Workflow-Bibliothek](shot:workflows-library)

Klicken Sie auf **{{ui:workflows.library.button}}**, um die Liste zu öffnen.

- **{{ui:workflows.library.recent}}**: Zuletzt geöffnete Workflows.
- **{{ui:workflows.library.yours}}**: Von Ihnen selbst gespeicherte Workflows.
- **{{ui:workflows.library.defaults}}**: Beispiele, die mit der App geliefert werden. Kopieren Sie ein Beispiel mit **{{ui:workflows.library.copyToMine}}** für sich, bevor Sie es ändern.

Sie können suchen, nach Tags filtern und die Sortierung ändern. Mit **{{ui:workflows.library.open}}** öffnen Sie einen Workflow, mit der Papierkorb-Schaltfläche löschen Sie ihn. **{{ui:workflows.library.new}}** und **{{ui:workflows.library.upload}}** finden Sie ebenfalls hier.

### Exportieren und importieren

- Mit **{{ui:workflows.toolbar.download}}** können Sie einen Workflow als JSON-Datei exportieren.
- Mit **{{ui:workflows.toolbar.loadFromFile}}** (oder **{{ui:workflows.library.upload}}**) laden Sie eine selbst exportierte oder von anderen erstellte Datei.
- Verwendet eine geladene Datei Nodes einer Erweiterung, die noch nicht installiert ist, erscheint der Dialog „{{ui:workflows.import.title}}“. Nach der Installation und einem Neustart von ComfyUI öffnet sich dieser Workflow automatisch.
- Sie können einen Workflow auch aus einem Bild herausholen, das mit einem Workflow erzeugt wurde. Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie **{{ui:gallery.menu.loadWorkflow}}**. Wenn das Bild im Betrachter geöffnet ist, geht es auch mit der Taste `W`. Selbst bei einem mit der normalen Generierung erzeugten Bild lässt sich aus seinen Einstellungen derselbe Ablauf aufbauen. Wählen Sie **{{ui:gallery.menu.sendToWorkflow}}**, wenn Sie das Bild als Eingabebild eines Workflows verwenden möchten.

> Ein von anderen erstellter Workflow ist eine Kette von Programmen, die auf Ihrem Computer laufen. Laden Sie keine Datei, deren Herkunft Sie nicht kennen.

## Vorlagen

Der Tab **{{ui:workflows.panel.templates}}** listet Vorlagen für häufig genutzte Kombinationen auf.

- Mit **{{ui:workflows.templates.open}}** öffnen Sie eine Vorlage als neuen Workflow.
- Mit **{{ui:workflows.templates.add}}** fügen Sie sie rechts neben dem aktuellen Editorinhalt ein.
- Modelle und Bilder wählen Sie nach dem Öffnen aus.

Bei einer Vorlage, die Erweiterungen benötigt, erscheint ein Feld „Benötigt“. Klicken Sie auf **{{ui:workflows.templates.installPacks}}**, um sie zu installieren, und starten Sie ComfyUI mit der Schaltfläche **{{ui:workflows.templates.restartFirst}}** neu, dann lässt sie sich öffnen.

Die mitgelieferten Vorlagen sind folgende.

| Vorlage | Was sie macht | Benötigte Erweiterungen |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | Die Grundform, die aus einem Modell und einem Prompt ein Bild erzeugt und speichert. | Keine |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Vergrößert ein mit 1024 erzeugtes Bild auf 2048 und speichert es. | Keine |
| **{{ui:workflows.templates.loraStack.title}}** | Verbindet LoRAs nacheinander mit dem Modell, um Zeichenstil und Details hinzuzufügen. | Keine |
| **{{ui:workflows.templates.image2image.title}}** | Zeichnet ein vorhandenes Bild mit einem anderen Prompt neu. | Keine |
| **{{ui:workflows.templates.upscale.title}}** | Vergrößert ein Bild mit einem Upscaling-Modell in hoher Auflösung. | Keine |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrahiert die Umrisse eines Bildes und zeichnet etwas Neues, das diese Form beibehält. | Keine |
| **{{ui:workflows.templates.imageToVideo.title}}** | Bringt ein einzelnes Bild in Bewegung und erzeugt ein kurzes Video. | Keine (ein Videomodell ist nötig) |
| **{{ui:workflows.templates.filmGrain.title}}** | Fügt einem erzeugten Bild fotografisches Korn hinzu. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Ändert Ausdruck, Blickrichtung und Kopfrichtung in einem Gesichtsfoto. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Vergrößert auf 2048 und zeichnet dann kachelweise neu, um Details hinzuzufügen. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Überträgt den Zeichenstil eines Referenzbilds auf das Bild aus dem Prompt. | ComfyUI_IPAdapter_plus (und sein Modell) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Findet die Gesichter in einem erzeugten Bild und zeichnet sie in hoher Auflösung neu. | Impact Pack und Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Behält nur die Person oder das Objekt und macht den Hintergrund transparent. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Behält nur die Person oder das Objekt und macht den Hintergrund rein weiß. Gut als Vorbereitung, damit die Hintergrundfarbe eines Referenzbilds nicht ins Bild übernommen wird. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrahiert die Pose der Person in einem als Referenz verwendeten Bild und zeichnet ein neues Bild in derselben Haltung. | comfyui_controlnet_aux (und ein ControlNet-Modell für OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Wandelt den Inhalt eines als Referenz verwendeten Bilds in Text um, nutzt ihn als Prompt und zeichnet etwas Neues. | Die Florence-2-Erweiterung |
| **{{ui:workflows.templates.characterReference.title}}** | Setzt das Bild eines Charakters auf weißen Hintergrund, verwendet es als Referenzbild, gleicht Haare, Augen und Kleidung darauf ab und zeichnet eine neue Szene. CFG ist auf einen niedrigeren Wert eingestellt, der zu Referenzbildern passt. | ComfyUI-RMBG und ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Zeichnet mit dem Aussehen des Charakters aus einem Referenzbild und der Haltung aus einer Strichfigur (OpenPose). | Die beiden oben genannten sowie comfyui_controlnet_aux und ein ControlNet-Modell für OpenPose |

Die Vorlagen mit Charakteren sind für den Fall gedacht, dass Sie die Funktion aus [Charakter registrieren und verwenden](04-improve.md#charakter-registrieren-und-verwenden) per Workflow feinjustieren möchten. Normalerweise genügt es, einen im Tab Generieren registrierten Charakter zu verwenden. Eine Strichfigur-Haltung erstellen Sie mit „{{ui:pose.title}}“ in der [Leinwand](05-canvas.md).

## Erweiterungen (Node-Pakete)

Im Tab **{{ui:workflows.panel.packs}}** fügen Sie ComfyUI-Erweiterungen hinzu oder entfernen sie. Erweiterungen sind Zusatzbausteine, die die Zahl der Nodes erhöhen. Die installierten Nodes erscheinen in der Liste zum Hinzufügen von Nodes unter **{{ui:workflows.categories.extension}}**.

Zuerst werden große Kacheln mit der Beschriftung „{{ui:workflows.packs.whatToDo}}“ angezeigt. Wenn Sie wählen, was Sie tun möchten (Gesichter korrigieren, Hintergrund entfernen, größer und detailreicher machen usw.), erscheinen die dazu passenden Erweiterungen mit Erklärungen.

1. Klicken Sie bei der Erweiterung, die Sie verwenden möchten, auf **{{ui:workflows.packs.install}}**.
2. Ist die Installation abgeschlossen, erscheint „{{ui:workflows.packs.restartNeeded}}“. Klicken Sie auf **{{ui:workflows.packs.restart}}**.
3. Nach dem Neustart können die Nodes und Vorlagen dieser Erweiterung verwendet werden.

Manche Erweiterungen tragen einen Warnhinweis, etwa dass Git benötigt wird, dass die Installation Zeit und Speicherplatz braucht oder dass sie längere Zeit nicht aktualisiert wurde. Bitte lesen Sie ihn vor der Installation.

Was nicht im Katalog steht, können Sie mit **{{ui:workflows.packs.byAddress}}** installieren, indem Sie eine GitHub-Adresse eingeben (in der Form https://github.com/Benutzername/Name). Weitere installierte Erweiterungen erscheinen unter **{{ui:workflows.packs.others}}**. Eine nicht benötigte Erweiterung entfernen Sie mit **{{ui:workflows.packs.remove}}** (zur Bestätigung ein zweites Mal klicken).

Die Erweiterungen lassen sich jederzeit einsehen, nicht nur im Workflows-Bildschirm. Klicken Sie in der linken Seitenleiste auf **{{ui:app.nav.extensions}}** (das Puzzleteil-Symbol), um die **{{ui:workflows.packs.mgr.title}}** zu öffnen. Die veröffentlichten Erweiterungen erscheinen als Karten; grenzen Sie sie mit **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** oder einem Zweck in der Liste links ein oder suchen Sie im Feld oben nach Name, Autor oder Beschreibung. **{{ui:workflows.packs.mgr.sort.label}}** beginnt mit den meisten **{{ui:workflows.packs.mgr.sort.downloads}}**. Eine Karte zeigt Autor, Version, Aktualisierungsdatum und Downloadanzahl, bei bereits installierten außerdem **{{ui:workflows.packs.installed}}**. Eine noch nicht installierte Erweiterung fügen Sie mit **{{ui:workflows.packs.install}}** auf ihrer Karte hinzu. Klicken Sie auf eine Karte, um rechts ihre Details zu öffnen, die **{{ui:workflows.packs.mgr.license}}** und die Quelle zu prüfen und bei Bedarf mit **{{ui:workflows.packs.remove}}** zu entfernen. Eine Erweiterung, die nicht in der Liste steht, installieren Sie, indem Sie oben unter **{{ui:workflows.packs.mgr.addTitle}}** ihre GitHub-Adresse eingeben. Nach dem Hinzufügen oder Entfernen von Erweiterungen klicken Sie im selben Bildschirm auf **{{ui:workflows.packs.restart}}**, um die Änderung zu übernehmen. In den Details jeder Karte gibt es die Schaltfläche **{{ui:agent.ask.button}}**, und **{{ui:agent.ask.resultsButton}}** erscheint, wenn Sie ein Wort in das Suchfeld eingeben. Klicken Sie darauf, und der KI-Assistent erklärt, was die Erweiterung tut und wie man sie verwendet (siehe [KI-Assistent und Einstellungen](09-assistant-settings.md)).

Die Details zeigen die aktuell installierte **{{ui:workflows.packs.version.label}}**. **{{ui:workflows.packs.version.change}}** erscheint nur, wenn das Repository der Erweiterung Versionen veröffentlicht; klicken Sie darauf, um die wählbaren Versionen zu sehen, und auf **{{ui:workflows.packs.version.apply}}**, um zu einer zu wechseln. Die aktuell installierte Version ist mit **{{ui:workflows.packs.installed}}** markiert. Eine Erweiterung ohne veröffentlichte Versionen hat diese Schaltfläche nicht. Um die Änderung zu übernehmen, klicken Sie im selben Bildschirm auf **{{ui:workflows.packs.restart}}**. Eine Version, von der bekannt ist, dass eine andere Erweiterung oder ComfyUI sie nicht unterstützt, ist mit **{{ui:workflows.packs.version.deprecated}}** markiert, zusammen mit dem Namen dessen, was sie nicht unterstützt. Bei einer Erweiterung, die Sie selbst installiert haben, lässt sich die Version von hier aus nicht ändern.

Auch die Version von ComfyUI können Sie im selben Bildschirm ändern. Klicken Sie oben in der Liste auf die Karte **{{ui:workflows.packs.version.comfyTitle}}** und rechts auf **{{ui:workflows.packs.version.change}}**, um die wählbaren Versionen aufzulisten. Nachdem Sie auf **{{ui:workflows.packs.version.apply}}** geklickt haben, klicken Sie noch einmal auf **{{ui:workflows.packs.version.confirm}}**, um den Wechsel zu starten. Alle installierten Erweiterungen werden neu installiert, das dauert einige Minuten, und bis zum Ende können keine Bilder erzeugt werden. Startet die neue Version nicht, wird die vorherige wiederhergestellt.

> Erweiterungen sind Programme, die auf Ihrem Computer laufen. Installieren Sie keine, deren Herkunft Sie nicht kennen.

> Sind Sie mit einem ComfyUI verbunden, das nicht von der App verwaltet wird, können Sie von diesem Bildschirm aus nichts installieren. Installieren Sie direkt in diesem ComfyUI.

Funktionen, die Erweiterungen nutzen, wie „{{ui:cutout.menu}}“ und „{{ui:facefix.menu}}“ in [Bilder verbessern und wiederverwenden](04-improve.md), führen Sie bei Bedarf auf dieselbe Weise durch die Installation.
