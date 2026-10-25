# Galerie und Betrachter

Die erzeugten Bilder werden in der **Galerie** auf der rechten Seite des Bildschirms aufgelistet. Ein in der Galerie gewähltes Bild lässt sich in der Mitte im **{{ui:app.views.viewer}}** groß ansehen.
Dieses Kapitel erklärt, wie Sie Bilder ordnen und finden, wie Sie sie im Betrachter ansehen, wie Sie ihre Einstellungen abrufen und wie Sie Bilder löschen und herunterladen.

## Die Galerie im Überblick

Das rechte Bedienfeld besteht aus zwei Teilen übereinander.

- Oben: **{{ui:gallery.boards.title}}**. Sie sind wie Ordner, in denen Bilder abgelegt werden.
- Unten: Vorschaubilder der Bilder des gewählten Boards.

Die Zeile über den Vorschaubildern enthält Folgendes.

- Ein Schalter zwischen „{{ui:gallery.view.images}}“ und „{{ui:gallery.view.assets}}“ sowie die Anzahl der Bilder.
- Die Lupen-Schaltfläche: Suche ({{ui:gallery.search.label}})
- Die Kalender-Schaltfläche: {{ui:gallery.date.button}}
- Die Zahnrad-Schaltfläche: {{ui:gallery.settings.title}}
- Die Schaltfläche mit dem Pfeil nach oben: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** enthält die in novira erzeugten Bilder (auch Videos und Audio).
**{{ui:gallery.view.assets}}** enthält hochgeladene Bilder und Dinge wie Logos, die getrennt von den erzeugten Bildern als Material behandelt werden. Wenn ein Bild zu fehlen scheint, sehen Sie in der jeweils anderen Ansicht nach.

Die Größe der Vorschaubilder lässt sich mit dem Regler hinter der Zahnrad-Schaltfläche ändern.
Vorschaubilder von Videos und Audio tragen ein Wiedergabe-Symbol. Wenn Sie den Mauszeiger darüber seitlich bewegen, sehen Sie die Szene an dieser Position.

## Boards

Ein Board ist ein Behälter, um Bilder zu trennen und zu ordnen. „{{ui:gallery.boards.uncategorized}}“ ist ein von Anfang an vorhandenes Board und enthält die Bilder, die auf keinem Board liegen.

- **Erstellen**: Klicken Sie oben rechts im Board-Bereich auf **＋** ({{ui:gallery.boards.add}}). Den Namen können Sie gleich dort eingeben.
- **Wechseln**: Klicken Sie auf ein Board. Darunter werden nur die Bilder dieses Boards aufgelistet.
- **Umbenennen**: Doppelklicken Sie auf den Namen des Boards oder wählen Sie im Rechtsklickmenü „{{ui:common.rename}}“.
- **Suchen**: Mit der Lupe im Board-Bereich durchsuchen Sie die Board-Namen.
- **Einklappen**: Klicken Sie auf die Überschrift „{{ui:gallery.boards.title}}“. Ziehen Sie den unteren Rand des Board-Bereichs, um seine Höhe zu ändern.

### In welches Board neue Bilder kommen

Ein neu erzeugtes Bild (auch ein hochgeladenes) kommt in das Board mit der Markierung „**{{ui:gallery.boards.autoBadge}}**“.
Anfangs wird jedes Board, auf das Sie klicken, zu „{{ui:gallery.boards.autoBadge}}“. Wenn Sie es festlegen möchten, deaktivieren Sie in den Galerie-Einstellungen „{{ui:gallery.settings.autoAssign}}“ und bestimmen das Board im Rechtsklickmenü des Boards über „{{ui:gallery.boards.setAutoAdd}}“.

### Das Rechtsklickmenü eines Boards

- **{{ui:gallery.boards.setAutoAdd}}**: Macht es zum Speicherort für neue Bilder.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: Blendet das Board in der Liste aus. Es wird nicht gelöscht; wenn Sie in den Galerie-Einstellungen „{{ui:gallery.settings.showArchived}}“ aktivieren, ist es wieder sichtbar. Mit „{{ui:gallery.boards.unarchive}}“ holen Sie es zurück.
- **{{ui:gallery.boards.delete}}**: Es erscheint ein Bestätigungsfenster, in dem Sie eine der folgenden Möglichkeiten wählen.
  - „{{ui:gallery.boards.deleteBoardOnly}}“: Die Bilder bleiben erhalten und wandern nach „{{ui:gallery.boards.uncategorized}}“.
  - „{{ui:gallery.boards.deleteBoardAndImages}}“: Die Bilder im Board werden ebenfalls gelöscht.

> „{{ui:gallery.boards.uncategorized}}“ kann nicht umbenannt, archiviert oder gelöscht werden.

## Bilder auswählen

Vorschaubilder lassen sich wie folgt auswählen.

| Aktion | Ergebnis |
|---|---|
| Klick | Wählt dieses eine Bild. Das im Betrachter gezeigte Bild wechselt ebenfalls zu diesem |
| Klick bei gedrückter Taste `Ctrl` | Fügt es zur Auswahl hinzu oder nimmt es aus der Auswahl heraus (Mehrfachauswahl) |
| Klick bei gedrückter Taste `Shift` | Wählt alles vom zuvor gewählten Bild bis zum angeklickten Bild |
| Klick bei gedrückter Taste `Alt` | Vergleicht es mit dem Bild im Betrachter (siehe unten) |
| Doppelklick | Schaltet die Mitte auf den Betrachter um und zeigt das Bild groß |
| `Ctrl+A` | Wählt alle aktuell aufgelisteten Bilder |
| Pfeiltasten | Verschieben die Auswahl auf das vorherige, nächste, obere oder untere Bild. Mit `Shift` erweitern Sie den Bereich |
| `Esc` | Hebt die Auswahl auf |

> Die Pfeiltasten und Ähnliches funktionieren, wenn sich der Mauszeiger über der Galerie befindet oder wenn die Mitte der Betrachter ist.

Gewählte Bilder erhalten einen blauen Rahmen. Wenn Sie den Mauszeiger auf ein Vorschaubild setzen, erscheinen folgende Elemente.

- Die Größe des Bildes (mit „{{ui:gallery.settings.alwaysShowSize}}“ in den Galerie-Einstellungen können Sie sie auch dauerhaft anzeigen)
- Die Stern-Schaltfläche (Favorit markieren oder Markierung entfernen)
- Die Papierkorb-Schaltfläche (Löschen)

Ein Bild mit Stern erhält oben links ein gelbes Sternsymbol.

## Rechtsklick auf ein Vorschaubild

![Das Rechtsklickmenü eines Vorschaubilds mit Einträgen wie Im Betrachter öffnen, Herunterladen, Remix und An Leinwand senden](shot:gallery-menu)

Ein Rechtsklick auf ein Vorschaubild zeigt eine Liste der Aktionen, die für dieses Bild möglich sind. Nicht verfügbare Aktionen sind ausgegraut (zum Beispiel ist „{{ui:gallery.menu.remix}}“ bei einem Bild ohne gespeicherte Einstellungen nicht verfügbar).

| Menüeintrag | Funktion |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | Zeigt es groß im Betrachter in der Mitte |
| **{{ui:common.download}}** | Speichert die Bilddatei |
| **{{ui:share.menu}}** | Exportiert Kopien in einem gewählten Format und einer gewählten Größe (die Generierungsinfos lassen sich entfernen) |
| **{{ui:common.copy}}** (`Ctrl+C`) | Kopiert das Bild in die Zwischenablage |
| **{{ui:gallery.menu.compare}}** (`Alt+Klick`) | Vergleicht es mit dem im Betrachter gezeigten Bild |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Öffnet den Workflow, mit dem das Bild erzeugt wurde |
| **{{ui:gallery.menu.remix}}** (`R`) | Lädt alle Einstellungen außer dem Seed in das linke Bedienfeld |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Lädt nur den Prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Lädt nur den Seed (der Seed wird dabei fixiert) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Lädt alle Einstellungen |
| **{{ui:gallery.menu.useSize}}** | Lädt nur Breite und Höhe |
| **{{ui:gallery.menu.sendToCanvas}}** | Legt es auf der Leinwand ab. Sie können wählen, ob eine neue Leinwand entsteht oder ob es der aktuellen Leinwand als Ebene oder Maske hinzugefügt wird |
| **{{ui:gallery.menu.useAsReference}}** | Fügt es einem Feld für Referenzbilder hinzu |
| **{{ui:gallery.menu.sendToVideo}}** | Macht es zum ersten Bild eines Videos |
| **{{ui:gallery.menu.sendToWorkflow}}** | Fügt es dem geöffneten Workflow als Bildeingabe hinzu |
| **{{ui:gallery.menu.sendToText}}** | Macht es zum Hintergrund eines Textbilds |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | Sendet es an den Tab Upscaling |
| **{{ui:gallery.menu.segment}}** | Wählt einen Teil des Bildes aus, den Sie ausschneiden oder neu zeichnen können |
| **{{ui:gallery.derive.menu}}** | Erzeugt mit den Einstellungen dieses Bildes weitere Bilder mit anderem Seed oder leichten Änderungen |
| **{{ui:cutout.menu}}** | Entfernt den Hintergrund |
| **{{ui:facefix.menu}}** | Findet Gesichter und zeichnet sie neu |
| **{{ui:gallery.menu.trim}}** | Schneidet transparente Ränder ab und speichert das Ergebnis als neues transparentes Bild |
| **{{ui:character.menu}}** | Registriert das Bild als Charakter |
| **{{ui:gallery.menu.changeBoard}}** | Verschiebt es in ein anderes Board |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Markiert als Favorit oder entfernt die Markierung |
| **{{ui:gallery.menu.delete}}** (`Del`) | Löscht das Bild |

Wie „{{ui:gallery.menu.sendToCanvas}}“ und die Aktionen zum erneuten Erzeugen oder Verbessern von Bildern verwendet werden, erklären [Auf der Leinwand weiter zeichnen](05-canvas.md), [Bilder verbessern](04-improve.md), [Upscaling und Workflows](06-upscaling-workflows.md) und [Video, Musik, Stimme, Logos und Text](07-media.md).

> Nur bei Verwendung im Webbrowser eines Computers erscheint zusätzlich „{{ui:gallery.menu.openInNewTab}}“. In der Desktop-Version erscheint er nicht.

## Mehrere Bilder gleichzeitig bearbeiten

![Das Menü nach Rechtsklick bei zwei gewählten Bildern](shot:gallery-multi-menu)

Wenn Sie zwei oder mehr Bilder wählen und dann mit der rechten Maustaste auf eines davon klicken, erscheint ein Menü für die gemeinsame Bearbeitung. Ganz oben steht die Anzahl der gewählten Bilder, etwa „2 Bilder ausgewählt“.

- **{{ui:gallery.menu.changeBoard}}**: Verschiebt die gewählten Bilder gemeinsam in ein anderes Board.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: Speichert die gewählten Bilder nacheinander.
- **{{ui:share.menu}}**: Exportiert Kopien der gewählten Bilder zum Teilen gemeinsam (Videos und Audio werden ausgelassen).
- **{{ui:gallery.menu.batch}}**: Wendet dieselbe Verarbeitung (Hintergrundentfernung, Vergrößerung usw.) auf alle gewählten Bilder an. Jedes Bild kommt einzeln in die Warteschlange.
- Der rote Eintrag ganz unten: Löscht die gewählten Bilder gemeinsam.

> Wenn Sie mit der rechten Maustaste auf ein nicht gewähltes Bild klicken, erscheint das Menü für dieses einzelne Bild. Um mehrere Bilder zu bearbeiten, wählen Sie sie zuerst aus und klicken dann mit der rechten Maustaste auf eines der gewählten Bilder.

## Suchen, filtern und sortieren

### Suche

Mit der Lupen-Schaltfläche öffnen Sie das Suchfeld. Geben Sie einen Dateinamen oder einen Teil des positiven Prompts ein, und die Bilder dieses Boards werden eingegrenzt. Mit `Esc` schließen Sie die Suche und heben den Filter auf.

### Nach Datum filtern

![Das Menü zum Filtern nach Datum mit Schaltflächen wie Heute und Gestern sowie einem Monatskalender](shot:gallery-date)

Mit der Kalender-Schaltfläche öffnen Sie das Menü zum Filtern nach Datum.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: Legen den Zeitraum mit einer einzigen Schaltfläche fest.
- Der Monatskalender: Tage mit Bildern sind markiert. Ein Klick auf ein Datum listet nur die Bilder dieses Tages auf. Mit den Pfeilen oben wechseln Sie zwischen den Monaten.
- **{{ui:gallery.date.custom}}**: Geben Sie ein Startdatum und ein Enddatum ein und klicken Sie auf **{{ui:gallery.date.apply}}**, um nur die Bilder dieses Zeitraums aufzulisten. Auch nur eines der beiden Daten genügt.
- **{{ui:gallery.date.quick.all}}**: Beendet das Filtern.

Solange ein Filter aktiv ist, erscheint über der Galerie ein Etikett mit dem Zeitraum. Mit dem × auf dem Etikett lässt sich der Filter ebenfalls aufheben.

### Galerie-Einstellungen

Mit der Zahnrad-Schaltfläche ändern Sie Anordnung und Aussehen.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: Wenn ein Bild fertig ist, wird es automatisch angezeigt.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: Listet Bilder mit Stern ganz oben auf (von Anfang an aktiviert).
- {{ui:gallery.settings.sort}}: „{{ui:gallery.settings.sortNewest}}“ oder „{{ui:gallery.settings.sortOldest}}“.
- {{ui:gallery.settings.groupByDate}}: Trennt die Bilder mit einer Überschrift für jeden Tag.

## Im Betrachter ansehen

![Der Betrachter: oben die Werkzeugleiste, in der Mitte das Bild, unten rechts die Zoom-Schaltflächen und unten die Informationen zum Bild](shot:viewer)

Der „{{ui:app.views.viewer}}“ in der Mitte zeigt das gewählte Bild groß.
Mit den Pfeilen am linken und rechten Bildschirmrand wechseln Sie zum vorherigen und nächsten Bild. Die unterste Zeile zeigt die Größe des Bildes, das verwendete Modell, den Seed und den Dateinamen. Videos und Audio können direkt dort abgespielt werden.

### Zoomen und Verschieben

- Mausrad: Zoomt um die Position des Mauszeigers herum hinein und heraus.
- Ziehen: Verschiebt das Bild, wenn es vergrößert ist und über den Rand hinausragt. Das geht auch bei gedrückter Taste `Space` oder gedrückter Radtaste.
- Doppelklick: Wechselt zwischen der Gesamtansicht und der tatsächlichen Größe (100 %).
- Schaltflächen unten rechts: Verkleinern, der Zoomfaktor (ein Klick öffnet eine Liste häufig genutzter Faktoren), Vergrößern, `1:1` (tatsächliche Größe) und An Bildschirm anpassen.
- Tasten: `+` und `-` zoomen schrittweise, `Ctrl+0` passt an den Bildschirm an, und `Ctrl+1` zeigt die tatsächliche Größe.

### Werkzeugleiste

Die Werkzeugleiste über dem Bild enthält die Aktionen für dieses Bild. Wenn Sie den Mauszeiger auf eine Schaltfläche setzen, sehen Sie ihren Namen und ihr Tastenkürzel.

| Gruppe | Schaltflächen |
|---|---|
| Informationen | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Einstellungen laden | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Senden und verbessern | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Ordnen | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

Sie tun dasselbe wie die gleichnamigen Einträge im Rechtsklickmenü des Vorschaubilds. Bei einem Bild ohne Einstellungen (etwa einem hochgeladenen Bild) sind die Schaltflächen zum Laden der Einstellungen ausgegraut.

## Bildinformationen und Einstellungen abrufen

![Das Metadaten-Panel mit einer Liste aus Prompt, Modell, Seed, Schritten usw.](shot:viewer-metadata)

Klicken Sie in der Werkzeugleiste auf die Schaltfläche **{{ui:gallery.viewer.toggleMetadata}}** (`I`), und über dem Bild öffnet sich ein Informationspanel. Mit einem erneuten Klick oder mit dem × oben rechts schließen Sie es.
Das Panel hat vier Tabs.

- **{{ui:gallery.meta.tabRecall}}**: Die beim Erzeugen des Bildes verwendeten Einstellungen werden Eintrag für Eintrag aufgelistet (Prompt, Modell, Seed, Schritte, CFG-Skala, Scheduler, Größe, LoRA usw.). Mit der Pfeil-Schaltfläche rechts in jeder Zeile laden Sie **nur diesen Eintrag** in das linke Bedienfeld.
- **{{ui:gallery.meta.tabMetadata}}**: Zeigt den gespeicherten Inhalt unverändert an. Mit der Schaltfläche oben rechts können Sie ihn kopieren.
- **{{ui:gallery.meta.tabDetails}}**: Dateiname, Größe, Erstellungsdatum und -uhrzeit, Board, ob das Bild einen Stern hat usw.
- **{{ui:gallery.meta.tabWorkflow}}**: Bei einem mit einem Workflow erzeugten Bild wird dessen Inhalt angezeigt.

Welche Methode Sie zum Laden der Einstellungen wählen, hängt davon ab, wie viel davon Sie benötigen.

| Methode | Was geladen wird |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Alle Einstellungen, etwa Prompt, Modell, Seed und Größe. Der Seed wird fixiert |
| **{{ui:gallery.menu.remix}}** | Alles außer dem Seed. Die aktuelle Seed-Einstellung (zufällig oder fixiert) bleibt unverändert. Verwenden Sie es, wenn Sie „ein anderes Bild mit denselben Einstellungen“ erzeugen möchten |
| **{{ui:gallery.menu.usePrompt}}** | Nur den Prompt (positiv und negativ) |
| **{{ui:gallery.menu.useSeed}}** | Nur den Seed. Der Seed wird fixiert |
| **{{ui:gallery.menu.useSize}}** | Nur Breite und Höhe (nur im Rechtsklickmenü) |

Prüfen Sie danach das linke Bedienfeld und klicken Sie auf **{{ui:params.invoke.invoke}}**.

> In der Bilddatei (PNG) eines in novira erzeugten Bildes sind die Einstellungen mitgespeichert. Deshalb lassen sich die Einstellungen manchmal sogar bei einem Bild laden, das Sie an einen anderen Ort verschoben und erneut hochgeladen haben. Bilder aus anderer Software und Bilder, die bearbeitet und neu gespeichert wurden, enthalten keine Einstellungen.

## Zwei Bilder vergleichen

![Der Betrachter beim Vergleich zweier Bilder mit dem Schieberegler. Die senkrechte Linie in der Mitte wird nach links und rechts bewegt](shot:viewer-compare)

Wenn Sie den Unterschied zwischen zwei Bildern sehen möchten, verwenden Sie den Vergleich.

1. Klicken Sie auf das erste Bild, das Sie vergleichen möchten, um es zu wählen, und stellen Sie die Mitte auf den Tab „{{ui:app.views.viewer}}“.
2. Klicken Sie bei gedrückter Taste `Alt` auf das Vorschaubild des zweiten Bildes (es geht auch über „{{ui:gallery.menu.compare}}“ im Rechtsklickmenü).
3. Auf dem zweiten Vorschaubild erscheint das Etikett „{{ui:gallery.compare.badge}}“, und der Betrachter wechselt zur Vergleichsansicht.

> Sie können auch beginnen, indem Sie bei gedrückter Taste `Ctrl` zwei Bilder wählen und dann die Vergleichs-Schaltfläche der Werkzeugleiste oder die Taste `C` drücken. Wenn Sie nur ein Bild gewählt haben, erscheint der Hinweis „{{ui:gallery.compare.hint}}“.

Oben in der Vergleichsansicht erscheinen folgende Schaltflächen.

- **{{ui:gallery.compare.slider}}**: Die beiden Bilder liegen übereinander. Wenn Sie die senkrechte Linie in der Mitte ziehen, sehen Sie links und rechts, wie sie sich unterscheiden.
- **{{ui:gallery.compare.sideBySide}}**: Ordnet die beiden Bilder links und rechts nebeneinander an.
- **{{ui:gallery.compare.hover}}**: Wechselt nur, solange sich der Mauszeiger über dem Bild befindet, zum zweiten Bild.
- **{{ui:gallery.compare.swap}}**: Tauscht das erste und das zweite Bild.
- **{{ui:gallery.compare.exit}}**: Beendet den Vergleich. Das geht auch mit `Esc`.

Zoomen und Verschieben wirken gleichzeitig auf beide Bilder. Unterschiede in feinen Details sind bei starker Vergrößerung leichter zu erkennen.

## Favoriten und Löschen

### Als Favorit markieren

Bilder, die Ihnen gefallen, können Sie mit einem Stern versehen. Sie können ihn über die Stern-Schaltfläche am Vorschaubild, über das Rechtsklickmenü oder über die Werkzeugleiste des Betrachters setzen oder entfernen.
Wenn in den Galerie-Einstellungen „{{ui:gallery.settings.starredFirst}}“ aktiviert ist, stehen Bilder mit Stern ganz vorn.

### Löschen

Ein Bild lässt sich auf folgende Weisen löschen.

- Die Papierkorb-Schaltfläche am Vorschaubild
- „{{ui:gallery.menu.delete}}“ im Rechtsklickmenü
- Die Papierkorb-Schaltfläche in der Werkzeugleiste des Betrachters
- Das Bild wählen und die Taste `Delete` drücken (`Backspace` funktioniert genauso)

Es erscheint ein Bestätigungsfenster, und mit „{{ui:common.delete}}“ wird das Bild gelöscht.

> Ein gelöschtes Bild kann nicht wiederhergestellt werden. Es gibt auch keinen Papierkorb, aus dem sich Bilder zurückholen ließen.

Wenn Sie im Bestätigungsfenster „{{ui:common.dontAskAgain}}“ ankreuzen, werden Bilder künftig ohne Bestätigung gelöscht. Um die Bestätigung zurückzuholen, aktivieren Sie in den **{{ui:app.nav.settings}}** „{{ui:settings.confirmOnDelete}}“.

## Hochladen und Herunterladen

### Hochladen

Sie können Bilder von Ihrem Computer in die Galerie bringen.

- Klicken Sie über der Galerie auf die Schaltfläche **{{ui:gallery.upload}}** und wählen Sie Dateien.
- Ziehen Sie Bilddateien aus dem Explorer per Drag & Drop in die Galerie. Wenn Sie sie auf einem Board ablegen, kommen sie in dieses Board.

Hochgeladene Bilder kommen in **{{ui:gallery.view.assets}}** des Boards „{{ui:gallery.boards.autoBadge}}“, und die Anzeige wechselt ebenfalls dorthin. Sie können mehrere Dateien gleichzeitig hinzufügen. Dateien, die keine Bilder sind, werden ignoriert.

### Herunterladen

Um die Datei eines Bildes zu speichern, verwenden Sie das Rechtsklickmenü oder **{{ui:common.download}}** in der Werkzeugleiste des Betrachters. Wenn Sie mehrere Bilder gewählt haben, werden sie gemeinsam gespeichert.

### Zum Teilen exportieren

![Das Fenster zum Exportieren zum Teilen: Format (PNG, JPEG, WebP), Qualität, Obergrenze der langen Seite und der Schalter, der die Generierungsinfos entfernt](shot:share-export)

Kopien von Bildern für soziale Netzwerke oder zur Weitergabe erstellen Sie über **{{ui:share.menu}}** im Rechtsklickmenü (es funktioniert auch bei mehreren gewählten Bildern) oder in der Werkzeugleiste des Betrachters. Die Originale bleiben unverändert.

- **{{ui:share.format}}**: Wählen Sie PNG, JPEG oder WebP. Bei JPEG können Sie die **{{ui:share.quality}}** (1 bis 100) festlegen, und transparente Bereiche werden weiß. WebP wird verlustfrei gespeichert.
- **{{ui:share.size}}**: „{{ui:share.size.original}}“, 2048, 1536 oder 1024 px oder „{{ui:share.size.custom}}“, um eine Länge einzugeben. Kleinere Bilder werden nicht vergrößert.
- **{{ui:share.removeInfo}}**: Anfangs aus. Wenn aktiviert, werden Prompt, Einstellungen und Workflow weggelassen, und das Bild wird aus seinen Pixeln neu gespeichert, sodass auch keine anderen eingebetteten Daten übrig bleiben. Ist sie aus, bleiben die Einstellungen nur bei PNG erhalten. Aktivieren Sie es, bevor Sie ein Bild weitergeben, wenn Sie den Prompt nicht zeigen möchten.

Nach einem Klick auf **{{ui:share.run}}** öffnet sich in der Desktop-Version ein Fenster zur Wahl des Zielordners. Der Dateiname ist der Dateiname aus der Galerie mit der neuen Dateiendung. Existiert bereits eine Datei mit diesem Namen, wird eine Nummer wie „-2“ oder „-3“ angehängt; es wird nichts überschrieben. Nach dem Export öffnet **{{ui:share.openFolder}}** diesen Ordner.

> Exportiert werden nur Bilder. Videos und Audio unter den gewählten Elementen werden ausgelassen. Im Browser landen die Dateien in den Downloads des Browsers.

## Drag & Drop

Vorschaubilder lassen sich an andere Stellen ziehen und dort verwenden. Wenn mehrere gewählt sind, bewegen sich die gewählten Bilder gemeinsam.

- **Auf ein Board**: Verschiebt das Bild in dieses Board.
- **Auf ein Feld {{ui:params.refImage.sectionLabel}}**: Macht es zu einem Referenzbild (siehe [Bilder erzeugen](02-generate.md)).
- **Auf das Bildfeld von Leinwand oder Upscaling oder auf eine Karte der Startansicht**: Verwendet es als Material für diese Ansicht.

Dateien aus dem Explorer können Sie auf die Galerie, auf ein Board, auf ein Feld für Referenzbilder, auf eine Karte der Startansicht usw. ziehen.

## Tastenkürzel der Galerie

| Aktion | Taste |
|---|---|
| Vorheriges, nächstes, oberes oder unteres Bild wählen | Pfeiltasten (`Shift` erweitert den Bereich) |
| Alle wählen | `Ctrl+A` |
| Auswahl aufheben | `Esc` |
| Gewählte Bilder löschen | `Delete` |
| Bild im Betrachter kopieren | `Ctrl+C` |
| Informationspanel öffnen und schließen | `I` |
| Remix, Prompt, Seed, alles | `R`, `P`, `S`, `A` |
| Workflow laden | `W` |
| An Upscaling senden | `Shift+U` |
| Vergleich starten und beenden | `C` |
| An Bildschirm anpassen, tatsächliche Größe | `Ctrl+0`, `Ctrl+1` |
| Vergrößern, verkleinern | `+`, `-` |

Diese funktionieren, wenn sich der Mauszeiger über der Galerie befindet oder wenn die Mitte der Betrachter ist. Die Liste finden Sie auch unter „{{ui:app.nav.hotkeys}}“ im Menü **{{ui:app.nav.settings}}**.
