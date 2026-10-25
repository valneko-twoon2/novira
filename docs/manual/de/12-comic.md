# Comic

![Der gesamte Tab Comic. Links dieselben Einstellungen wie im Tab Generieren, in der Mitte eine leere Comic-Seite](shot:comic)

**{{ui:app.tabs.comic}}** ist eine Werkbank zum Erstellen von Comicseiten. In der Symbolreihe ganz oben im linken Bedienfeld des Tabs {{ui:app.tabs.generate}} öffnen Sie sie mit dem Symbol ganz rechts, einem Buch (auch die Taste 3 öffnet sie). Comics werden in Projekten zusammengefasst. In einem Projekt liegen Seiten, jede Seite ist in Bildfelder aufgeteilt, und für jedes Bildfeld wird ein Bild gezeichnet. In ein Bildfeld können außer einem gezeichneten Bild auch ein Galeriebild oder eine Pose gesetzt werden. Mit Sprechblasen und Erzähltexten lässt sich die Seite als ein einziges Bild speichern.

Der Bildschirm ist in drei Bereiche geteilt.

- Links: von oben nach unten stehen {{ui:presets.label}} und {{ui:params.seed.label}} wie im Tab {{ui:app.tabs.generate}}, die Liste der Comics und {{ui:params.model.label}}. Darunter liegt der Bereich **{{ui:params.prompt.title}}** mit den Prompts des gewählten Bildfelds. Weiter unten folgen die Schaltfläche zum Zeichnen des gewählten Bildfelds und die Schaltfläche zum Zeichnen aller Bildfelder, der Bereich für das Referenzbild sowie die ausführlichen Generierungseinstellungen. Klicken Sie auf die Überschrift einer Einstellung, um deren Bereich zu öffnen oder zu schließen.
- Mitte: die {{ui:app.views.comic}}. In der Werkzeugleiste darüber stehen die Seiteneinstellungen, die Vorlagen, das Werkzeug zum Teilen von Bildfeldern, die Feldwerkzeuge (Sprechblasen und Erzähltexte, Pose, Feldvorlagen), die Bildwerkzeuge und die Schaltfläche, die die Seite in ein Bild umwandelt. Unter der Seite befinden sich Rückgängig und Wiederherstellen, der Seitenwechsel und der Zoomfaktor.
- Rechts: die Galerie. Die in Bildfeldern gezeichneten Bilder kommen ebenfalls in die Galerie.

## Einen Comic erstellen

![Die Liste der Comics oben links. Eine Miniatur der ersten Seite, der Name des Comics und die Anzahl der Seiten](shot:comic-project)

1. Öffnen Sie oben links die Liste der Comics, klicken Sie ganz unten auf **{{ui:comic.project.new}}** und geben Sie einen Namen ein. Gibt es noch keinen Comic, können Sie auch mit **{{ui:comic.project.new}}** in der Mitte einen erstellen.
2. Eine Seite beginnt mit 3 Bildfeldern. Um eine Seite hinzuzufügen, klicken Sie unter der Seite auf **{{ui:comic.page.add}}**.
3. Klicken Sie auf der Seite auf das Bildfeld, das Sie zeichnen möchten. Schreiben Sie links in den Bereich **{{ui:params.prompt.title}}** die Beschreibung des Bildes und klicken Sie auf **{{ui:comic.panel.draw}}**.
4. Um alle Bildfelder der Seite nacheinander zu zeichnen, klicken Sie neben **{{ui:comic.panel.draw}}** auf **{{ui:comic.page.drawAll}}**.

Die Liste der Comics zeigt für jeden Comic eine Miniatur der ersten Seite und die Anzahl der Seiten. Wählen Sie einen Comic in der Liste, um ihn zu öffnen. Umbenennen und Löschen erfolgen über das Menü rechts in jeder Zeile.

Zum Zeichnen eines Bildes muss ein Modell ausgewählt sein. Ein Bildfeld mit leerem Prompt lässt sich nicht zeichnen. Prompts wirken am besten, wenn Sie sie als englische Schlagwörter schreiben. Das gezeichnete Bild kommt in dieses Bildfeld und zusätzlich in die Galerie. Ein Bildfeld, das nicht gezeichnet werden konnte, zeigt auf der Seite **{{ui:comic.draw.failed}}**.

## Die Prompts eines Bildfelds

Im Tab Comic enthält der Bereich **{{ui:params.prompt.title}}** links die Prompts des gewählten Bildfelds. Wenn Sie ein anderes Bildfeld wählen, wechselt der Text im Bereich zu dem dieses Bildfelds. Jedes Bildfeld hat genau ein Paar aus **{{ui:params.prompt.positive}}** und **{{ui:params.prompt.negative}}**. Im Tab Comic ist immer genau ein Bildfeld gewählt.

Der Bereich funktioniert wie im Tab {{ui:app.tabs.generate}}. Wenn Sie eine {{ui:presets.label}} laden, kommen ihre Prompts in das gewählte Bildfeld. Auch die **{{ui:params.promptBook.title}}** und die Prompt-Vorgaben kommen in das gewählte Bildfeld. Wenn Sie zum Tab {{ui:app.tabs.generate}} zurückkehren, sind dort wieder die Prompts zu sehen, die Sie im Tab {{ui:app.tabs.generate}} geschrieben hatten.

Das Bild eines Bildfelds wird nur mit den Prompts dieses Bildfelds gezeichnet. Die Prompts anderer Bildfelder und die des Tabs {{ui:app.tabs.generate}} werden nicht hinzugefügt.

Die Schreibweise dynamischer Prompts (die Klammern für Kombinationen und die Wildcards) funktioniert auch im Comic. Bei **{{ui:params.prompt.modeRandom}}** zeichnet das Bild genau eine Kombination, die der Seed dieses Bildes auswählt. Bei **{{ui:params.prompt.modeCombinatorial}}** wird jede Kombination einzeln gezeichnet. Die erste Kombination kommt in das Bildfeld; die Bilder der übrigen Kombinationen kommen nur in die Galerie, nicht in das Bildfeld. Gibt es mehrere Kombinationen, weist ein Hinweis darauf hin.

## Seiteneinstellungen

Klicken Sie oben in der Mitte auf **{{ui:comic.page.settings}}**, um die Einstellungen der Seite zu öffnen.

Die Anzahl der Bildfelder einer Seite ändern Sie im Feld **{{ui:comic.page.panelCount}}** von 1 bis 24. Wenn Sie die Anzahl ändern, wird die Aufteilung der Seite automatisch neu berechnet. Eine Seite, deren Bildfeld-Formen von Hand geändert wurden, kehrt beim Ändern der Anzahl ebenfalls zur automatischen Aufteilung zurück.

Die Anzahl der Spalten einer Seite wählen Sie mit **{{ui:comic.page.columns}}** von 1 bis 3 Spalten. Mit **{{ui:comic.page.direction}}** legen Sie fest, in welcher Richtung die Bildfelder gelesen werden. Manga werden normalerweise „Von rechts nach links (Manga)“ gelesen, deshalb beginnt eine neue Seite in dieser Richtung. Wenn Sie die Richtung ändern, werden die Bildfelder links und rechts vertauscht.

Wenn Sie die Anzahl der Bildfelder verringern, werden die hinteren Bildfelder entfernt. Die Bilder der entfernten Bildfelder bleiben in der Galerie erhalten.

Das Papierformat stellen Sie mit **{{ui:comic.page.size}}** ein: A4, A5, B4 oder B5. Das Verhältnis von Breite zu Höhe der Seite entspricht diesem Papier. Das gespeicherte Bild der Seite hat die Größe des Papiers bei 200 dpi (A4 etwa 1654 × 2339 px).

Mit **{{ui:comic.page.frameWidth}}** stellen Sie die Stärke der Rahmenlinien der Bildfelder ein, von 0 mm bis 3 mm (anfangs 0,6 mm). Mit **{{ui:comic.page.inset}}** legen Sie den Abstand zwischen Rahmenlinie und Bild fest, von 0 mm bis 10 mm (anfangs 0 mm, das Bild schließt also direkt an die Linie an). Beide Werte gelten für alle Bildfelder der Seite, und das gespeicherte Seitenbild wird mit derselben Stärke und demselben Abstand gezeichnet.

## Seiten wechseln und zoomen

Unten in der Mitte unter der Seite stehen Schaltflächen mit den Seitennummern. Klicken Sie auf eine Nummer oder auf die Pfeile links und rechts, um zu einer anderen Seite zu wechseln. Mit **{{ui:comic.page.add}}** fügen Sie eine Seite hinzu, mit der Papierkorb-Schaltfläche löschen Sie die gerade geöffnete Seite (bestätigen Sie mit einem zweiten Klick). Auch wenn es mehr Seiten werden, bleiben die Nummern-Schaltflächen in einer Zeile, und was nicht hineinpasst, lässt sich seitwärts scrollen. Die Nummer der geöffneten Seite rückt in den sichtbaren Bereich.

Die Anzeigegröße der Seite ändern Sie mit den Schaltflächen **{{ui:common.zoomIn}}** und **{{ui:common.zoomOut}}** unten rechts unter der Seite. Auch mit gedrückter Strg-Taste und dem Mausrad können Sie um die Position des Mauszeigers herum vergrößern und verkleinern. Ein Klick auf die Zahl des Zoomfaktors setzt ihn auf 100 % zurück.

## Vorlagen

![Die Liste der Seitenvorlagen. Die Aufteilungen werden als kleine Bilder angezeigt](shot:comic-templates)

Klicken Sie oben in der Mitte auf **{{ui:comic.template.pageTitle}}**, um die Liste der Seitenvorlagen zu öffnen. Jede Vorlage wird als kleines Bild ihrer Aufteilung angezeigt. Ein Klick auf ein Bild wendet diese Vorlage auf die gerade geöffnete Seite an.

In der Liste stehen die 5 Standardaufteilungen („{{ui:comic.template.builtin.single}}“, „{{ui:comic.template.builtin.strip}}“, „{{ui:comic.template.builtin.four}}“, „{{ui:comic.template.builtin.six}}“ und „{{ui:comic.template.builtin.nine}}“), die Formvorlagen für Bildfelder (insgesamt 10, mit schrägen Schnitten und Kombinationen aus großen und kleinen Bildfeldern) und die gespeicherten Vorlagen. Die Standardaufteilungen werden mit der Leserichtung und dem Papierformat dieser Seite angewendet. Eine Formvorlage übernimmt die Leserichtung dieser Seite, und ihre Bildfelder werden dazu gespiegelt. Gespeicherte Vorlagen erhalten die Leserichtung und das Papierformat, die beim Speichern eingestellt waren. Wenn die Anzahl der Bildfelder sinkt, wechselt der Text unter dem Bild zu **{{ui:comic.template.applyAgain}}**. Ein erneuter Klick wendet die Vorlage an; dabei werden die Bilder und Sprechblasen der hinteren Bildfelder entfernt.

Um die Aufteilung dieser Seite zu speichern, geben Sie unter der Liste einen Namen ein und klicken Sie auf **{{ui:comic.template.savePage}}**. Lassen Sie den Namen leer, erhält die Vorlage den Namen „Vorlage“ mit einer Nummer. Vorlagen werden in diesem Projekt gespeichert.

Eine Feldvorlage speichert den Prompt, den negativen Prompt, die Pose, die Sprechblasen und das Referenzbild des gewählten Bildfelds. Das Bild wird nicht gespeichert. Geben Sie im Bereich, der sich mit **{{ui:comic.template.panelTitle}}** oben in der Mitte öffnet, einen Namen ein und klicken Sie auf **{{ui:comic.template.save}}**. Bei einem anderen Bildfeld klicken Sie in der Zeile der gespeicherten Vorlage auf **{{ui:comic.template.apply}}**, dann wird sie in dieses Bildfeld übernommen. Übernommen werden der Prompt, der negative Prompt, die Pose, die Sprechblasen und das Referenzbild. Das Bild dieses Bildfelds bleibt erhalten.

## Die Form der Bildfelder ändern

![Seite mit geänderten Bildfeldern: das obere Bildfeld ist schräg geteilt, die Ecken des gewählten Bildfelds sind als Punkte zu sehen](shot:comic-shapes)

Die Form der Bildfelder lässt sich von Hand ändern, auch wenn die Seite automatisch aufgeteilt ist. Klicken Sie oben in der Mitte auf **{{ui:comic.shape.cut}}**, und ziehen Sie dann eine Linie von einem Rand des Bildfelds zum anderen: Das Bildfeld wird in zwei geteilt. Eine Linie, die das Bildfeld nicht in zwei teilt (eine Linie außerhalb des Bildfelds oder eine, die nur eine Ecke berührt), schneidet nichts.

Um ein Bildfeld hinzuzufügen, klicken Sie auf **{{ui:comic.shape.addPanel}}** neben **{{ui:comic.shape.cut}}**. Das gewählte Bildfeld (oder, wenn keines gewählt ist, das größte) wird durch eine Linie, die seine längere Seite halbiert, in zwei geteilt, und das neue Bildfeld wird gewählt. Hat die Seite bereits 24 Bildfelder oder ist das Bildfeld zu klein, lässt sich keines hinzufügen.

Um ein Bildfeld zu entfernen, wählen Sie es aus und klicken Sie auf **{{ui:comic.shape.removePanel}}**. Sein Bild, seine Prompts und seine Sprechblasen werden mit entfernt. Bei automatischer Aufteilung werden die übrigen Bildfelder neu angeordnet. Auf einer Seite, deren Bildfeld-Formen von Hand geändert wurden, wächst das nächstgelegene Nachbar-Bildfeld in den frei gewordenen Platz und behält seinen eigenen Inhalt; lässt die Form eine solche Vereinigung nicht zu, kehrt die Seite zur automatischen Aufteilung zurück. Das letzte Bildfeld einer Seite lässt sich nicht löschen. Ein gelöschtes Bildfeld lässt sich mit Strg+Z zurückholen (das erneute Einsetzen eines Bildes in ein Bildfeld wird nicht rückgängig gemacht).

Um die Auswahl des Bildfelds aufzuheben, klicken Sie auf den Rand der Seite oder auf eine beliebige leere Stelle um die Seite.

Das gewählte Bildfeld zeigt seine Ecken als runde Punkte. Ziehen Sie eine Ecke, um die Form des Bildfelds zu ändern. Eine Ecke, die ein Nachbarfeld teilt, bewegt sich mit diesem. Ein Doppelklick auf eine Kante fügt eine Ecke hinzu, ein Doppelklick auf eine gerade Ecke entfernt sie. Eine Ecke wird nicht an eine Stelle gezogen, an der sich Bildfelder überlappen würden oder eine Kante eine andere kreuzen würde.

In der Mitte jeder Kante des gewählten Bildfelds erscheint ein kleiner Balken (der Kantengriff). Wenn Sie den Griff ziehen, verschiebt sich die ganze Kante, und die Nachbarfelder ändern ihre Form mit. Über den Seitenrand hinaus bewegt sich eine Kante nicht.

Auf einer Seite, deren Bildfeld-Formen von Hand geändert wurden, klicken Sie in den **{{ui:comic.page.settings}}** auf **{{ui:comic.shape.reset}}**, um zur automatischen Aufteilung zurückzukehren. Auch das Ändern der Anzahl der Bildfelder oder der Spalten führt zur automatischen Aufteilung zurück. Mit Strg+Z machen Sie eine Formänderung rückgängig.

## Das Bild eines Bildfelds

![Ein Bild in einem Bildfeld. Um das verkleinerte und gedrehte Bild herum sind die Griffe an den vier Ecken und oben zu sehen](shot:comic-image)

Das Bild eines Bildfelds ist nicht nur ein gezeichnetes Bild. Wenn Sie ein Galeriebild auf ein Bildfeld ziehen, wird es zum Bild dieses Bildfelds. Wählen Sie ein Bildfeld und klicken Sie oben in der Mitte auf **{{ui:comic.panel.imageUpload}}**, um eine Bilddatei von Ihrem Computer zu wählen. Die Datei kommt zuerst in die Galerie und wird dann zum Bild des Bildfelds.

Das Bild eines Bildfelds bearbeiten Sie direkt auf der Seite, wie auf der {{ui:app.tabs.canvas}}.

- Ziehen Sie das Bild, um es zu verschieben. Ein Teil des Bildes darf auch über das Bildfeld hinausragen.
- Klicken Sie auf das Bild, um es auszuwählen: Um das Bild erscheinen ein gestrichelter Rahmen und Griffe. Der Teil, der über das Bildfeld hinausragt, ist blass zu sehen.
- Ziehen Sie einen der Eckgriffe, um das Bild um seine Mitte zu vergrößern oder zu verkleinern.
- Ziehen Sie den runden Griff oben, um das Bild zu drehen. Mit gedrückter Umschalt-Taste dreht es sich in 15°-Schritten.
- Das ausgewählte Bild verschieben Sie mit den Pfeiltasten in kleinen Schritten (mit Umschalt in großen Schritten).

Auch mit den Werkzeugen oben in der Mitte lässt sich das Bild ändern. **{{ui:comic.image.fitCover}}** hebt die Drehung auf und füllt das Bildfeld ganz aus. **{{ui:comic.image.fitContain}}** passt das Bild so an, dass es vollständig in das Bildfeld passt. **{{ui:comic.image.rotateLeft}}** und **{{ui:comic.image.rotateRight}}** drehen um je 90°, **{{ui:comic.image.flipX}}** und **{{ui:comic.image.flipY}}** spiegeln das Bild. **{{ui:comic.image.scaleDown}}** und **{{ui:comic.image.scaleUp}}** verkleinern und vergrößern es schrittweise, und **{{ui:comic.image.center}}** rückt die Mitte des Bildes in die Mitte des Bildfelds.

Um das Bild aus dem Bildfeld zu entfernen, wählen Sie es und drücken Sie die Entf-Taste, oder klicken Sie oben in der Mitte auf **{{ui:comic.panel.imageClear}}**. Auch danach bleibt das Bild in der Galerie erhalten. Klicken Sie in der Meldung, die direkt danach erscheint, auf **{{ui:comic.history.undo}}**, kehrt das Bild mit seiner vorherigen Position und Größe zurück. Wenn Sie ein anderes Bild einfügen, werden Position und Größe zurückgesetzt.

## Bildfelder tauschen

Fassen Sie den Griff mit den sechs Punkten (⠿) oben links im Bildfeld, ziehen Sie ihn auf das Bildfeld, mit dem Sie tauschen möchten, und lassen Sie ihn los. Dann tauschen die beiden Bildfelder ihre Plätze. Das Bild, die Prompts, die Pose und die Sprechblasen wandern mit ihrem Bildfeld mit.

Wenn Sie den Griff drücken und ziehen, folgt dem Mauszeiger eine halbtransparente Kopie des Bildfelds, das Sie bewegen. Das Bildfeld, mit dem getauscht wird, ist mit einem Rahmen markiert.

## Die Pose festlegen

![Der Bildschirm mit der Strichfigur, mit der die Pose eines Bildfelds festgelegt wird](shot:comic-pose)

Wählen Sie ein Bildfeld, klicken Sie oben in der Mitte auf die Pose-Schaltfläche, um den Bereich zu öffnen, und klicken Sie dann auf **{{ui:comic.panel.pose}}**, dann öffnet sich ein Bildschirm mit einer Strichfigur. Die Pose wird in der Form dieses Bildfelds gezeichnet. Mit **{{ui:comic.pose.use}}** wird sie zur Pose dieses Bildfelds. Die Pose lässt sich erneut öffnen und korrigieren. Die auf diesem Bildschirm festgelegte Pose gilt für eine Person. Zum Entfernen klicken Sie auf **{{ui:comic.panel.poseRemove}}**.

![Der Bereich der Posen-Vorlage des Bildfelds. Kategorie und Pose wählen](shot:comic-presets)

Im selben Bereich lässt sich eine Pose auch aus denselben fertigen Posen wählen wie auf der Leinwand. Wählen Sie mit **{{ui:comic.panel.poseCategory}}** eine Kategorie, mit **{{ui:comic.panel.posePreset}}** eine Pose und klicken Sie auf **{{ui:comic.panel.poseApply}}**. Passend zur Größe des Bildfelds werden Strichfiguren erzeugt, die zur Pose dieses Bildfelds werden. Je nach Komposition stehen mehrere Personen nebeneinander. In diesem Fall passen alle ins Bildfeld.

Damit die Pose im Bild berücksichtigt wird, muss ein ControlNet-Modell für Posen (OpenPose oder ein Union-Modell) installiert sein. Ist es nicht installiert, wird die Pose im Bild nicht verwendet, und es erscheint ein entsprechender Hinweis.

## Sprechblasen und Erzähltext

![Eine gerade hinzugefügte Sprechblase. Die Bearbeitung der Sprechblase liegt rechts über dem Board](shot:comic-balloon)

Wählen Sie ein Bildfeld, klicken Sie oben in der Mitte auf **{{ui:comic.panel.bubbles}}**, um den Bereich zu öffnen, und klicken Sie dann auf **{{ui:comic.bubble.kind.speech}}**, **{{ui:comic.bubble.kind.thought}}**, **{{ui:comic.bubble.kind.shout}}** oder **{{ui:comic.bubble.kind.caption}}**. Die Sprechblase dieser Art kommt dann in dieses Bildfeld, und **{{ui:comic.bubble.editor}}** öffnet sich rechts über dem Board. Im Bereich stehen die Sprechblasen des Bildfelds mit Art und Text. Ein Klick auf eine Zeile wählt diese Sprechblase, ein Klick auf die Stift-Schaltfläche (**{{ui:comic.bubble.edit}}**) öffnet **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}: eine Ellipse, an die ein Schwanz gesetzt werden kann.
- {{ui:comic.bubble.kind.thought}}: eine Ellipse, auf die statt eines Schwanzes kleine Kreise folgen.
- {{ui:comic.bubble.kind.shout}}: eine Sprechblase mit gezacktem Rand.
- {{ui:comic.bubble.kind.caption}}: ein eckiger Rahmen ohne Schwanz.

![Eine Sprechblase mit vertikalem Text und dem runden Griff an der Spitze des Schwanzes](shot:comic-tail)

Sprechblasen setzen Sie, indem Sie sie auf der Seite ziehen. Wenn Sie eine Sprechblase auswählen, erscheint an der Spitze ihres Schwanzes ein runder Griff. Wenn Sie den Griff ziehen, ändern sich Richtung und Länge des Schwanzes. Um einen Schwanz anzusetzen oder zu entfernen, klicken Sie in **{{ui:comic.bubble.editor}}** auf **{{ui:comic.bubble.tail}}**.

Auch ein Doppelklick auf eine Sprechblase auf der Seite öffnet **{{ui:comic.bubble.editor}}**. Die Bearbeitung öffnet sich rechts im Fenster über dem Board und verdeckt die Seite daher nicht (ist die rechte Leiste geschlossen oder schmal, öffnet sie sich stattdessen am rechten Rand der Seite). Hier lassen sich **{{ui:comic.bubble.kindLabel}}**, der Text, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** und **{{ui:comic.bubble.tail}}** ändern. Zum Schließen klicken Sie oben rechts auf das × oder drücken die Esc-Taste. Nach dem Schließen bleibt die Sprechblase gewählt.

Die Textgröße wählen Sie mit **{{ui:comic.bubble.size}}** von 60 % bis 220 %. Wenn Sie auf **{{ui:comic.bubble.vertical}}** klicken, wird der Text vertikal gesetzt: Er läuft von oben nach unten, und die Zeilen folgen von rechts nach links.

Nicht mehr benötigte Sprechblasen löschen Sie mit dem Papierkorb in ihrer Zeile im Bereich oder mit **{{ui:comic.bubble.remove}}** in **{{ui:comic.bubble.editor}}**. Sie können auch eine Sprechblase auf der Seite auswählen und die Entf-Taste drücken.

## Generierungseinstellungen

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} und {{ui:params.hires.title}} sind dieselben wie im Tab {{ui:app.tabs.generate}}. Wenn Sie die Einstellungen links ändern, gelten sie ebenso im Tab {{ui:app.tabs.generate}}. Nur die Prompts sind für jedes Bildfeld eigene (siehe „Die Prompts eines Bildfelds“).

Pro Bildfeld entsteht genau ein Bild. Deshalb richtet sich seine Größe nach dem Bildfeld und nicht nach den Einstellungen des Tabs {{ui:app.tabs.generate}}. Das Feld „Durchläufe“ erscheint im Comic nicht.

## Referenzbild je Bildfeld

Ein Bildfeld kann ein eigenes Referenzbild erhalten, zusätzlich zu den Referenzbildern des Tabs {{ui:app.tabs.generate}}. Damit richtet sich das Bild des Bildfelds nach dem Gesicht oder der Kleidung einer Figur. Ziehen Sie ein Bild aus der Galerie auf das Feld **{{ui:params.refImage.sectionLabel}}** des gewählten Bildfelds, oder wählen Sie mit **{{ui:comic.panel.imageUpload}}** eine Bilddatei aus.

Das Referenzbild wird nur beim Zeichnen des Bildes dieses Bildfelds verwendet. Die Referenzbilder des Tabs {{ui:app.tabs.generate}}, falls vorhanden, werden zusammen mit ihm verwendet. Das IP-Adapter-Modell wählen Sie bei **{{ui:params.refImage.model}}**, die Stärke bei **{{ui:params.refImage.weight}}** (von 0 bis 1; der Standard ist 0,5). Bei anderen Modellen als FLUX können Sie außerdem **{{ui:params.refImage.clipVision}}** und **{{ui:params.refImage.methodLabel}}** wählen. Die Modellliste zeigt nur die IP-Adapter-Modelle, die zum Hauptmodell passen.

Um das Referenzbild zu entfernen, klicken Sie auf **{{ui:comic.reference.remove}}**. Das Bild bleibt in der Galerie. Eine Änderung am Referenzbild können Sie mit Strg+Z rückgängig machen.

Ist für das Referenzbild kein IP-Adapter-Modell gewählt oder installiert oder liegt sein Bild nicht in der Galerie, wird das Referenzbild nicht verwendet. Das Referenzbild nutzt dieselben IP-Adapter-Modelle und dieselbe Erweiterung wie die Referenzbilder des Tabs {{ui:app.tabs.generate}}.

## Seite in ein Bild umwandeln

Klicken Sie oben in der Mitte auf **{{ui:comic.page.export}}**, dann wird die Seite als ein Bild (PNG) in der Galerie gespeichert. Die Bilder der Bildfelder sowie der Text der Sprechblasen und Erzähltexte werden in dieses Bild eingezeichnet. Die Bilder erscheinen dabei mit der Position, der Größe, der Drehung und der Spiegelung, die Sie auf der Seite eingestellt haben. Der Text wird mit den Schriften gesetzt, die unter Windows installiert sind, zum Beispiel mit japanischen Schriften. Die Größe des Bildes richtet sich nach dem Papierformat der Seite und wird mit 200 dpi gezeichnet.

## Rückgängig und Wiederholen

Mit **{{ui:comic.history.undo}}** unten links unter der Seite machen Sie die letzte Änderung rückgängig, mit **{{ui:comic.history.redo}}** stellen Sie eine rückgängig gemachte Änderung wieder her. Mit der Tastatur macht Strg+Z eine Änderung rückgängig, Strg+Umschalt+Z (oder Strg+Y) stellt sie wieder her (am Mac mit Command statt Strg). Rückgängig gemacht werden die Anordnung der Seiten und Bildfelder (einschließlich ihrer Form), die Prompts und Posen der Bildfelder, die Sprechblasen sowie die Referenzbilder der Bildfelder. Die Bilder der Bildfelder (Einfügen, Entfernen, Verschieben), die Vorlagen und der Name des Comics bleiben erhalten. Text, der ohne Pause in dasselbe Feld geschrieben wurde, wird als eine Änderung rückgängig gemacht. Steht der Cursor in einem Textfeld, ändert Strg+Z nur den Text in diesem Feld.

## Speichern und Löschen

Ein Comic wird etwa 1 Sekunde nach einer Änderung automatisch gespeichert. Auch wenn Sie die App schließen und wieder öffnen, bleiben die gespeicherten Projekte in der Liste, und Seiten, Bildfelder, Sprechblasen und Vorlagen bleiben erhalten. Sie sind auch in einer Sicherung enthalten.

Um ein Projekt zu löschen, öffnen Sie in der Liste der Comics das Menü seiner Zeile, klicken Sie auf **{{ui:comic.project.delete}}** und bestätigen Sie mit einem zweiten Klick. Wenn Sie ein Projekt löschen, werden seine Seiten, Bildfelder und Vorlagen gelöscht. Die gezeichneten Bilder bleiben in der Galerie erhalten.

Um eine Seite zu löschen, klicken Sie unter der Seite auf die Papierkorb-Schaltfläche (**{{ui:comic.page.delete}}**) und bestätigen Sie mit einem zweiten Klick. Die Bildfelder und Sprechblasen dieser Seite werden gelöscht, die gezeichneten Bilder bleiben jedoch in der Galerie erhalten.

## Gezeichnete Bilder verwenden

Die gezeichneten Bilder sind ganz normale Bilder, die in die Galerie kommen. Die Vorgänge in anderen Bildschirmen, die Galeriebilder verwenden, etwa das Ziehen eines Galeriebilds auf die {{ui:app.tabs.canvas}}, funktionieren wie gewohnt.
