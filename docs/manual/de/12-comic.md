# Comic

![Der gesamte Tab Comic. Links dieselben Einstellungen wie im Tab Generieren, in der Mitte eine leere Comic-Seite](shot:comic)

**{{ui:app.tabs.comic}}** ist eine Werkbank zum Erstellen von Comicseiten. Sie öffnen sie in der Symbolreihe ganz oben im linken Bedienfeld des Tabs **{{ui:app.tabs.generate}}** mit dem Symbol ganz rechts (dem Buchsymbol; die Taste `1` öffnet das zuletzt verwendete). Comics werden in „Projekten“ zusammengefasst. In einem Projekt liegen „Seiten“, jede Seite wird in „Bildfelder“ aufgeteilt, und für jedes Bildfeld wird ein Bild gezeichnet. In ein Bildfeld lassen sich neben gezeichneten Bildern auch Bilder aus der Galerie und Posen einsetzen. Setzen Sie Sprechblasen und Erzähltext, lässt sich die Seite als ein einziges Bild speichern.

Der Bildschirm ist in drei Bereiche geteilt.

- Links: Ganz oben steht die Symbolreihe mit Bild, Video und mehr (ganz rechts {{ui:app.tabs.comic}}). Darunter stehen von oben nach unten dieselbe {{ui:presets.label}} und derselbe {{ui:params.seed.label}} wie im Tab {{ui:app.tabs.generate}}, die Zeichnen-Schaltfläche, die Liste der Comics und {{ui:params.model.label}}. Die Zeichnen-Schaltfläche liegt an derselben Stelle wie die Generieren-Schaltfläche in den anderen Bildschirmen, und über das Pfeilmenü daneben wählen Sie, ob nur das gewählte Bildfeld oder alle Bildfelder der Seite gezeichnet werden. Darunter folgt der Bereich **{{ui:params.prompt.title}}** mit dem Prompt des gewählten Bildfelds. Weiter unten stehen der Bereich für Referenzbilder (derselbe wie im Tab {{ui:app.tabs.generate}}; er gilt für alle Bildfelder des Comics) und die detaillierten Generierungseinstellungen. Ein Klick auf die Überschrift eines Bereichs klappt ihn auf und zu.
- Mitte: die {{ui:app.views.comic}}. In der Werkzeugleiste darüber stehen die Seiteneinstellungen, die Vorlagen, das Werkzeug zum Teilen von Bildfeldern, die Bildfeldwerkzeuge (Sprechblasen und Erzähltext, Pose, Bildfeldvorlagen), die Bildwerkzeuge, die Papierkorb-Schaltfläche für das Gewählte und die Schaltfläche, die die Seite in ein Bild umwandelt. Unter der Seite befinden sich Rückgängig und Wiederherstellen, kleine Bilder jeder Seite und der Zoomfaktor.
- Rechts: die zwei Tabs **{{ui:comic.side.assistant}}** und **{{ui:comic.side.gallery}}**. Die in Bildfeldern gezeichneten Bilder kommen ebenfalls in die Galerie.

## Einen Comic erstellen

![Die Liste der Comics oben links. Eine Miniatur der ersten Seite, der Name des Comics und die Anzahl der Seiten](shot:comic-project)

1. Öffnen Sie oben links die Liste der Comics, klicken Sie ganz unten auf **{{ui:comic.project.new}}** und geben Sie einen Namen ein. Gibt es noch keinen Comic, können Sie auch mit **{{ui:comic.project.new}}** in der Mitte einen erstellen.
2. Eine Seite beginnt mit 3 Bildfeldern. Um eine Seite hinzuzufügen, klicken Sie unter der Seite auf **{{ui:comic.page.add}}**.
3. Klicken Sie auf der Seite auf das Bildfeld, das Sie zeichnen möchten. Schreiben Sie links in den Bereich **{{ui:params.prompt.title}}** die Beschreibung des Bildes und klicken Sie auf **{{ui:comic.panel.draw}}**.
4. Um alle Bildfelder der Seite nacheinander zu zeichnen, klicken Sie auf den Pfeil neben der Zeichnen-Schaltfläche, wählen **{{ui:comic.page.drawAll}}** und klicken dann auf die Zeichnen-Schaltfläche. Die Bildfelder mit Prompt werden nacheinander gezeichnet.
5. Um alle Seiten des Comics zu zeichnen, wählen Sie im selben Menü **{{ui:comic.comic.drawAll}}** und klicken auf die Zeichnen-Schaltfläche. Die Bildfelder mit Prompt aller Seiten kommen in der Lesereihenfolge in die Warteschlange.

Die Liste der Comics zeigt für jeden Comic eine Miniatur der ersten Seite und die Anzahl der Seiten. Wählen Sie einen Comic in der Liste, um ihn zu öffnen. Umbenennen und Löschen erfolgen über das Menü rechts in jeder Zeile.

Zum Zeichnen eines Bildes muss ein Modell ausgewählt sein. Ein Bildfeld mit leerem Prompt lässt sich nicht zeichnen. Prompts wirken am besten, wenn Sie sie als englische Schlagwörter schreiben. Das gezeichnete Bild kommt in dieses Bildfeld und zusätzlich in die Galerie. Ein Bildfeld, das nicht gezeichnet werden konnte, zeigt auf der Seite **{{ui:comic.draw.failed}}**.

## Die Prompts eines Bildfelds

Im Tab Comic enthält der Bereich **{{ui:params.prompt.title}}** links die Prompts des gewählten Bildfelds. Wenn Sie ein anderes Bildfeld wählen, wechselt der Text im Bereich zu dem dieses Bildfelds. Jedes Bildfeld hat genau ein Paar aus **{{ui:params.prompt.positive}}** und **{{ui:params.prompt.negative}}**. Heben Sie die Auswahl eines Bildfelds auf, bleibt der Bereich beim Prompt des zuletzt gewählten Bildfelds (wurde noch keines gewählt, beim ersten Bildfeld der Seite), und die Zeichnen-Schaltfläche zeichnet ebenfalls dieses Bildfeld.

Der Bereich funktioniert wie im Tab {{ui:app.tabs.generate}}. Wenn Sie eine {{ui:presets.label}} laden, kommen ihre Prompts in das gewählte Bildfeld. Auch die Wörter der **{{ui:params.promptBook.title}}** kommen in das gewählte Bildfeld. Wenn Sie zum Tab {{ui:app.tabs.generate}} zurückkehren, sind dort wieder die Prompts zu sehen, die Sie im Tab {{ui:app.tabs.generate}} geschrieben hatten.

Das Bild eines Bildfelds wird nur mit den Prompts dieses Bildfelds gezeichnet. Die Prompts anderer Bildfelder und die des Tabs {{ui:app.tabs.generate}} werden nicht hinzugefügt.

Die Schreibweise dynamischer Prompts (die Klammern für Kombinationen und die Wildcards) funktioniert auch im Comic. Bei **{{ui:params.prompt.modeRandom}}** zeichnet das Bild genau eine Kombination, die der Seed dieses Bildes auswählt. Bei **{{ui:params.prompt.modeCombinatorial}}** wird jede Kombination einzeln gezeichnet. Die erste Kombination kommt in das Bildfeld; die Bilder der übrigen Kombinationen kommen in die Galerie (nicht in das Bildfeld). Gibt es mehrere Kombinationen, wird darauf hingewiesen.

## Seiteneinstellungen

Klicken Sie oben in der Mitte auf **{{ui:comic.page.settings}}**, um die Einstellungen der Seite zu öffnen.

Die Anzahl der Bildfelder einer Seite ändern Sie im Feld **{{ui:comic.page.panelCount}}** von 1 bis 24. Wenn Sie die Anzahl ändern, wird die Aufteilung der Seite automatisch neu berechnet. Eine Seite, deren Bildfeld-Formen von Hand geändert wurden, kehrt beim Ändern der Anzahl ebenfalls zur automatischen Aufteilung zurück.

Die Anzahl der Spalten einer Seite wählen Sie mit **{{ui:comic.page.columns}}** von 1 bis 3 Spalten. Mit **{{ui:comic.page.direction}}** legen Sie fest, in welcher Richtung die Bildfelder gelesen werden. Manga werden normalerweise „Von rechts nach links (Manga)“ gelesen, deshalb beginnt eine neue Seite in dieser Richtung. Wenn Sie die Richtung ändern, werden die Bildfelder links und rechts vertauscht.

Wenn Sie die Anzahl der Bildfelder verringern, werden die hinteren Bildfelder entfernt. Die Bilder der entfernten Bildfelder bleiben in der Galerie erhalten.

Mit **{{ui:comic.effect.comic}}** und **{{ui:comic.effect.page}}** können Sie auf die ganze Seite einen Abschlusseffekt anwenden. Zur Auswahl stehen **{{ui:comic.effect.mono}}**, **{{ui:comic.effect.ebook}}** (ein ins Graue gehender, papierartiger Farbton) und **{{ui:comic.effect.sepia}}**. Auch wenn Sie beim Zeichnen der Bilder nicht „monochrome“ geschrieben haben, lässt sich später derselbe Effekt auf alle Seiten anwenden. Für jede Seite kann auch ein anderer Effekt gewählt werden. Die Bilder selbst ändern sich nicht; der Effekt gilt nur für die Anzeige der Seite und für das Speichern als Bild, PDF, CBZ und PSD.

Das Papierformat stellen Sie mit **{{ui:comic.page.size}}** ein: A4, A5, B4 oder B5. Das Verhältnis von Breite zu Höhe der Seite entspricht diesem Papier. Das gespeicherte Bild der Seite hat die Größe des Papiers bei 200 dpi (A4 etwa 1654 × 2339 px).

Mit **{{ui:comic.page.frameWidth}}** stellen Sie die Stärke der Rahmenlinien der Bildfelder ein, von 0 mm bis 3 mm (anfangs 0,6 mm). Mit **{{ui:comic.page.inset}}** legen Sie den Abstand zwischen Rahmenlinie und Bild fest, von 0 mm bis 10 mm (anfangs 0 mm, das Bild schließt also direkt an die Linie an). Mit **{{ui:comic.page.margin}}** können Sie außerhalb der Rahmenlinien einen weißen Rand von 0 mm bis 10 mm hinzufügen (anfangs 0 mm, es erscheint also kein weißer Rand). Mit **{{ui:comic.page.frameColor}}** wählen Sie die Farbe der Rahmenlinien (anfangs Schwarz). Alle diese Werte gelten für alle Bildfelder der Seite, und wenn Sie die Seite in ein Bild umwandeln, wird mit derselben Stärke, demselben Rand und derselben Farbe gezeichnet.

## Seiten wechseln und zoomen

Unten in der Mitte unter der Seite stehen kleine Bilder der einzelnen Seiten. Auf dem Bild sind die Bildfelder und Bilder der Seite zu sehen, und unten rechts steht die Seitennummer. Ein Klick auf ein Bild wechselt zu dieser Seite. Das Bild der gerade geöffneten Seite ist umrandet. Bei einem Comic, der von rechts gelesen wird (Leserichtung der ersten Seite von rechts), steht die erste Seite wie in einem gedruckten Manga ganz rechts, und spätere Seiten reihen sich weiter links an (mit dem linken Pfeil gehen Sie zu späteren Seiten). Es werden so viele nebeneinander gezeigt, wie Platz haben (höchstens 10 Seiten). Seiten, die nicht mehr passen, zeigen Sie mit den Pfeilen links und rechts (**{{ui:comic.page.prevGroup}}**, **{{ui:comic.page.nextGroup}}**) an, indem Sie zu den Bildern früherer oder späterer Seiten umschalten. Das geöffnete Blatt ändert sich dadurch nicht. Mit **{{ui:comic.page.add}}** fügen Sie eine Seite hinzu, mit der Papierkorb-Schaltfläche löschen Sie die gerade geöffnete Seite (bestätigen Sie mit einem zweiten Klick).

Die Anzeigegröße der Seite ändern Sie mit den Schaltflächen **{{ui:common.zoomIn}}** und **{{ui:common.zoomOut}}** unten rechts unter der Seite. Auch mit gedrückter Strg-Taste und dem Mausrad können Sie um die Position des Mauszeigers herum vergrößern und verkleinern. Ein Klick auf die Zahl des Zoomfaktors setzt ihn auf 100 % zurück.

## Vorlagen

![Die Liste der Seitenvorlagen. Die Aufteilungen werden als kleine Bilder angezeigt](shot:comic-templates)

Klicken Sie oben in der Mitte auf **{{ui:comic.template.pageTitle}}**, um die Liste der Seitenvorlagen zu öffnen. Jede Vorlage wird als kleines Bild ihrer Aufteilung angezeigt. Ein Klick auf ein Bild wendet diese Vorlage auf die gerade geöffnete Seite an.

In der Liste stehen die Standardaufteilungen (5 Arten: {{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}}, {{ui:comic.template.builtin.nine}}), Vorlagen mit besonderen Bildfeldformen, etwa schräg geteilte oder mit großen und kleinen Bildfeldern kombinierte (10 Arten), und die gespeicherten Vorlagen. Die Standardaufteilungen werden mit der Leserichtung und dem Papierformat dieser Seite angewendet. Bei den Vorlagen mit besonderen Formen werden links und rechts passend zur Leserichtung dieser Seite vertauscht. Gespeicherte Vorlagen übernehmen Leserichtung und Papierformat, die beim Speichern galten. Würden dabei Bildfelder wegfallen, ändert sich der Text unter dem Bild zu **{{ui:comic.template.applyAgain}}**. Klicken Sie noch einmal, wird die Vorlage angewendet, und Bilder und Sprechblasen der hinteren Bildfelder verschwinden.

Um die Aufteilung dieser Seite zu speichern, geben Sie unter der Liste einen Namen ein und klicken auf **{{ui:comic.template.savePage}}**. Bleibt der Name leer, heißt die Vorlage „Vorlage“ mit einer Nummer. Vorlagen werden in diesem Projekt gespeichert.

Eine Bildfeldvorlage speichert Prompt, Negativ-Prompt, Pose und Sprechblasen des gewählten Bildfelds. Das Bild wird nicht gespeichert. Klicken Sie oben in der Mitte auf **{{ui:comic.template.panelTitle}}**, geben Sie im geöffneten Bereich einen Namen ein und klicken Sie auf **{{ui:comic.template.save}}**. Klicken Sie in einem anderen Bildfeld in der Zeile der gespeicherten Vorlage auf **{{ui:comic.template.apply}}**, werden die Inhalte in dieses Bildfeld übernommen. Übernommen werden Prompt, Negativ-Prompt, Pose und Sprechblasen. Das Bild dieses Bildfelds bleibt erhalten.

## Die Form der Bildfelder ändern

![Eine Seite mit geänderten Bildfeldformen. Das obere Bildfeld ist schräg geteilt, an den Ecken des gewählten Bildfelds erscheinen Eckpunkte](shot:comic-shapes)

Die Form der Bildfelder lässt sich auch bei einer Standardaufteilung ändern. Klicken Sie oben in der Mitte auf **{{ui:comic.shape.cut}}** und ziehen Sie dann auf dem Bildfeld, das Sie teilen möchten, eine Linie von Rand zu Rand, dann teilt sich das Bildfeld in zwei. Bei einer Linie, die sich nicht in zwei Teile teilen lässt (eine Linie außerhalb des Bildfelds oder eine, die nur eine Ecke berührt), wird nicht geteilt.

Um Bildfelder hinzuzufügen, klicken Sie neben **{{ui:comic.shape.cut}}** auf **{{ui:comic.shape.addPanel}}**. Die vorhandenen Bildfelder bleiben unverändert, und ein neues Bildfeld wird etwa in der Mitte der Seite überlappend platziert und gewählt. Dabei wird die Seite zu einer Seite, auf der Bildfelder frei platziert werden (siehe unten „Bildfelder frei platzieren“). Hat die Seite bereits 24 Bildfelder, lässt sich keines hinzufügen.

Um Bildfelder zu entfernen, wählen Sie ein Bildfeld und klicken oben in der Mitte auf die Papierkorb-Schaltfläche (**{{ui:comic.shape.removePanel}}**) oder drücken die Entf-Taste. Das Bildfeld verschwindet samt Bild, Prompt und Sprechblasen. Bei einer Seite mit automatischer Aufteilung werden die übrigen Bildfelder neu angeordnet. Bei einer Seite, deren Bildfeldformen von Hand geändert wurden, dehnt sich das nächste Nachbarbildfeld in die frei gewordene Stelle aus, und sein Inhalt bleibt unverändert. Lässt sich die Form nicht mit dem Nachbarn vereinen, kehrt die Seite zur automatischen Aufteilung zurück. Das letzte Bildfeld einer Seite lässt sich nicht entfernen. Ein entferntes Bildfeld holen Sie mit Strg+Z zurück (das erneute Einsetzen eines Bildes in ein Bildfeld wird nicht rückgängig gemacht).

Um die Auswahl eines Bildfelds aufzuheben, klicken Sie auf den Rand der Seite, auf eine leere Stelle um die Seite oder auf eine freie Stelle der Werkzeugleiste. Auch die Esc-Taste hebt sie auf. Bei einer Seite mit einem Bild über der ganzen Seite wählt ein Klick auf die Seite außerhalb der Bildfelder dieses Bild (siehe „Ein Bild über die ganze Seite legen“).

An den Ecken des gewählten Bildfelds erscheinen runde Punkte (Eckpunkte). Ziehen Sie einen Eckpunkt, ändert sich die Form des Bildfelds. Eckpunkte, die an ein Nachbarbildfeld grenzen, bewegen sich mit. Ein Doppelklick auf eine Kante fügt einen Eckpunkt hinzu, und ein Eckpunkt auf einer geraden Strecke lässt sich mit einem Doppelklick entfernen. An Stellen, an denen sich Bildfelder überlappen oder Kanten kreuzen würden, lässt sich ein Punkt nicht hinbewegen.

In der Mitte jeder Kante des gewählten Bildfelds erscheint ein kleiner Balken (der Kantengriff). Ziehen Sie ihn, bewegt sich die ganze Kante, und die Nachbarbildfelder ändern ihre Form passend dazu. Über den Rand der Seite hinaus lässt er sich nicht bewegen.

Eine Seite, deren Bildfeldformen von Hand geändert wurden, kehrt mit **{{ui:comic.shape.reset}}** unter **{{ui:comic.page.settings}}** zur automatischen Aufteilung zurück. Auch wenn Sie die Zahl der Bildfelder oder Spalten ändern, kehrt sie zur automatischen Aufteilung zurück. Änderungen der Form machen Sie mit Strg+Z rückgängig.

## Bildfelder frei platzieren

Ein Bildfeld lässt sich auf jeder Seite verschieben, indem Sie es an einer beliebigen Stelle ziehen (unabhängig von der Form von der Stelle aus, auf die Sie geklickt haben). Klicken Sie nur, ohne zu ziehen, wird das Bildfeld lediglich gewählt. Sobald Sie ein Bildfeld einmal verschoben haben, wird die Seite zu einer Seite mit frei platzierten Bildfeldern. Jedes Bildfeld hat dann eine eigene Form und teilt keine Kanten mit Nachbarn. Bildfelder lassen sich überlappen oder mit Lücken anordnen. Das Aussehen vor dem Verschieben (die Lage der Bildfelder und die weißen Zwischenräume) bleibt erhalten.

Ein Bildfeld darf auch teilweise über die Seite hinausragen. Der überstehende Teil wird außerhalb der Seite abgeschnitten. Die Mitte des Bildfelds bleibt jedoch auf der Seite. Über einem Bildfeld wird der Mauszeiger zum Verschiebe-Cursor, an einer Ecke zum Kreuz und an einer Kante zu einem Pfeil in Richtung der Kante. Ziehen Sie in das Innere eines Bildfelds, bewegt sich immer das ganze Bildfeld. Wenn Sie nur das Bild bewegen möchten, ziehen Sie bei gedrückter Alt-Taste, oder doppelklicken Sie auf das Bild, um es zu wählen, und ziehen Sie den Teil, der über das Bildfeld hinausragt. Ziehen Sie den runden Griff über dem gewählten Bildfeld (**{{ui:comic.free.rotate}}**), dreht sich das Bildfeld in einen beliebigen Winkel. Bei gedrückter Umschalttaste dreht es sich in Schritten von 15 Grad. Auf einer Seite mit frei platzierten Bildfeldern bewegen Ecken und Kanten eines Bildfelds nur dieses Bildfeld und beeinflussen andere nicht. Fügen Sie ein Bildfeld hinzu, kommt ein rechteckiges Bildfeld in die Mitte der Seite. Entfernen Sie ein Bildfeld, dehnen sich die Nachbarn nicht aus. Auch **{{ui:comic.shape.cut}}** lässt sich verwenden, und die Bildfelder um das geteilte Bildfeld herum bleiben unverändert.

Gedreht wird der Rahmen des Bildfelds, das Bild bleibt gerade und wird vom Rahmen beschnitten. Den Winkel des Bildes ändern Sie getrennt mit den Bildwerkzeugen. Um die Seite zur automatischen Anordnung zurückzubringen, klicken Sie unter **{{ui:comic.page.settings}}** auf **{{ui:comic.shape.reset}}** (mit Rückgängig lässt sich das zurücknehmen).

Überlappen sich Bildfelder, liegt das spätere vorn. Wählen Sie ein Bildfeld und klicken Sie auf **{{ui:comic.order.front}}**, **{{ui:comic.order.forward}}**, **{{ui:comic.order.backward}}** oder **{{ui:comic.order.back}}**, dann ändert sich die Stapelreihenfolge. Diese Reihenfolge ist zugleich die Nummer des Bildfelds (die Lesereihenfolge), daher ändern sich beim Umordnen auch die Nummern.

Nachdem Sie Bildfelder oder Bilder gedreht, in der Größe geändert oder verschoben haben, können Sie sie oben in der Mitte mit **{{ui:comic.reset.title}}** zurücksetzen. Sie können die Drehung des Bildfelds, Form und Größe des Bildfelds sowie Drehung, Größe, Position und Spiegelung des Bildes einzeln wählen und zurücksetzen oder mit **{{ui:comic.reset.all}}** alles auf einmal. Setzen Sie Form und Größe des Bildfelds zurück, erhält es die Form wie bei der automatischen Anordnung. Das Zurücksetzen des Bildes lässt sich nicht mit Rückgängig zurücknehmen.

## Das Bild eines Bildfelds

![Ein in ein Bildfeld eingesetztes Bild. Um das verkleinerte und gedrehte Bild erscheinen die vier Eckgriffe und der Griff oben](shot:comic-image)

Das Bild eines Bildfelds muss nicht gezeichnet sein. Ziehen Sie ein Bild aus der Galerie auf ein Bildfeld, wird dieses Bild zum Bild des Bildfelds. Wählen Sie ein Bildfeld und klicken Sie oben in der Mitte auf **{{ui:comic.panel.imageUpload}}**, können Sie eine Bilddatei vom Computer wählen. Die Datei kommt zuerst in die Galerie und wird dann zum Bild des Bildfelds.

Das Bild eines Bildfelds bewegen Sie wie im Tab {{ui:app.tabs.canvas}} direkt auf der Seite.

- Ziehen Sie auf dem Bild, bewegt sich das ganze Bildfeld. Um nur das Bild zu bewegen, ziehen Sie bei gedrückter Alt-Taste. Ein Teil des Bildes darf auch aus dem Bildfeld herausragen.
- Doppelklicken Sie auf das Bild oder klicken Sie bei gedrückter Alt-Taste darauf, wird das Bild gewählt, und um es erscheinen ein gestrichelter Rahmen und Griffe. Auch der aus dem Bildfeld herausragende Teil ist blass zu sehen.
- Drehen Sie bei gedrückter Alt-Taste das Mausrad, wird das Bild des Bildfelds darunter um die Position des Mauszeigers herum vergrößert oder verkleinert.
- Ziehen Sie die Griffe an den vier Ecken, wird das Bild um seine Mitte vergrößert oder verkleinert.
- Ziehen Sie den runden Griff oben, dreht sich das Bild. Bei gedrückter Umschalttaste dreht es sich in Schritten von 15°.
- Das gewählte Bild bewegen Sie mit den Pfeiltasten in kleinen Schritten (mit gedrückter Umschalttaste in großen).
- Auch wenn das Bild ganz aus dem Bildfeld herausgerutscht ist, lässt es sich bewegen, indem Sie den gestrichelten Rahmen des gewählten Bildes ziehen.

Auch mit den Werkzeugen oben in der Mitte lässt sich das Bild ändern. **{{ui:comic.image.fitCover}}** setzt das Bild auf den Zustand ohne Drehung zurück und dehnt es über das ganze Bildfeld. **{{ui:comic.image.fitContain}}** macht das Bild so groß, dass es ganz ins Bildfeld passt. Mit **{{ui:comic.image.rotateLeft}}** und **{{ui:comic.image.rotateRight}}** drehen Sie in 90°-Schritten, mit **{{ui:comic.image.flipX}}** und **{{ui:comic.image.flipY}}** spiegeln Sie. Mit **{{ui:comic.image.scaleDown}}** und **{{ui:comic.image.scaleUp}}** verkleinern und vergrößern Sie in kleinen Schritten, und **{{ui:comic.image.center}}** rückt die Mitte des Bildes in die Mitte des Bildfelds.

Um das Bild eines Bildfelds zu entfernen, wählen Sie das Bild und drücken die Entf-Taste oder klicken oben in der Mitte auf die Papierkorb-Schaltfläche (bei gewähltem Bild **{{ui:comic.panel.imageClear}}**). Es gibt nur eine Papierkorb-Schaltfläche, und sie löscht das Gewählte (eine Sprechblase, ein Bild, ein Bild über die ganze Seite oder ein Bildfeld). Halten Sie den Zeiger über die Schaltfläche, steht dort, was gelöscht wird. Auch nach dem Entfernen bleibt das Bild in der Galerie. Klicken Sie in der Meldung, die gleich nach dem Entfernen erscheint, auf **{{ui:comic.history.undo}}**, kommt das Bild an seiner früheren Position und in der früheren Größe zurück. Setzen Sie ein anderes Bild ein, gelten wieder Position und Größe wie am Anfang.

Ein Bildfeld erinnert sich an frühere Bilder. Zeichnen Sie ein Bildfeld neu, setzen ein anderes Bild ein oder entfernen das Bild, bleibt das bisherige Bild im **{{ui:comic.takes.title}}** dieses Bildfelds erhalten (die neuesten, bis zu 12 Bilder). Wählen Sie ein Bildfeld und klicken Sie oben in der Mitte auf **{{ui:comic.takes.title}}**, stehen das aktuelle und die früheren Bilder nebeneinander. Ein Klick auf ein früheres Bild bringt es mit der Position und Größe, die es hatte, zurück in das Bildfeld (das aktuelle Bild kommt in den Verlauf). Entfernen Sie ein Bild mit **{{ui:comic.takes.remove}}** aus der Liste, bleibt es in der Galerie. Bilder, die Sie aus der Galerie gelöscht haben, erscheinen nicht. Rückgängig ändert den Verlauf wie bei den Bildern nicht.

Auch nur ein Teil eines Bildes lässt sich neu zeichnen (etwa wenn Hände oder Gesichter misslungen sind). Wählen Sie ein Bildfeld mit Bild und klicken Sie oben in der Mitte auf **{{ui:comic.fix.start}}** (die Pinsel-Schaltfläche), erscheint über der Seite eine schmale Leiste. Übermalen Sie auf dem Bildfeld die Stelle, die neu gezeichnet werden soll. In der Leiste ändern Sie **{{ui:comic.fix.brush}}**, und wenn Sie zu viel gemalt haben, gehen Sie mit **{{ui:comic.fix.undoStroke}}** oder **{{ui:comic.fix.clear}}** zurück. Schreiben Sie in das Feld **{{ui:comic.fix.words}}** auf Englisch, was dort gezeichnet werden soll (bleibt es leer, wird mit dem Prompt des Bildfelds gezeichnet). Je niedriger Sie **{{ui:comic.fix.strength}}** stellen, desto näher bleibt die Korrektur am ursprünglichen Bild. Klicken Sie auf **{{ui:comic.fix.go}}**, wird nur die übermalte Stelle neu gezeichnet, und der Rest bleibt wie im ursprünglichen Bild. Das entstandene Bild kommt in das Bildfeld, und das bisherige Bild bleibt im **{{ui:comic.takes.title}}**. Die Wörter der Figuren und die Referenzbilder werden wie beim Zeichnen des Bildfelds verwendet. Wählen Sie ein anderes Bildfeld, verschwindet die Übermalung.

## Ein Bild über die ganze Seite legen

Mit **{{ui:comic.backdrop.title}}** oben in der Mitte legen Sie ein Bild über die ganze Seite. Das eignet sich für Seiten mit einem großen Bild wie einer Doppelseite oder für Seiten mit nebeneinander gesetzten Fotos und Bildern. Bilder aus der Galerie und Bilddateien vom Computer lassen sich auch außerhalb der Bildfelder auf die Seite ziehen (über einem Bildfeld ziehen Sie bei gedrückter Alt-Taste). Sie lassen sich auch in diesen Bereich ziehen oder mit **{{ui:comic.panel.imageUpload}}** als Datei wählen. Das Bild kommt hinter die Bildfelder, ganz nach unten auf der Seite, und was über die Seite hinausragt, wird abgeschnitten. Durch Bildfelder ohne Bild scheint das Bild dahinter. Rahmen der Bildfelder und Sprechblasen werden darüber gezeichnet.

Klicken Sie auf **{{ui:comic.backdrop.edit}}**, erscheint über der Seite der Rahmen des Bildes. Ziehen Sie an einer beliebigen Stelle des Bildes, bewegt es sich, an den runden Griffen der vier Ecken ändert sich die Größe, und am runden Griff oben dreht es sich in einen beliebigen Winkel (mit gedrückter Umschalttaste in Schritten von 15 Grad). Währenddessen lassen sich die Bildfelder nicht bedienen. Mit der Esc-Taste oder durch Wählen eines anderen Bildfelds ist es beendet. Mit den Schaltflächen im selben Bereich können Sie das Bild auch auf die ganze Seite einpassen, ganz zeigen, vergrößern und verkleinern, in die Mitte zurücksetzen, um 90 Grad drehen, links-rechts und oben-unten spiegeln und entfernen. Auch die Entf-Taste entfernt es. Mit **{{ui:comic.history.undo}}** in der Meldung nach dem Entfernen holen Sie es zurück. Dieses Bild ist sowohl beim Umwandeln der Seite in ein Bild als auch bei der Datei für alle Seiten enthalten.

Auch auf der Seite selbst lässt sich dieses Bild bearbeiten. Klicken Sie auf die Seite außerhalb der Bildfelder (auf die Lücken zwischen den Bildfeldern oder den Rand der Seite), wird das Bild gewählt, und ein Rahmen erscheint. Solange es gewählt ist, entfernen Sie es mit der Entf-Taste oder mit der Papierkorb-Schaltfläche oben in der Mitte (**{{ui:comic.backdrop.clear}}**). Ziehen Sie, solange es gewählt ist, ein Bild aus der Galerie oder eine Datei auf die Seite, wird es durch dieses Bild ersetzt. Drehen Sie bei gedrückter Alt-Taste außerhalb der Bildfelder das Mausrad, wird um die Position des Mauszeigers herum vergrößert oder verkleinert.

## Die Pose festlegen

![Der Bildschirm zum Festlegen der Pose eines Bildfelds mit der Strichfigur](shot:comic-pose)

Wählen Sie ein Bildfeld, klicken Sie oben in der Mitte auf die Pose-Schaltfläche, um den Bereich zu öffnen, und klicken Sie auf **{{ui:comic.panel.pose}}**, dann öffnet sich der Bildschirm, in dem Sie die Pose mit einer Strichfigur festlegen. Die Pose wird in der Form dieses Bildfelds gezeichnet, und ein Klick auf **{{ui:comic.pose.use}}** macht sie zur Pose dieses Bildfelds. Die Pose lässt sich durch erneutes Öffnen korrigieren. Die in diesem Bildschirm festgelegte Pose gilt für eine Person. Zum Entfernen klicken Sie auf **{{ui:comic.panel.poseRemove}}**.

![Der Bereich mit den Pose-Vorgaben für ein Bildfeld. Kategorie und Pose werden gewählt](shot:comic-presets)

Im selben Bereich lassen sich auch dieselben fertigen Posen wie auf der Leinwand einsetzen. Wählen Sie mit **{{ui:comic.panel.poseCategory}}** eine Kategorie, mit **{{ui:comic.panel.posePreset}}** eine Pose und klicken Sie auf **{{ui:comic.panel.poseApply}}**. Passend zur Größe des Bildfelds wird ein Bild der Strichfigur erzeugt und zur Pose dieses Bildfelds. Je nach Komposition stehen mehrere Personen nebeneinander. In dem Fall kommen alle ins Bildfeld.

Damit die Pose im Bild wirkt, muss ein ControlNet-Modell für Posen (OpenPose oder ein Union-Modell) installiert sein. Bei einem Union-Modell wird beim Zeichnen mitgegeben, dass es sich um ein Pose-Bild handelt. Ist keines installiert, wird die Pose beim Zeichnen nicht verwendet, und ein entsprechender Hinweis erscheint.

## Mit einem 3D-Rough platzieren

Wählen Sie ein Bildfeld und klicken Sie im Pose-Bereich auf **{{ui:comic.rough.open}}**, öffnet sich ein 3D-Bildschirm in der Form des Bildfelds. Personen platzieren Sie als Puppen aus Zylindern und Quadern, Hintergründe als Quader, Platten, Zylinder und Boden in 3D. Auch Richtung, Abstand und Bildwinkel der Kamera legen Sie fest.

- Ziehen Sie auf dem Hintergrund, dreht sich die Kamera. Ziehen Sie bei gedrückter Umschalttaste (oder mit der rechten Maustaste), verschiebt sie sich, und mit dem Mausrad gehen Sie näher heran oder weiter weg.
- Mit **{{ui:comic.rough.kind.person}}**, **{{ui:comic.rough.kind.box}}**, **{{ui:comic.rough.kind.plane}}** und **{{ui:comic.rough.kind.cylinder}}** im Bereich rechts platzieren Sie Objekte. Platten kommen nach hinten, alles andere daneben. Personen und kleine Gegenstände lassen sich durch Ziehen auf dem Boden bewegen.
- Richtung, Höhe über dem Boden und Größe (Breite, Höhe, Tiefe; bei Personen die Größe mit einem Erwachsenen als 100) des gewählten Objekts ändern Sie im Bereich rechts. Mit **{{ui:comic.rough.remove}}** löschen Sie es.
- Ziehen Sie den farbigen Punkt einer gewählten Person, biegt sich die zugehörige Gliedmaße. Ziehen Sie den Punkt am Hals, bewegt sich die ganze Person.
- Die kleinen Bilder unten rechts zeigen die Pose und die Tiefe, die an ControlNet gehen.

Klicken Sie auf **{{ui:comic.rough.apply}}**, werden zwei Bilder in der Größe des Bildfelds erzeugt und in das Bildfeld gesetzt. Das eine ist das Posenbild aus Sicht der Kamera. Verdeckte Gelenke werden nicht gezeichnet, etwa das Gesicht einer Person, die den Rücken zeigt, oder Beine hinter einem Tisch. Das andere ist ein Tiefenbild, das die Entfernung der Objekte als Helligkeit zeigt. Beim Zeichnen geht zusätzlich zur Pose auch das Tiefenbild an ControlNet, damit Personen und Hintergrund der Anordnung im 3D-Rough näherkommen. Die Tiefe wirkt schwach und nur von Beginn bis zur Hälfte der Schritte, weil bei starker Wirkung die Formen der Puppen und Quader unverändert gezeichnet würden.

Für das Tiefenbild muss ein ControlNet-Modell für Tiefe (depth oder ein Union-Modell) installiert sein. Ist keines installiert, wird die Tiefe beim Zeichnen nicht verwendet, und ein entsprechender Hinweis erscheint.

Ändern Sie nach der Verwendung eines 3D-Roughs die Pose im Pose-Bildschirm, mit einer fertigen Pose oder über den Assistenten, wird das Tiefenbild entfernt (weil die Positionen der Personen veraltet wären). Das 3D-Rough selbst bleibt im Bildfeld. Öffnen Sie es erneut, beginnen Sie mit unveränderter Kamera und unveränderten Gegenständen und mit der Person in der aktuellen Pose. Mit **{{ui:comic.rough.apply}}** wird auch das Tiefenbild neu erzeugt.

Ändert sich die Form eines Bildfelds, weil Sie die Aufteilung oder die Größe der Seite ändern, wird das Tiefenbild ebenfalls nicht verwendet, und ein entsprechender Hinweis erscheint. Ein Bild, das in der alten Form erzeugt wurde, wäre gestreckt, und die Positionen von Personen und Hintergrund verschöben sich. Öffnen Sie das 3D-Rough und klicken Sie auf **{{ui:comic.rough.apply}}**, wird es in der aktuellen Form neu erzeugt.

## Figuren einheitlich halten

Zeichnen Sie die Bildfelder einzeln, verändern sich Gesichter und Kleidung allmählich. Um das zu bremsen, registrieren Sie Figuren. Wählen Sie ein Bildfeld, klicken Sie bei den Bildfeldwerkzeugen oben in der Mitte auf die Schaltfläche **{{ui:comic.cast.title}}** und dann auf **{{ui:comic.cast.add}}**. Oben steht die Liste der Figuren, und der Bereich der Figur, deren Namen Sie angeklickt haben, erscheint darunter (es wird immer eine Figur gezeigt). Geben Sie einen Namen ein und schreiben Sie das Aussehen im Feld darunter als englische Schlagwörter: Art und Anzahl, Alter, Haare, Augen, Farbe der Kleidung und Ähnliches (Beispiel: `1boy, old man, short white hair, flat cap, beige cardigan, blue shirt`). Das Feld wächst mit dem Text, sodass alles lesbar bleibt. Figuren, die im gewählten Bildfeld vorkommen, haken Sie neben dem Namen in der Liste an. Beim Zeichnen dieses Bildfelds werden die Schlagwörter der angehakten Figuren unverändert vor den Prompt gestellt. In den Prompt genügt es, nur das zu schreiben, was sich ändert (Komposition, Ort, Bewegung). Figuren ohne Haken kommen in diesem Bildfeld nicht vor. Löschen Sie eine Figur, wird sie aus allen Bildfeldern entfernt.

Allein mit Wörtern werden zwar Haare und Kleidung einheitlich, das Gesicht aber nicht. Deshalb kann eine Figur auch ein Referenzbild haben. Klicken Sie auf **{{ui:comic.cast.refUse}}**, wird das Bild des gewählten Bildfelds zum Referenzbild. Mit **{{ui:comic.cast.refClear}}** entfernen Sie es. Ob dieses Bild beim Zeichnen von Bildfeldern mit IP-Adapter verwendet wird, legen Sie unter **{{ui:comic.draw.settings}}** mit **{{ui:comic.draw.castReference.use}}** fest. Standardmäßig ist es aus, weil mit dem IP-Adapter leicht der Zeichenstil nachlässt und der weiße Hintergrund oder die stehende Haltung des Referenzbildes in das Bildfeld übergehen. Eingeschaltet wird das Referenzbild schwach und nur in der ersten Hälfte des Zeichnens verwendet, und die CFG-Skala wird nicht gesenkt (das IP-Adapter-Modell muss installiert sein). Zeichnen Sie bei eingeschaltetem Schalter die ganze Seite oder den ganzen Comic, wird eine Figur ohne Referenzbild zuerst nur mit Wörtern allein vor einem einfarbigen Hintergrund gezeichnet, und dieses Bild wird zu ihrem Referenzbild. Ist das Modell im Tab Generieren FLUX.2, wird das Referenzbild unabhängig von dieser Einstellung nicht über den IP-Adapter, sondern direkt an das Modell selbst übergeben (bis zu 4 Bilder pro Bildfeld). Dann wird kein IP-Adapter-Modell benötigt.

Sind in einem Bildfeld zwei oder mehr Figuren und hat das Bildfeld eine Pose, wählen Sie bei der Figur unter „{{ui:comic.cast.posePerson}}“, die wievielte Person der Pose sie ist. Dann wirken die Wörter für das Aussehen und das Referenzbild dieser Figur nur um diese Person der Pose herum. Gesicht und Kleidung gehen so seltener auf eine andere Figur über (bei Modellen SD 1.5 und SDXL). Stimmt die Zahl der Personen mit der Zahl der Menschen unter den Figuren überein, wird auch ohne Auswahl nach der Reihenfolge zugeordnet. Wesen ohne Pose wie Spukgestalten oder Tiere werden an den übrigen Stellen gezeichnet.

Das Aussehen können Sie neben dem Schlagwortfeld auch in getrennten Feldern für Haare, Augen, Gesichtszüge, Kleidung, Körperbau und Zubehör schreiben. Schreiben Sie es nach Körperteilen, kommen nur die Teile in den Prompt, die im Bild dieses Bildfelds zu sehen sind. Steht im Prompt des Bildfelds close-up, sind es Haare, Augen, Gesicht und Zubehör, bei upper body zusätzlich die Kleidung, bei from behind alles außer Augen und Gesicht. Ist nichts geschrieben, wird von einer Ganzkörperansicht ausgegangen, und alles wird hinzugefügt. Bei Spukgestalten und Tieren haken Sie bei der Figur „{{ui:comic.cast.nonHuman}}“ an. Die Körperteile werden dann bei jedem Bildausschnitt hinzugefügt, und das Referenzbild wird ohne Person gezeichnet.

Ist eine Figur mit einem Charakter mit LoRA verknüpft (Registrierung von Charakteren; so verknüpft in einer früheren Version), wird ein Bildfeld, in dem diese Figur allein vorkommt, mit dieser LoRA und ihrem Aufrufwort gezeichnet. In einem Bildfeld mit zwei oder mehr Figuren mit LoRA wird sie nicht verwendet, weil sich das Aussehen vermischen würde. Auch wenn die LoRA von einer anderen Art ist als das Modell im Tab Generieren (etwa SDXL und SD 1.5) oder die LoRA der Figur abgeschaltet ist, wird sie nicht verwendet.

Wenn der Assistent einen Comic erstellt, schreibt er auch die Figuren. Einheitlich werden nur die Wörter; Gesichter werden nicht völlig gleich, daher können zwischen Bildfeldern kleine Unterschiede bleiben.

## Schauplätze einheitlich halten

Zeichnen Sie die Bildfelder einzeln, ändert sich selbst bei Szenen im selben Raum der Hintergrund von Bildfeld zu Bildfeld. Um das zu bremsen, registrieren Sie Schauplätze. Wählen Sie ein Bildfeld, klicken Sie bei den Bildfeldwerkzeugen oben in der Mitte auf die Schaltfläche **{{ui:comic.place.title}}** und dann auf **{{ui:comic.place.add}}**. Der neue Schauplatz wird zum Schauplatz des gewählten Bildfelds. Geben Sie einen Namen ein und schreiben Sie bei **{{ui:comic.place.tags}}** als englische Schlagwörter, was für ein Ort es ist, was dort steht sowie Farben und Licht (Beispiel: `classroom, wooden desks, green chalkboard, large windows, afternoon sunlight`). In anderen Bildfeldern wählen Sie den Schauplatz aus der Liste **{{ui:comic.place.inPanel}}**. Beim Zeichnen dieses Bildfelds werden die Wörter des Schauplatzes unverändert hinter den Prompt gestellt. Bildfelder mit demselben Schauplatz werden dadurch leichter mit demselben Hintergrund gezeichnet. Ändern Sie die Wörter, gilt das für alle Bildfelder dieses Schauplatzes. Orte, deren Licht bei Tag und Nacht verschieden ist, registrieren Sie als getrennte Schauplätze.

Wenn der Assistent einen Comic erstellt, registriert er auch Schauplätze und wählt für jedes Bildfeld einen Schauplatz.

## Den Assistenten bitten

Im Tab **{{ui:comic.side.assistant}}** in der rechten Spalte können Sie den Assistenten zum geöffneten Comic um etwas bitten. Der Assistent liest und schreibt die Figuren und Schauplätze des Comics, die Aufteilung der Seiten, Prompt und Pose jedes Bildfelds sowie die Sprechblasen. Er tut nur, worum Sie bitten, und zeichnet Bilder nur auf Ihre Bitte.

Bitten Sie ihn, sich die Bilder fertig gezeichneter Seiten anzusehen und zu korrigieren, sieht er sich das Bild dieser Seite an. Weil das Bild der Seite an die gewählte KI gesendet wird, erscheint vorher dieselbe Nachfrage wie beim Lesen von Bildern ([KI-Assistent und Einstellungen](09-assistant-settings.md)). Erlauben Sie es nicht, sieht er diese Seite nicht an.

## Regieanweisung

Zu jedem Bildfeld können Sie die Szene als Text notieren. Schreiben Sie wie in der Regieanweisung eines Drehbuchs Ort, Zeit und wer was tut. Wählen Sie ein Bildfeld, klicken Sie oben in der Mitte auf die Notiz-Schaltfläche (**{{ui:comic.panel.note}}**), um den Bereich zu öffnen, und schreiben Sie hinein. In Bildfeldern, die noch kein Bild haben, wird die Regieanweisung in Schrägschrift angezeigt (in Bildfeldern ohne Regieanweisung erscheint der Prompt). Die Regieanweisung wird nicht zur Bilderzeugung verwendet. Sie können sie auch vom Assistenten schreiben lassen ([KI-Assistent und Einstellungen](09-assistant-settings.md)).

## Sprechblasen und Erzähltext

![Der Bereich für Sprechblasen und Erzähltext. Die Arten von Sprechblasen stehen als kleine Bilder so, wie sie aussehen](shot:comic-balloon-list)

Wählen Sie ein Bildfeld und klicken Sie oben in der Mitte auf **{{ui:comic.panel.bubbles}}**, um den Bereich zu öffnen, erscheinen die Arten von Sprechblasen als kleine Bilder so, wie sie aussehen. Ein Klick auf ein Bild fügt diesem Bildfeld eine Sprechblase dieser Art hinzu, und über dem Brett rechts öffnet sich **{{ui:comic.bubble.editor}}**. Unter dem Bereich stehen die Sprechblasen dieses Bildfelds mit Art und Text. Ein Klick auf eine Zeile wählt diese Sprechblase, und ein Klick auf die Stift-Schaltfläche (**{{ui:comic.bubble.edit}}**) öffnet **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}, {{ui:comic.bubble.kind.rounded}}, {{ui:comic.bubble.kind.box}}: Sprechblasen in Form einer Ellipse, eines Rechtecks mit runden Ecken und eines Rechtecks, an die sich ein Schwanz setzen lässt.
- {{ui:comic.bubble.kind.thought}}: Wolkenform, auf die statt eines Schwanzes kleine Kreise folgen.
- {{ui:comic.bubble.preset.whisper}}: Eine gepunktete Ellipse. Für leise Stimmen und Geflüster.
- {{ui:comic.bubble.kind.shout}}, {{ui:comic.bubble.kind.explosion}}: Sprechblasen mit zackigem Rand. Bei {{ui:comic.bubble.kind.explosion}} sind die Zacken groß und ungleichmäßig.
- {{ui:comic.bubble.kind.wavy}}, {{ui:comic.bubble.kind.fuzzy}}: Ein welliger Rand und ein Rand wie feines Fell. Für schwache Stimmen und Unsicherheit.
- {{ui:comic.bubble.kind.electric}}: Ein Rahmen mit vielen Ecken und einem Schwanz in Blitzform. Für Telefone, Lautsprecher und Maschinenstimmen.
- {{ui:comic.bubble.kind.icicle}}: Eine Sprechblase, an deren Unterseite Eiszapfen hängen. Für kalte Stimmen.
- {{ui:comic.bubble.kind.heart}}: Eine Sprechblase in Herzform.
- {{ui:comic.bubble.kind.flash}}: Um den Text sammeln sich strahlenförmige schwarze Linien. Für Überraschung und innere Schreie.
- {{ui:comic.bubble.preset.dark}}, {{ui:comic.bubble.preset.double}}: Eine schwarz gefüllte Sprechblase (mit weißem Text) und eine Sprechblase mit doppelter Linie.
- {{ui:comic.bubble.kind.caption}}: Ein Rahmen mit Ecken, ohne Schwanz.
- {{ui:comic.bubble.kind.sfx}}: Schrift für Geräuscheffekte wie „Bumm“ oder „Gemurmel“. Es gibt keinen Rahmen, die Schrift ist dick, schwarz und mit weißem Rand und beginnt in recht großer Schrift. Mit **{{ui:comic.bubble.rotation}}** in **{{ui:comic.bubble.editor}}** neigen Sie die Schrift schräg (von -90 Grad bis 90 Grad).
- {{ui:comic.bubble.kind.stamp}}: Klebt Geräuscheffekte nicht als Schrift, sondern als Bild ein. Zur Auswahl stehen insgesamt 114 Bilder: 38 Wörter wie „Don“, „Zawa“ und „Gogogogo“ in je 3 Schriftarten (kantig, scharfer Pinsel, trockener Pinsel). Die Liste in **{{ui:comic.bubble.editor}}** lässt sich nach Wort, Lesung und Verwendung durchsuchen (zum Beispiel don, zawa, Spannung) und nach Schriftart filtern. Größe, Neigung und Position ändern Sie wie bei der Geräuscheffekt-Schrift, und auch in gespeicherten Seiten und in der PSD bleibt es ein Bild. Die Bilder dürfen frei verwendet werden, auch kommerziell (CC0).
- {{ui:comic.bubble.kind.plain}}: Schrift ohne Rahmen in normaler Stärke. Damit sie auch über Bildern lesbar ist, hat sie einen schmalen weißen Rand. Auch die Neigung lässt sich ändern.

Die Linien der Sprechblasen wackeln leicht wie von Hand gezeichnet. Das Wackeln ist für jede Sprechblase festgelegt und ändert sich nicht, wenn Sie sie verschieben oder neu schreiben.

![Eine Sprechblase mit vertikaler Schrift und der runde Griff an der Spitze des Schwanzes](shot:comic-tail)

Eine hinzugefügte Sprechblase wird in die Mitte des Bildfelds gesetzt. Sprechblasen platzieren Sie durch Ziehen auf der Seite. Auch wenn das Bild eines Bildfelds gewählt ist, bewegt sich beim Ziehen auf einer Sprechblase nur die Sprechblase, nicht das Bildfeld oder das Bild. Wählen Sie eine Sprechblase, wird sie von einem blauen gestrichelten Rahmen umgeben, und die Griffe des Bildfelds werden ausgeblendet. An der Spitze des Schwanzes erscheint außerdem ein runder Griff. Ziehen Sie ihn, ändern sich Richtung und Länge des Schwanzes. Einen Schwanz fügen Sie hinzu oder entfernen ihn mit **{{ui:comic.bubble.tail}}** in **{{ui:comic.bubble.editor}}**.

![Eine hinzugefügte Sprechblase. Über dem Brett rechts öffnet sich die Bearbeitung der Sprechblase](shot:comic-balloon)

Auch ein Doppelklick auf eine Sprechblase auf der Seite öffnet **{{ui:comic.bubble.editor}}**. Die Bearbeitung öffnet sich über dem Brett am rechten Bildschirmrand und verdeckt die Seite daher nicht (ist die rechte Spalte geschlossen oder schmal, öffnet sie sich am rechten Rand der Seite). Hier ändern Sie **{{ui:comic.bubble.kindLabel}}**, Text, **{{ui:comic.bubble.font}}**, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** und **{{ui:comic.bubble.tail}}**. Auch in der Liste der Arten steht jede Form als kleines Bild. Wenn Sie die Art ändern, bleiben Text und Position erhalten. Zum Schließen klicken Sie oben rechts auf das × oder drücken die Esc-Taste. Auch nach dem Schließen bleibt die Sprechblase gewählt.

Unter **{{ui:comic.bubble.look}}** lässt sich Folgendes ändern.

- **{{ui:comic.bubble.lineLabel}}**: Wählen Sie aus {{ui:comic.bubble.line.solid}}, {{ui:comic.bubble.line.dashed}}, {{ui:comic.bubble.line.double}} und {{ui:comic.bubble.line.none}}.
- **{{ui:comic.bubble.dark}}**: Füllt die Sprechblase schwarz und macht den Text weiß.
- **{{ui:comic.bubble.lineWidth}}**: Die Stärke der Linie (vom 0,3- bis zum 4-Fachen).
- **{{ui:comic.bubble.rough}}**: Das Wackeln der Linie wie von Hand gezeichnet. Bei 0 sind die Linien wie mit dem Lineal gezogen.
- **{{ui:comic.bubble.width}}**, **{{ui:comic.bubble.height}}**: Breite und Höhe der Sprechblase im Verhältnis zum Text (vom 0,6- bis zum 3-Fachen).
- **{{ui:comic.bubble.spikes}}**, **{{ui:comic.bubble.depth}}**: Anzahl und Tiefe von Zacken, Wolkenwülsten, Wellen, Fell, Ecken, Eiszapfen und Linien. Erscheint nur bei Arten, die so etwas haben.
- **{{ui:comic.bubble.tailWidth}}**, **{{ui:comic.bubble.tailCurve}}**: Die Dicke am Ansatz des Schwanzes und seine Krümmung. Erscheint nur, wenn ein Schwanz vorhanden ist.

![Eine Sprechblase, deren Form frei geändert wird. Auf der Kontur stehen quadratische Punkte, und ein herausgezogener Punkt verändert die Form](shot:comic-balloon-shape)

Die Form einer Sprechblase lässt sich frei ändern. Klicken Sie unter **{{ui:comic.bubble.outline}}** auf **{{ui:comic.bubble.shapeFreely}}**, erscheinen quadratische Punkte auf der Kontur der Sprechblase. Ziehen Sie einen Punkt, bewegt sich die Kontur an dieser Stelle. Ein Doppelklick auf einen Punkt entfernt ihn (es bleiben mindestens 3), ein Doppelklick auf die Sprechblase fügt der Kontur in der Nähe einen Punkt hinzu. Zacken, Wolkenwülste und Ähnliches folgen der geänderten Kontur. Mit **{{ui:comic.bubble.smooth}}** schalten Sie um, ob die Punkte mit Kurven oder mit geraden Linien verbunden werden. Mit **{{ui:comic.bubble.shapeReset}}** kehrt die Sprechblase zur ursprünglichen Form ihrer Art zurück. Klicken Sie noch einmal auf **{{ui:comic.bubble.shapeFreely}}**, verschwinden die Punkte.

Einen Teil des Textes können Sie fett machen oder mit Betonungspunkten (Punkten neben den Zeichen) versehen. Markieren Sie im Feld Zeichen und klicken Sie auf **{{ui:comic.bubble.bold}}** oder **{{ui:comic.bubble.dots}}**, wird es angewendet, und markieren Sie dieselben Zeichen und klicken noch einmal, wird es entfernt. Im Feld wird Fettschrift als `**Zeichen**` und Betonung als `《《Zeichen》》` angezeigt, und direktes Eintippen bewirkt dasselbe. Auf der Seite stehen die Punkte bei horizontaler Schrift über den Zeichen und bei vertikaler Schrift rechts davon.

Bei **{{ui:comic.bubble.font}}** wählen Sie unter den Schriftarten der App und den auf diesem Computer installierten Schriftarten. Die Namen werden in der jeweiligen Schriftart angezeigt. Wählen Sie **{{ui:comic.bubble.fontDefault}}**, wird **{{ui:settings.comicFont.label}}** in den Einstellungen verwendet ([KI-Assistent und Einstellungen](09-assistant-settings.md)). Die Schriftgröße ändern Sie mit dem Regler **{{ui:comic.bubble.size}}** von 40 % bis 400 %. Mit **{{ui:comic.bubble.vertical}}** werden die Zeichen vertikal von rechts angeordnet. Vertikale Schrift bricht in die nächste Spalte um, wenn die Höhe der Sprechblase erreicht ist.

Ragt der Text über die Sprechblase hinaus, erscheint um die Sprechblase ein roter gestrichelter Rahmen. **{{ui:comic.bubble.fitHelp}}** (die Schaltfläche **{{ui:comic.bubble.fit}}**). Nach dem Verkleinern wird auch die Position korrigiert, damit die Form der Sprechblase ins Bildfeld passt. Sprechblasen, die der Assistent gesetzt hat, werden automatisch so angepasst.

Nicht mehr benötigte Sprechblasen entfernen Sie mit dem Papierkorb in der Zeile des Bereichs oder mit **{{ui:comic.bubble.remove}}** in **{{ui:comic.bubble.editor}}**. Sie lassen sich auch entfernen, indem Sie die Sprechblase auf der Seite wählen und die Entf-Taste drücken oder oben in der Mitte auf die Papierkorb-Schaltfläche klicken.

## Ebenen

Die Ebenen der Seite stehen immer unter den Tabs der rechten Spalte (**{{ui:comic.side.assistant}}** und **{{ui:comic.side.gallery}}**) als Liste **{{ui:canvas.layers.title}}**. Es sind dieselben wie die Ebenen im Tab {{ui:app.tabs.canvas}}. Eine Seite hat von Anfang an die zwei Ebenen **{{ui:comic.layers.panels}}** (Rahmen und Bilder der Bildfelder) und **{{ui:comic.layers.balloons}}** (alle Sprechblasen und Erzähltexte). Je weiter oben in der Liste eine Ebene steht, desto weiter vorn wird sie gezeichnet. Über das Menü „Hinzufügen“ (Plus) fügen Sie eigene **{{ui:canvas.add.raster}}** und **{{ui:canvas.add.inpaint}}** hinzu. Auf einer Seite lassen sich bis zu 32 Ebenen anlegen (einschließlich {{ui:comic.layers.panels}} und {{ui:comic.layers.balloons}}), bis zu 8 Masken, und auf eine Ebene bis zu 5000 Elemente zeichnen. Nähern Sie sich einer Grenze, werden Sie darauf hingewiesen.

Mit dem Augen-Symbol einer Zeile schalten Sie die Anzeige um, mit dem Schloss-Symbol die Sperre. Ausgeblendete Ebenen werden weder auf der Seite noch beim Umwandeln der Seite in ein Bild gezeichnet. Wählen Sie eine Zeile, können Sie **{{ui:canvas.entity.opacity}}** und **{{ui:canvas.entity.blend}}** ({{ui:canvas.entity.blend.normal}}, {{ui:canvas.entity.blend.multiply}}, {{ui:canvas.entity.blend.screen}}) ändern. Zeilen lassen sich durch Ziehen oder über das Rechtsklick-Menü umordnen. Legen Sie eine Ebene unter **{{ui:comic.layers.panels}}**, wird sie zu einer Vorzeichnung unter den Bildern der Bildfelder, legen Sie sie über **{{ui:comic.layers.balloons}}**, liegt sie über den Sprechblasen. Die Ebenen {{ui:comic.layers.panels}} und {{ui:comic.layers.balloons}} lassen sich umordnen und ausblenden, aber nicht löschen und nicht bemalen. Masken gelangen weder in das Bild der Seite noch in die PSD.

## Auf die Seite zeichnen

Mit dem Schalter oben in der Mitte wechseln Sie zwischen **{{ui:comic.paint.page}}** und **{{ui:comic.paint.paint}}**. Im Malmodus lassen sich Bildfelder und Sprechblasen nicht bedienen, und mit denselben Werkzeugen wie im Tab {{ui:app.tabs.canvas}} ({{ui:canvas.tool.brush}}, {{ui:canvas.tool.eraser}}, {{ui:canvas.tool.mosaic}}, {{ui:canvas.tool.rect}}, {{ui:canvas.tool.lasso}}, {{ui:canvas.tool.move}}, {{ui:canvas.tool.bbox}}, {{ui:canvas.tool.colorPicker}}, {{ui:canvas.tool.bucket}}) zeichnen Sie auf die gewählte **{{ui:canvas.add.raster}}**. Auch das Wählen der Zeile einer Rasterebene in der Liste beginnt das Malen, und das Wählen der Zeile {{ui:comic.layers.panels}} oder {{ui:comic.layers.balloons}} oder ein Druck auf die Esc-Taste bringt Sie zur Bedienung der Seite zurück. Auch wenn Sie eine andere Seite öffnen oder den Comic-Bildschirm verlassen, kehren Sie dorthin zurück.

{{ui:canvas.tool.bucket}} füllt den Bereich um die angeklickte Stelle, soweit die Farbe ähnlich ist (mit **{{ui:canvas.toolbar.bucketTolerance}}** legen Sie fest, wie ähnlich). Mit der Schaltfläche **{{ui:canvas.toolbar.filter}}** wenden Sie auf das Bild der gewählten Rasterebene {{ui:canvas.rasterFilter.blur}}, {{ui:canvas.rasterFilter.grayscale}} oder {{ui:canvas.rasterFilter.invert}} an. Beides lässt sich mit dem Rückgängig beim Malen (Rückgängig und Wiederholen der Malwerkzeuge) zurücknehmen. Strg+Z beim Malen macht Schritte an den Ebenen dieser Seite rückgängig. Das Rückgängig des ganzen Comics setzt Ebenen nicht zurück.

Wenn Sie nur einen Teil der Seite neu zeichnen möchten, fügen Sie {{ui:canvas.add.inpaint}} hinzu und übermalen die Maske, legen mit {{ui:canvas.tool.bbox}} den Bereich fest, der erzeugt wird (er kann nicht über die Seite hinausgehen), und klicken in der Werkzeugleiste des Malmodus auf **{{ui:comic.inpaint.run}}**. Gibt es keine Maske, werden Sie aufgefordert, zuerst eine zu übermalen. Das Ergebnis wartet in der Leiste zur Übernahme über der Seite und kommt mit **{{ui:canvas.staging.accept}}** in eine neue Rasterebene. Trifft es ein, während Sie eine andere Seite ansehen, werden Sie darauf hingewiesen, und Sie können es übernehmen, wenn Sie die ursprüngliche Seite in den Malmodus bringen.

## Generierungseinstellungen

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} und {{ui:params.hires.title}} sind dieselben wie im Tab {{ui:app.tabs.generate}}. Ändern Sie die Einstellungen links, wirkt das auch im Tab {{ui:app.tabs.generate}}. Nur die Prompts sind für jedes Bildfeld getrennt (siehe „Die Prompts eines Bildfelds“).

In ein Bildfeld kommt pro Bildfeld ein Bild. Deshalb richtet sich die Bildgröße nicht nach den Einstellungen des Tabs {{ui:app.tabs.generate}}, sondern nach der Größe des Bildfelds. Das Feld für die Anzahl der Erzeugungen erscheint im Comic nicht.

Unter **{{ui:comic.draw.settings}}** in der linken Spalte gibt es auch Felder, die nur für Comics gelten. **{{ui:comic.draw.style.title}}** sind die Qualitätswörter, die an den Anfang der Prompts aller Bildfelder gestellt werden, und ein gemeinsamer Negativ-Prompt für alle Bildfelder. Fügen Sie den Qualitätswörtern auch Ihre gewohnten Künstler- und Stil-Schlagwörter hinzu, wird der Zeichenstil aller Bildfelder einheitlich. Bleibt das Feld leer, werden zum Modell passende Standardwörter hinzugefügt. Im Standard-Negativ-Prompt stehen keine Wörter, die Farbe entfernen. Wollen Sie Schwarzweiß, wählen Sie es über den Effekt der Seite. **{{ui:comic.draw.castReference.title}}** bestimmt, ob die Referenzbilder von Figuren mit dem IP-Adapter verwendet werden, und mit welcher Stärke (siehe „Figuren einheitlich halten“).

## Die Seite in ein Bild umwandeln

Klicken Sie oben in der Mitte auf **{{ui:comic.page.export}}**, wird die Seite als ein Bild (PNG) in der Galerie gespeichert. Die Bilder der Bildfelder und der Text von Sprechblasen und Erzähltext werden in dieses Bild gezeichnet. Die Bilder der Bildfelder werden mit der Position, Größe, Drehung und Spiegelung gezeichnet, die sie auf der Seite haben. Sprechblasen werden mit derselben Form, Linie und demselben Wackeln wie auf der Seite gezeichnet. Der Text wird mit Schriftarten gezeichnet, die in Windows vorhanden sind, etwa für Japanisch. Ebenen werden in der Stapelreihenfolge mit Deckkraft und Mischmodus gezeichnet, ausgeblendete Ebenen sind nicht enthalten. Die Bildgröße richtet sich nach dem Papierformat bei 200 dpi.

Klicken Sie auf **{{ui:comic.page.psd}}**, wird die Seite als PSD-Datei mit getrennten Ebenen über den Download des Browsers gespeichert. Von unten nach oben enthält sie das weiße Papier, das Bild über die ganze Seite, die Bilder der einzelnen Bildfelder (in der Form des Bildfelds ausgeschnitten; Bildfelder ohne Bild grau), alle Rahmenlinien und für jede Sprechblase eine Ebene. Diese und die selbst hinzugefügten Ebenen stehen in der Reihenfolge der Ebenen der Seite, und auch Deckkraft, Mischmodus sowie Ein- und Ausblenden werden übernommen. Der Text der Sprechblasen wird als Bild gezeichnet und lässt sich daher in der PSD nicht neu eintippen. Der auf die Seite angewendete Effekt wirkt auch auf die einzelnen Ebenen. Der Dateiname besteht aus dem Namen des Comics und der Seitennummer.

## Alle Seiten in einer Datei

Klicken Sie oben in der Mitte auf **{{ui:comic.book.export}}**, lassen sich alle Seiten des Comics in einer Datei speichern. **{{ui:comic.book.pdf}}** erzeugt eine PDF, die sich zum Drucken und Teilen eignet, **{{ui:comic.book.cbz}}** eine CBZ, die sich in Comic-Readern lesen lässt, und **{{ui:comic.book.psd}}** eine ZIP-Datei mit den PSDs der einzelnen Seiten. Die Seiten kommen in der angezeigten Reihenfolge hinein, und der Dateiname ist der Name des Comics. Die Datei wird über den Download des Browsers gespeichert. Bei vielen Seiten dauert das Exportieren etwas.

Jede Seite der PDF ist ein Bild im Papierformat. Ist die erste Seite von rechts nach links zu lesen, öffnet sich auch die PDF als Buch, das von rechts nach links gelesen wird. Eine CBZ besteht aus je einem PNG pro Seite in der richtigen Reihenfolge. Die PSDs in der ZIP-Datei haben dieselben Ebenen wie bei **{{ui:comic.page.psd}}** und werden in der Reihenfolge der Seiten nummeriert.

## Rückgängig und Wiederholen

Mit **{{ui:comic.history.undo}}** unten links unter der Seite machen Sie die letzte Änderung rückgängig. Eine rückgängig gemachte Änderung stellen Sie mit **{{ui:comic.history.redo}}** wieder her. Auf der Tastatur machen Sie mit Strg+Z rückgängig und mit Strg+Umschalt+Z (oder Strg+Y) wieder her (auf dem Mac mit Command statt Strg). Rückgängig gemacht werden die Aufteilung der Seite und die Anordnung der Bildfelder (einschließlich der Formen), Prompt und Pose der Bildfelder sowie Sprechblasen. Ebenen setzen Sie mit dem Rückgängig beim Malen zurück (siehe „Auf die Seite zeichnen“). Die Bilder der Bildfelder (einsetzen, entfernen, bewegen), Vorlagen und der Name des Comics werden nicht rückgängig gemacht. Text, den Sie nacheinander in dasselbe Feld schreiben, wird als eine Änderung zusammen rückgängig gemacht. Steht der Cursor in einem Textfeld, setzt Strg+Z den Text dieses Feldes zurück.

## Speichern und Löschen

Ein Comic wird etwa 1 Sekunde nach einer Änderung automatisch gespeichert. Auch wenn Sie die App schließen und wieder öffnen, bleiben gespeicherte Projekte in der Liste, und Seiten, Bildfelder, Sprechblasen und Vorlagen sind unverändert vorhanden. Sie sind auch in einer Sicherung enthalten.

Um ein Projekt zu löschen, öffnen Sie in der Liste der Comics das Menü der Zeile, klicken auf **{{ui:comic.project.delete}}** und bestätigen mit einem zweiten Klick. Mit dem Projekt verschwinden seine Seiten, Bildfelder und Vorlagen. Die gezeichneten Bilder bleiben in der Galerie.

Um eine Seite zu löschen, klicken Sie unter der Seite auf die Papierkorb-Schaltfläche (**{{ui:comic.page.delete}}**) und bestätigen mit einem zweiten Klick. Bildfelder und Sprechblasen der Seite verschwinden, die gezeichneten Bilder bleiben in der Galerie.

## Gezeichnete Bilder verwenden

Gezeichnete Bilder sind ganz normale Bilder, die in die Galerie kommen. Alle Handgriffe, die Bilder der Galerie in anderen Bildschirmen verwenden, etwa ein Galeriebild auf die {{ui:app.tabs.canvas}} zu ziehen, funktionieren unverändert.
