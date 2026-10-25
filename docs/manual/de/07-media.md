# Video, Musik, Stimme, Logos und Text

Neben Bildern kann novira Video, Musik, Stimme und Logos erzeugen, und Sie können Bildern auch Text und Sprechblasen hinzufügen.

Alle Funktionen werden im linken Bedienfeld des Tabs **{{ui:app.tabs.generate}}** verwendet. Lesen Sie zur Bedienung bei Bildern zuerst [Bilder erzeugen](02-generate.md).

## Umschalten, was erzeugt wird

Ganz oben im linken Bedienfeld befindet sich ein Umschalter, der nur aus Symbolen besteht. Von links nach rechts sind das **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}** und **{{ui:app.tabs.comic}}**. **{{ui:app.tabs.comic}}** ist der Bildschirm zum Erstellen von Comicseiten ([Comics zeichnen](12-comic.md)).

Halten Sie die Maus über ein Symbol, um seinen Namen zu sehen. Beim Umschalten wechseln das linke Bedienfeld und die Anzeige in der Mitte zu der jeweiligen Art.

## Gemeinsame Funktionen

Die Bildschirme für Video, Musik, Stimme und Logos sind gleich aufgebaut.

- Ganz oben im linken Bedienfeld befindet sich eine **{{ui:presets.label}}**, mit der Sie einen ganzen Satz Einstellungen auf einmal abrufen.
- Darunter liegt die Schaltfläche zum Starten der Erzeugung. Fehlt etwas, lässt sie sich nicht anklicken, und der Grund erscheint direkt darunter.
- Lautet der Grund etwa „Zuerst das Modell für die gewählte Art herunterladen“, installieren Sie das Modell über die als Nächstes erscheinende **Modellkarte**.
- Statt der Startschaltfläche können Sie auch mit `Ctrl+Enter` erzeugen.
- Während der Erzeugung erscheint der Status (in der Warteschlange, wird erzeugt, bei einem Fehler der Grund) ganz oben im mittleren Bereich. Mit **{{ui:media.job.cancel}}** können Sie den Vorgang stoppen.

> Es wird immer nur eines gleichzeitig erzeugt. Während ein Video oder Musik erzeugt wird, warten andere Generierungen, etwa von Bildern, in der Warteschlange. Die wartenden Einträge können Sie auch im Tab **{{ui:app.tabs.queue}}** prüfen.

### Benötigte Modelle zuerst herunterladen

Video, Musik, Stimme und Logos benötigen jeweils eigene Modelle. Sind sie nicht installiert, erscheint im linken Bedienfeld eine „Modellkarte“. Klicken Sie auf **{{ui:pack.install}}**, und die App holt sie automatisch.

| Was erzeugt wird | Kartenname | Ungefähre Größe |
|---|---|---|
| Video | {{ui:pack.title.video}} | Etwa 18 GB |
| Video (schnelle Version) | {{ui:pack.title.turbo}} | Dateien, die mit der Standardversion geteilt werden, werden nicht doppelt geladen |
| Musik | {{ui:pack.title.music}} | Etwa 10 GB |
| Stimme | {{ui:pack.title.voice}} | Etwa 9 GB |
| Logo | {{ui:pack.title.logo}} | Etwa 12 GB |

Die Größen sind ungefähre Angaben. Die genaue Größe entnehmen Sie der Zahl auf der Karte.

Für Video können Sie zwischen zwei Modellen wählen, dem Standardmodell und dem schnellen. Die Karte zeigt Namen und Speicher der GPU dieses PCs und wie gut jedes Modell dazu passt (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}** oder **{{ui:media.choice.fit.short}}**). Das Modell, das zu diesem PC passt, ist mit **{{ui:media.choice.recommended}}** markiert. Lässt sich der GPU-Speicher nicht auslesen, wird die Eignung als **{{ui:media.choice.fit.unknown}}** angezeigt. Das sind grobe Richtwerte: Auch ein mit **{{ui:media.choice.fit.short}}** markiertes Modell kann noch laufen, nur langsamer.

Der Download erfolgt nur einmal, zu Beginn. Der Fortschritt wird auf der Karte angezeigt und, auf jedem Bildschirm, im Feld „{{ui:media.downloads.title}}“ unten links, wo Sie mittendrin auch **{{ui:common.cancel}}** wählen können. Schlägt er fehl, erscheint der Grund auf der Karte, und die Schaltfläche wechselt zu **{{ui:pack.retry}}**.

Ist die Größe eines Downloads bekannt, wird auch die verbleibende Zeit angezeigt („Noch ca. 2 Min.“; sie wird aus der Downloadgeschwindigkeit berechnet und erscheint daher in den ersten Augenblicken nicht). Ist die Größe nicht bekannt oder wird gerade eine Erweiterung eingerichtet, wird stattdessen die seit dem Start vergangene Zeit angezeigt. Bei einem Download einer Erweiterung öffnet **{{ui:media.downloads.manage}}** im Feld die Liste der installierten Erweiterungen.

Ist die Installation abgeschlossen, verschwindet die Karte. Nur bei Stimme wird die Engine zum Vorlesen mitinstalliert, daher dauert es etwas länger.

> Vor dem Download muss die Engine, die Bilder erzeugt (ComfyUI), fertig vorbereitet sein. Wenn etwas nicht klappt, siehe [Hilfe bei Problemen](10-troubleshooting.md).

## Video erzeugen

![Der Videobildschirm. Links Einstellungen wie Methode, Prompt und Größe, in der Mitte die Liste der erzeugten Videos](shot:media-video)

Bei Video gibt es eine Methode, es aus Text zu erzeugen, und eine, ein einzelnes Bild zu animieren.

### So gehen Sie vor

1. Wählen Sie im linken Bedienfeld **{{ui:media.tab.video}}**.
2. Klicken Sie beim ersten Mal auf der Karte **{{ui:pack.title.video}}** auf **{{ui:pack.install}}**.
3. Wählen Sie bei **{{ui:video.mode.label}}** zwischen **{{ui:video.mode.text}}** und **{{ui:video.mode.image}}**.
4. Schreiben Sie in **{{ui:video.prompt}}**, was für ein Video Sie möchten. Bei der Erzeugung aus einem Bild schreiben Sie, wie es sich bewegen soll.
5. Klicken Sie auf **{{ui:params.invoke.invoke}}**.

Wählen Sie **{{ui:video.mode.image}}**, dann erscheint ein Feld zur Angabe des Bildes, das animiert werden soll. Legen Sie ein Bild dort ab oder wählen Sie ein Bild in der Galerie aus und klicken Sie dann auf **{{ui:video.pickFromGallery}}**.

Sie können auch in der Galerie mit der rechten Maustaste auf ein Bild klicken und **{{ui:gallery.menu.sendToVideo}}** wählen.

### Einstellungen

| Eintrag | Was es ist |
|---|---|
| {{ui:video.negative}} | Elemente, die nicht enthalten sein sollen. Wörter, die Unschärfe, Text und Ähnliches vermeiden, sind von Anfang an eingetragen |
| {{ui:video.model}} | **{{ui:video.model.standard}}** erzeugt sorgfältig. **{{ui:video.model.fast}}** erzeugt in kurzer Zeit, aber Details können gröber ausfallen |
| {{ui:video.size}} | Die Größe des Videos. Anfangs 832×480. Hoch- und Quadratformat sind ebenfalls wählbar |
| {{ui:video.fps}} | Die Anzahl der Bilder pro Sekunde (8 bis 30) |
| {{ui:video.lengthLabel}} | 1 bis 10 Sekunden. Die Zahl der Frames ergibt sich automatisch aus Länge und Bildrate |
| {{ui:video.steps}}, {{ui:video.cfg}} | Feinabstimmung des Ergebnisses. Bei der Wahl eines Modells wechseln sie auf Werte, die zu diesem Modell passen |
| {{ui:video.randomSeed}} | Schalten Sie es aus, können Sie den Seed festlegen und dieselbe Bewegung neu erzeugen |

Für **{{ui:video.model.fast}}** müssen Sie **{{ui:pack.title.turbo}}** separat herunterladen. Dieses Modell hat eine nichtkommerzielle Lizenz.

### Wenn die GPU wenig Speicher hat

Unter **{{ui:video.light.title}}** gibt es zwei Schalter.

- **{{ui:video.light.fp8}}**: Der vom Modell belegte Speicher wird auf fast die Hälfte gesenkt. Details können etwas gröber werden.
- **{{ui:video.light.tiled}}**: Verhindert, dass der Speicherbedarf im letzten Abschlussschritt plötzlich ansteigt. Die Qualität ändert sich nicht, es ist etwas langsamer.

Reicht das noch nicht, können Sie das Video auch in kleinerer Größe erzeugen und das fertige Video anschließend mit **{{ui:video.finish}}** vergrößern.

### Ergebnisse

Ein Video braucht von einigen Minuten bis über zehn Minuten. Ist es fertig, wird es als Videoliste in der Mitte angezeigt und lässt sich direkt dort abspielen. Es gelangt außerdem als Vorschaubild mit einem ▶ in die Galerie rechts.

Unter jedem Video werden Prompt, Größe, Länge und Seed angezeigt. Mit der Papierkorb-Schaltfläche können Sie es löschen.

Klicken Sie auf **{{ui:video.finish}}**, dann öffnet sich der Bildschirm **{{ui:finish.title}}**.

- **{{ui:finish.smooth.title}}**: Füllt Zwischenbilder auf, damit die Bewegung flüssiger wird.
- **{{ui:finish.enlarge.title}}**: Vergrößert das Video mit einem Upscaling-Modell. Das braucht viel Zeit und Speicher.

Das Originalvideo bleibt unverändert, und das fertig bearbeitete Video wird als neues hinzugefügt. Zum Auffüllen von Frames kann eine Erweiterung nötig sein (folgen Sie den Hinweisen auf dem Bildschirm und klicken Sie auf **{{ui:finish.install}}**).

## Musik erzeugen

![Der Musikbildschirm. Links stehen Einstellungen wie Stil, Liedtext, Länge und Tempo](shot:media-music)

Hier entsteht ein Song aus Text (dem Stil) und Liedtext.

### So gehen Sie vor

1. Wählen Sie im linken Bedienfeld **{{ui:media.tab.music}}**.
2. Klicken Sie beim ersten Mal auf der Karte **{{ui:pack.title.music}}** auf **{{ui:pack.install}}**.
3. Schreiben Sie in **{{ui:music.tags}}** Genre, Stimmung und Instrumente durch Kommas getrennt. Zum Beispiel etwas wie `upbeat J-pop, female vocal, piano, bright`.
4. Möchten Sie einen Song mit Gesang, schreiben Sie den **{{ui:music.lyrics}}**. Möchten Sie keinen Gesang, aktivieren Sie **{{ui:music.instrumental}}**.
5. Klicken Sie auf **{{ui:params.invoke.invoke}}**.

Der Stil ist erforderlich. Bleibt er leer, kann nichts erzeugt werden.

Den Liedtext können Sie mit Abschnittsmarken in eckigen Klammern schreiben, etwa `[verse]` (Strophe) und `[chorus]` (Refrain). Sie können ihn unter anderem auf Englisch, Japanisch und Chinesisch schreiben. Die Sprache des Liedtexts wählen Sie mit **{{ui:music.language}}**. Wenn Sie unsicher sind, wählen Sie **{{ui:music.lang.unknown}}**.

### Einstellungen

| Eintrag | Was es ist |
|---|---|
| {{ui:music.lengthLabel}} | 10 bis 240 Sekunden |
| {{ui:music.bpm}} | Die Geschwindigkeit des Songs (40 bis 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | Von `C major` bis `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Feinabstimmung des Ergebnisses |

### Ergebnisse

Ein Song braucht von einigen zehn Sekunden bis zu einigen Minuten und erscheint in der Liste in der Mitte. Jeder hat einen Player und lässt sich direkt dort abspielen. Länge, Tempo, Tonart und Seed werden angezeigt, und gibt es einen Liedtext, können Sie **{{ui:audio.lyrics}}** öffnen, um ihn zu prüfen.

Er gelangt außerdem mit einem Notensymbol als Vorschaubild in die Galerie.

## Stimme erzeugen

![Der Stimmbildschirm. Links stehen der vorzulesende Text, die Sprache und die Wahl der Stimme](shot:media-voice)

Der eingegebene Text wird als Stimme vorgelesen.

### So gehen Sie vor

1. Wählen Sie im linken Bedienfeld **{{ui:media.tab.voice}}**.
2. Klicken Sie beim ersten Mal auf der Karte **{{ui:pack.title.voice}}** auf **{{ui:pack.install}}**. Engine und Modelle zum Vorlesen werden nur im Ordner der App abgelegt.
3. Geben Sie in **{{ui:voice.text}}** den Text ein, der vorgelesen werden soll.
4. Wählen Sie die **{{ui:voice.language}}**. Bei **{{ui:voice.lang.Auto}}** wird sie anhand des Textes bestimmt.
5. Legen Sie die Stimme fest (siehe unten).
6. Klicken Sie auf **{{ui:params.invoke.invoke}}**.

### So wählen Sie die Stimme

Unter **{{ui:voice.mode.label}}** können Sie aus zwei Methoden wählen.

- **{{ui:voice.mode.preset}}**: Wählen Sie aus den vorbereiteten Stimmen. Es gibt zum Beispiel Stimmen für Japanisch (weiblich), Chinesisch, Englisch (männlich) und Koreanisch (weiblich); Sprache und Geschlecht stehen hinter dem Namen. Schreiben Sie in **{{ui:voice.style}}** etwa „fröhlich und lebhaft“ oder „langsam und ruhig“, dann legen Sie fest, wie gesprochen wird.
- **{{ui:voice.mode.design}}**: Beschreiben Sie in **{{ui:voice.description}}** die Eigenschaften der Stimme in Worten. Zum Beispiel etwas wie „Eine ruhige, tiefe Männerstimme. Spricht langsam und sanft.“ Die Beschreibung ist erforderlich.

Die Sprachen, die vorgelesen werden können, sind Japanisch, Englisch, Chinesisch, Koreanisch, Deutsch, Französisch, Russisch, Portugiesisch, Spanisch und Italienisch.

### Ergebnisse

Die fertige Stimme erscheint mit einem Player in der Liste in der Mitte. Angezeigt werden auch die verwendete Stimme (bei einer aus Worten erzeugten Stimme „{{ui:audio.voice.designed}}“) und die Sprache. Sie gelangt ebenfalls in die Galerie.

Die erste Erzeugung dauert etwas, weil das Modell geladen wird. Wenn Sie es eine Weile nicht verwenden, wird das Modell aus der GPU entfernt, und der Speicher steht wieder für andere Aufgaben zur Verfügung.

## Logos erzeugen

![Der Logobildschirm. Links stehen der Logotext, der Stil, die Form und die Anzahl der Kandidaten](shot:media-logo)

Hier entstehen Logokandidaten mit Text.

### So gehen Sie vor

1. Wählen Sie im linken Bedienfeld **{{ui:media.tab.logo}}**.
2. Klicken Sie beim ersten Mal auf der Karte **{{ui:pack.title.logo}}** auf **{{ui:pack.install}}**.
3. Geben Sie in **{{ui:logo.text}}** den Text ein, der im Logo stehen soll (bis zu 60 Zeichen).
4. Schreiben Sie in **{{ui:logo.style}}** Stimmung, Farben und Form. Japanisch oder Englisch ist möglich. Zum Beispiel etwas wie „minimalistisch, blau und weiß, geometrisch“.
5. Wählen Sie mit **{{ui:logo.size}}** die Form aus **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** und **{{ui:logo.size.tall}}**.
6. Wählen Sie bei **{{ui:logo.countLabel}}** eine Zahl von 1 bis 4 und klicken Sie auf **{{ui:params.invoke.invoke}}**.

### Ergebnisse und Text darüberlegen

Die erzeugten Logos erscheinen als Kandidaten in der Mitte. In der Galerie landen sie unter **{{ui:gallery.view.assets}}** und nicht unter **{{ui:gallery.view.images}}**. Beim Öffnen des Logobildschirms wechselt die Galerie rechts automatisch zur Ansicht der Assets.

Englischer Text wird genau wiedergegeben, japanischer kann verzerrt ausfallen. Klicken Sie in diesem Fall bei einem Kandidaten, der Ihnen gefällt, auf **{{ui:logo.layText}}**. Es wechselt zu **{{ui:media.tab.text}}**, und dieses Logo wird zum Hintergrund, sodass Sie beliebigen Text darüberlegen können.

## Text (Wörter und Sprechblasen)

![Der Textbildschirm. Links die Schaltflächen zum Hinzufügen von Text, der Hintergrund, die Ebenen und die Textstile; in der Mitte das bearbeitete Bild](shot:media-text)

**{{ui:media.tab.text}}** ist ein Bearbeitungsbildschirm, auf dem Sie einem Bild Text und Sprechblasen hinzufügen und es als Bild speichern. Ein Modell muss nicht heruntergeladen werden. Auch die Verarbeitung, die Bilder erzeugt, wird nicht verwendet, daher können Sie ihn sofort nutzen.

### Den Hintergrund festlegen

Mit **{{ui:text.bg.title}}** wählen Sie, worauf der Text platziert wird.

- **{{ui:text.bg.image}}**: Verwendet ein Bild als Hintergrund. Zeigen Sie ein Bild in der Galerie an und klicken Sie auf **{{ui:text.bg.useViewer}}**, oder legen Sie ein Bild auf diesem Bildschirm ab. Es wird in derselben Größe wie das Bild gespeichert.
- **{{ui:text.bg.color}}**: Ein einfarbiger Hintergrund. Wählen Sie die Größe aus der Liste, etwa 1024×1024 oder 1920×1080, oder geben Sie Breite und Höhe als Zahlen ein.
- **{{ui:text.bg.transparent}}**: Kein Hintergrund. So können Sie nur den Text als transparentes Bild erzeugen.

Sie können auch in der Galerie mit der rechten Maustaste auf ein Bild klicken und **{{ui:gallery.menu.sendToText}}** wählen.

### Text und Sprechblasen hinzufügen

- **{{ui:text.add.text}}**: Fügt eine Textebene hinzu.
- **{{ui:text.add.bubble}}**: Fügt eine Sprechblase hinzu. Wählen Sie die Form aus **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** und **{{ui:text.shape.narration}}**.

Das Hinzugefügte lässt sich auf dem Bildschirm durch Ziehen verschieben. Wählen Sie es aus, erscheinen an den vier Ecken runde Griffe, mit denen Sie die Größe durch Ziehen ändern. Eine Sprechblase hat einen „{{ui:text.bubble.tail}}“, dessen Richtung Sie ändern, indem Sie den Griff an seiner Spitze ziehen.

`Delete` entfernt, `Ctrl+D` dupliziert, die Pfeiltasten verschieben in kleinen Schritten, `Ctrl+Z` macht rückgängig und `Ctrl+Shift+Z` (oder `Ctrl+Y`) stellt wieder her. Die Schaltflächen **{{ui:text.undo}}** und **{{ui:text.redo}}** auf dem Bildschirm tun dasselbe. Die Anzeigegröße ändern Sie mit **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** und **{{ui:text.zoom.fit}}**.

### Ebenen

Der hinzugefügte Text und die Sprechblasen stehen unter **{{ui:text.layers.title}}** in der Reihenfolge ihrer Stapelung. Je weiter oben in der Liste, desto weiter vorn.

Für jede Ebene können Sie **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, die Reihenfolge mit **{{ui:text.layer.up}}** und **{{ui:text.layer.down}}** ändern, **{{ui:text.layer.duplicate}}** und **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** entfernt alle auf einmal.

### Den Text anpassen

Wählen Sie eine Ebene aus, erscheinen darunter ihre Einstellungen.

| Eintrag | Was es ist |
|---|---|
| {{ui:text.content}} | Geben Sie den Text ein (Zeilenumbrüche sind möglich) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | Schriftart, Stärke und Größe. Die Schriftarten werden mit der App geliefert, sodass das Ergebnis auf jedem PC gleich aussieht |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** oder **{{ui:text.fill.gradient}}** (die Farbe ändert sich von oben nach unten) |
| {{ui:text.stroke}}, {{ui:text.outline}} | Der Rand des Textes und ein weiterer Rand außerhalb davon |
| {{ui:text.shadow}} | Schatten. Farbe, Unschärfe und Versatz sind wählbar |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | Der Abstand zwischen Zeichen und zwischen Zeilen sowie die Ausrichtung |
| {{ui:text.vertical}} | Schaltet auf vertikale Schreibweise. Bei vertikaler Schreibweise wechselt die Ausrichtung zu „{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}“ |
| {{ui:text.bend}} | Krümmt den Text (nicht mit vertikaler Schreibweise verwendbar) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | Drehung und Deckkraft |

Bei Sprechblasen können Sie außerdem Größe, Füllfarbe, Umriss und Zeiger anpassen. Bei der Form **{{ui:text.shape.burst}}** ändert **{{ui:text.bubble.shuffle}}** die gezackten Spitzen. Schalten Sie **{{ui:text.bubble.autoFit}}** ein, schrumpft der Text, damit er hineinpasst.

### Stilvorgaben

Die Vorgabe ganz oben im linken Bedienfeld enthält logoartige Stile: **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** und **{{ui:text.preset.soft}}**. Wählen Sie eine Textebene aus und wenden Sie dann eine Vorgabe an, dann erhält der Text diesen Stil.

Sie können auch eigene Stile speichern (Schriftart, Füllung, Kontur, Schatten, Zeichenabstand).

### Speichern

Wenn Sie fertig sind, klicken Sie auf **{{ui:text.save}}**. Es gelangt als PNG-Bild in der Größe des Hintergrunds in die Galerie. Auch nach dem Speichern bleibt das auf dem Bildschirm Bearbeitete erhalten, sodass Sie weiter daran arbeiten können.

## Vorgaben

Die Bildschirme für Video, Musik, Stimme, Logos und Text haben ebenfalls Vorgaben in derselben Form wie bei Bildern. Wählen Sie unter **{{ui:presets.label}}** oben links im Bildschirm eine aus, dann werden die gespeicherten Einstellungen auf einmal übernommen.

Um eigene Einstellungen zu speichern, klicken Sie auf die Speicherschaltfläche neben der Vorgabe (**{{ui:presets.saveNew}}**) und vergeben einen Namen. Das Gespeicherte steht unter **{{ui:presets.group.mine}}**. Über das Menü „…“ jedes Listeneintrags können Sie auch **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** und **{{ui:presets.delete}}**. Die von Anfang an mitgelieferten stehen unter **{{ui:presets.group.builtin}}** (die Namen sind auf Englisch).

Was gespeichert wird, unterscheidet sich je nach Bildschirm leicht.

| Bildschirm | Was gespeichert wird | Was nicht gespeichert wird |
|---|---|---|
| Video | Prompt, Modell, Größe, Länge und Qualitätseinstellungen | Der Seed und das Quellbild |
| Musik | Die Stil-Tags und die Song-Einstellungen | Der Liedtext und der Seed |
| Stimme | Die Sprache und die Stimme (Stimme und Sprechstil oder die Stimmbeschreibung) | Der vorzulesende Text |
| Logo | Die Stilwörter, die Form und die Anzahl der Kandidaten | Der Text im Logo |
| Text | Der Stil des Textes | Der Inhalt des Textes |

Die mitgelieferten Vorgaben sind drei für Video, „Quick preview“, „Standard 832x480“ und „Vertical, low VRAM“; zwei für Musik, „Lo-fi instrumental“ und „J-pop song“; zwei für Stimme, „Calm narrator“ und „Energetic announcer“; und fünf für Logos.

Wie Sie Modelle finden und installieren, steht unter [Modelle](08-models.md).
