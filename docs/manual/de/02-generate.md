# Bilder erzeugen

Dieses Kapitel erklärt, wie Sie im Tab **{{ui:app.tabs.generate}}** Bilder erzeugen.
Wie der Bildschirm zu lesen ist, steht unter [Erste Schritte](01-start.md). Wie Sie erzeugte Bilder ansehen und ordnen, steht unter [Die Galerie und der Betrachter](03-gallery.md).

Der Ablauf ist immer derselbe.

1. Ein Modell wählen
2. Einen Prompt schreiben
3. Bei Bedarf Einstellungen wie Größe und Seed anpassen
4. Auf **{{ui:params.invoke.invoke}}** klicken

Das Bild wird nicht in dem Moment gezeichnet, in dem Sie klicken. Zuerst kommt es in die „{{ui:app.tabs.queue}}“ (die Reihe der wartenden Einträge). Wenn es an der Reihe ist, werden die Bilder nacheinander gezeichnet.

## Einen Prompt schreiben

![Der Tab Generieren mit einem Satz im Prompt und festgelegtem Seed](shot:generate-prompt)

Der Bereich „{{ui:params.prompt.title}}“ im linken Bedienfeld hat zwei Felder.

- **{{ui:params.prompt.positive}}**: Hier steht, was gezeichnet werden soll.
- **{{ui:params.prompt.negative}}**: Hier steht, was nicht erscheinen soll, zum Beispiel `blurry, watermark`. Sie können auch mit leerem Feld generieren.

Einige Faustregeln fürs Schreiben.

- Reihen Sie Wörter oder kurze Wendungen aneinander, getrennt durch Kommas (`,`).
- Bei vielen Modellen liefert Englisch eher das erwartete Ergebnis. Gibt die Beschreibung des Modells eine Schreibweise vor, richten Sie sich danach.
- Setzen Sie die wichtigen Wörter weiter nach vorn.

Die kleinen Schaltflächen über den Feldern bewirken Folgendes.

| Schaltfläche | Funktion |
|---|---|
| **{{ui:params.prompt.recommended}}** | Fügt Qualitätswörter, die zum gewählten Modell passen (etwa `masterpiece, best quality`), an den Anfang von „{{ui:params.prompt.positive}}“ ein und häufig vermiedene Wörter an das Ende von „{{ui:params.prompt.negative}}“. Bereits vorhandene Wörter werden nicht doppelt eingefügt |
| **{{ui:params.prompt.expand}}** | Bearbeitet Positiv und Negativ nebeneinander in einem großen Fenster |
| **{{ui:params.promptBook.open}}** | Öffnet eine Liste gesammelter Wörter samt Bedeutung (siehe unten) |
| **{{ui:caption.fromPrompt}}** | Betrachtet ein Bild und schreibt Wörter auf, die sich als Prompt verwenden lassen. Auf diese Schaltfläche können Sie auch ein Galeriebild oder eine Bilddatei von Ihrem Computer ziehen (erklärt unter [Bilder verbessern und wiederverwenden](04-improve.md)) |
| „Positiv-Vorgaben“ / „Negativ-Vorgaben“ an jedem Feld | Speichert und ruft nur den Text des Prompts auf (siehe unten) |

### Token-Anzahl

Die Anzeige „0 / 77 Token“ über dem Feld ist ein grobes Maß dafür, wie viel Sie geschrieben haben.
Ein Token ist eine Einheit, in der das Modell Wörter liest. Überschreiten Sie die Grenze, färbt sich die Zahl in einer Warnfarbe. Bei manchen Modellen wirkt der Teil jenseits der Grenze möglicherweise schwächer.
Die Zahl ist „ungefähr“. Sie ist keine exakte Zählung.

### Kombinationen auf einmal mit `{red|blue}`

Schreiben Sie im positiven Feld geschweifte Klammern mit Auswahlmöglichkeiten, die durch senkrechte Striche (`|`) getrennt sind, etwa `{red|blue}`. Dann wird für jede Möglichkeit ein eigenes Bild erzeugt.

- `a {red|blue} flower` ergibt zwei Varianten: `a red flower` und `a blue flower`.
- Bei zwei oder mehr Klammerpaaren entstehen alle Kombinationen. `a {red|blue} {cat|dog}` ergibt vier.
- Sie können geschweifte Klammern auch ineinander verschachteln.
- Um eine geschweifte Klammer als normales Zeichen zu verwenden, setzen Sie `\` davor (`\{`).
- Die Anzahl der Kombinationen ist auf 100 begrenzt.

Liegt der Wert von „{{ui:params.invoke.iterations}}“ (siehe unten) bei 2 oder mehr, ergibt sich die Gesamtzahl aus Kombinationen mal Anzahl. Zum Beispiel ergeben 2 Kombinationen bei einer Anzahl von 3 insgesamt 6 Bilder.
Diese Syntax funktioniert nur im positiven Feld. Im negativen Feld werden geschweifte Klammern als gewöhnliche Zeichen behandelt.

Mit der Schaltfläche **{{ui:params.prompt.dynamicPreview}}** (dem Symbol `{ }`) über dem positiven Feld prüfen Sie, welche Texte daraus entstehen. Ein Klick darauf zeigt eine Liste der Kombinationen.

### Wildcards `__name__`

![Das Wildcard-Fenster: links die Listen, rechts Name und Einträge der gewählten Liste](shot:wildcards)

Schreiben Sie `__name__` (zwei Unterstriche vor und nach dem Namen) in das positive Feld. Dann werden die Einträge der Liste „{{ui:params.wildcards.title}}“ mit diesem Namen nacheinander eingesetzt. Halten Sie oft genutzte Auswahlmöglichkeiten in einer Liste, dann müssen Sie nicht jedes Mal `{red|blue}` schreiben.

- `1girl, __hair-color__` ergibt für jeden Eintrag der Liste hair-color einen Prompt.
- Einträge dürfen `{a|b}` und andere Wildcards enthalten. Wildcards dürfen bis zu 6 Ebenen tief ineinander verschachtelt werden.
- Die Grenze für die Zahl der Kombinationen (100) gilt wie bei `{ }`.
- Ein Name ohne Liste, eine Liste ohne Einträge oder eine Liste, die sich selbst verwendet, verhindert den Klick auf **{{ui:params.invoke.invoke}}**, und der Grund steht unter der Schaltfläche.

Die Listen öffnen Sie mit **{{ui:params.wildcards.open}}** unten im Fenster der Schaltfläche **{{ui:params.prompt.dynamicPreview}}**. Von Anfang an sind drei Listen enthalten: hair-color (Haarfarbe), expression (Gesichtsausdruck) und time-of-day (Tageszeit).

| Bedienelement | Funktion |
|---|---|
| **{{ui:params.wildcards.new}}** | Fügt eine leere Liste hinzu |
| Das Feld „{{ui:params.wildcards.name}}“ | Benennt die Liste um. Erlaubt sind Buchstaben, Ziffern, `-` und `_`, beginnend und endend mit einem Buchstaben oder einer Ziffer |
| Das Feld „{{ui:params.wildcards.entries}}“ | Ein Eintrag pro Zeile. Leere Zeilen und Zeilen, die mit `#` beginnen, sind keine Einträge |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Liest oder schreibt eine Liste als .txt-Datei mit einem Eintrag pro Zeile. Eine importierte Datei wird zu einer neuen Liste mit dem Namen der Datei |
| **{{ui:common.delete}}** | Löscht die gewählte Liste |

Die Listen werden in der App gespeichert (auf dem Computer, den Sie benutzen).

### Zufällig auswählen

Gibt es zu viele Kombinationen, schalten Sie im Fenster der Schaltfläche **{{ui:params.prompt.dynamicPreview}}** den Eintrag „{{ui:params.prompt.dynamicMode}}“ um.

- **{{ui:params.prompt.modeCombinatorial}}** (Standard): Erzeugt für jede Kombination die eingestellte Anzahl Bilder.
- **{{ui:params.prompt.modeRandom}}**: Erzeugt die eingestellte Anzahl Bilder und wählt für jedes eine Kombination aus. Die Auswahl folgt dem Seed des Bildes, sodass erneutes Zeichnen mit demselben Seed denselben Prompt ergibt.

In beiden Fällen behält jedes fertige Bild den Prompt, der tatsächlich verwendet wurde.

## Seed

Ein Bild entsteht aus einer Zahl, dem „{{ui:params.seed.label}}“. Derselbe Seed mit denselben Einstellungen ergibt dasselbe Bild.

In der Zeile „{{ui:params.seed.label}}“ oben im linken Bedienfeld gibt es zwei Schaltflächen.

- **{{ui:params.seed.random}}** (der Würfel): Bei jeder Generierung wird ein neuer Seed verwendet. Sie erhalten jedes Mal ein anderes Bild. Dies ist die Voreinstellung.
- **{{ui:params.seed.fixed}}** (das Schloss): Es wird mit dem aktuellen Seed gezeichnet. Wie oft Sie auch mit denselben Einstellungen erzeugen, das Bild bleibt gleich. Das ist praktisch, wenn Sie den Unterschied sehen möchten, den ein einzelnes Wort im Prompt macht.

Ist der Seed festgelegt, sind das Zahlenfeld für den Seed und die Schaltfläche „{{ui:params.seed.shuffle}}“ gesperrt (so ändern Sie ihn nicht versehentlich).
Möchten Sie eine bestimmte Zahl verwenden, tippen Sie sie in das Zahlenfeld, während „{{ui:params.seed.random}}“ gewählt ist, und wechseln dann zu „{{ui:params.seed.fixed}}“.
Möchten Sie den Seed eines Bildes verwenden, das Ihnen gefällt, öffnen Sie es in der Galerie und klicken auf „{{ui:gallery.menu.useSeed}}“. Der Seed wird übernommen und festgelegt (siehe [Die Galerie und der Betrachter](03-gallery.md)).

Erhöhen Sie bei festem Seed die Anzahl, erhalten das zweite und alle weiteren Bilder einen Seed, der jeweils um eins höher ist.

## Ein Modell wählen

![Die geöffnete Modellliste, gegliedert nach Familien wie FLUX, SDXL und SD1.X](shot:model-picker)

Mit der Modellkarte oben im linken Bedienfeld wählen Sie das Modell, das das Bild zeichnet.

1. Klicken Sie auf das Feld mit dem Modellnamen.
2. Wählen Sie aus der Liste. Die Liste ist nach Modellfamilien gegliedert (FLUX, SDXL, SD1.X und so weiter). Bei vielen Einträgen geben Sie einen Teil des Namens in das Suchfeld oben ein, um sie einzugrenzen.
3. Das gewählte Modell erhält ein ✓, und auch das Bild der Karte (das Titelbild) ändert sich.

Unter der Liste führt die Schaltfläche **{{ui:app.tabs.short.models}}** zum Tab {{ui:app.tabs.models}} (Verwaltung Ihrer Modelle), und die Schaltfläche **{{ui:app.tabs.short.browse}}** führt zum Tab {{ui:app.tabs.browse}} (Suche im Internet). Wie Sie weitere Modelle hinzufügen, steht unter [Modelle bereitstellen](08-models.md).

Sind für das Modell empfohlene Einstellungen (Schritte, CFG, Scheduler, Größe) hinterlegt, werden sie bei der Wahl automatisch eingetragen.
Wechseln Sie zu einem Modell einer anderen Familie, werden LoRAs und Ähnliches, die nicht zum neuen Modell passen, entfernt (Sie erfahren, wie viele es waren).

Mit der Schaltfläche **{{ui:params.profile.title}}** unter dem Modellfeld sehen Sie die empfohlenen Werte für dieses Modell als Liste. Weichen Ihre aktuellen Einstellungen von den empfohlenen ab, wird die Schaltfläche auffälliger gefärbt, und **{{ui:params.profile.apply}}** setzt alles auf die empfohlenen Werte.

> Ist kein Modell installiert, steht im Feld „{{ui:params.model.noModels}}“, und Sie können nicht generieren. Schließen Sie zuerst [Modelle bereitstellen](08-models.md) ab.

## Weitere Einstellungen

Unter dem Prompt gibt es Abschnitte, die Einstellungen gruppieren. Per Klick lassen sie sich öffnen und schließen.

| Abschnitt | Inhalt |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (direkt unter dem Prompt) | Bilder, mit denen Stimmung oder Figuren eines Bildes gesteuert werden (siehe unten) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, Breite und Höhe. Dazu die Schaltflächen „{{ui:params.image.swap}}“, „{{ui:params.image.lock}}“ und „{{ui:params.image.optimal}}“ |
| **{{ui:params.generation.title}}** | LoRA (ein kleines Zusatzmodell, das einen Zeichenstil oder eine Figur hinzufügt), {{ui:params.generation.scheduler}}, {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Ein zweiter Durchgang, der das gezeichnete Bild vergrößert und erneut zeichnet (siehe unten) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (Bilder, die gekachelt keine Naht zeigen) und mehr |

Wenn Sie unsicher sind, kann alles außer der Größe so bleiben, wie es bei der Modellwahl eingetragen wurde.
Halten Sie den Zeiger über einen Namen („{{ui:params.generation.steps}}“, „{{ui:params.generation.cfg}}“ und so weiter), um eine kurze Erklärung zu sehen. Die Überschrift jedes Abschnitts zeigt eine kleine Zusammenfassung seiner aktuellen Werte.

Je größer das Bild, desto mehr Zeit und Belastung für Ihren Computer. Es empfiehlt sich, zuerst eine kleinere Größe auszuprobieren und bei gutem Ergebnis mit [Upscaling](06-upscaling-workflows.md) zu vergrößern.

## Hires-Fix

![Der Abschnitt Hires-Fix geöffnet und eingeschaltet](shot:hires-fix)

Wird gleich in großer Größe gezeichnet, entstehen oft zwei Personen statt einer oder verzerrte Formen. **{{ui:params.hires.title}}** zeichnet zuerst in der eingestellten Größe, vergrößert das Bild und zeichnet es dann mit demselben Seed und denselben Einstellungen erneut. Eine Generierung liefert so ein großes Bild mit Details überall. Dieser Abschnitt ist im Tab {{ui:app.tabs.generate}} und im Tab {{ui:app.tabs.comic}} vorhanden.

- **{{ui:params.hires.enable}}**: Einschalten, um die Funktion zu nutzen.
- **{{ui:params.hires.scale}}**: 1,25- bis 2-fach. Die endgültige Größe steht in der Abschnittsüberschrift und in der untersten Zeile.
- **{{ui:params.hires.strength}}**: 0,2 bis 0,75. Niedrig belässt das erste Bild fast unverändert, hoch zeichnet stärker neu. Der Standard ist 0,45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** vergrößert ohne Modell. Sind Upscale-Modelle installiert, die auch der Tab {{ui:app.tabs.upscaling}} nutzt, können Sie auch eines davon wählen.
- **{{ui:params.hires.steps}}**: die Schritte des zweiten Durchgangs. 0 verwendet so viele wie der erste Durchgang.

Es dauert etwa so lange wie zweimal zeichnen. Der Fortschritt zählt beide Durchgänge zusammen. LoRAs und Referenzbilder werden auch im zweiten Durchgang verwendet.

Ist das Ergebnis deutlich größer, als das Modell gut zeichnen kann (etwa 2048 px an der langen Seite bei SDXL, 1536 px bei SD1.X), erscheint unter der Schaltfläche zum Starten ein Hinweis. Sie können trotzdem generieren; zerfällt das Bild, verringern Sie die Skalierung.

Das Bild behält die Größe des ersten Durchgangs und die {{ui:params.hires.title}}-Einstellungen. Wenn Sie es in der Galerie mit „{{ui:gallery.menu.useAll}}“ laden, wird der {{ui:params.hires.title}} genauso eingestellt, wie er war.

## Durchläufe und die Schaltfläche Starten

![Das Menü, geöffnet über den Pfeil neben der Schaltfläche Starten](shot:invoke-menu)

Die Bedienelemente zum Generieren befinden sich oben im linken Bedienfeld.

- **{{ui:params.invoke.invoke}}** (die blaue Schaltfläche): Hängt ans Ende der Warteschlange an und generiert. Sie können auch `Ctrl+Enter` drücken.
- **Die Zahl neben ×**: Wie viele Bilder in einem Vorgang erzeugt werden. Bei „3“ entstehen drei Bilder.
- **Die rote Schaltfläche ×**: Bricht ab, was gerade gezeichnet wird.
- **Das ∨ rechts neben jeder Schaltfläche**: Ein Menü mit weiteren Vorgängen.

Lässt sich die Schaltfläche nicht klicken, wird sie grau, und der Grund (zum Beispiel: kein Modell gewählt) erscheint in der Zeile darunter. Halten Sie den Zeiger über die Schaltfläche, um die Liste der Gründe zu sehen.
Beim Zeichnen wechselt die Schaltfläche zu „{{ui:params.invoke.generating}}“ und zeigt den Fortschritt (%) sowie die Zahl der Wartenden in der Warteschlange.

### Das Menü ∨ der Schaltfläche Starten

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): Zeichnet in der Reihenfolge, in der Sie geklickt haben. Das entspricht einer normalen Generierung.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): Reiht sich vorn in die Warteschlange ein. Nutzen Sie es, wenn es eilt und Sie nur ein Bild ausprobieren möchten.
- **{{ui:xyplot.menu}}**: Stellt auf Basis der aktuellen Einstellungen Bilder mit einer oder zwei geänderten Einstellungen in einer Tabelle zusammen. Sie werden mit demselben Seed gezeichnet, sodass der einzige Unterschied die geänderte Einstellung ist. Wählen Sie für die horizontale und die vertikale Achse CFG-Skala, Schritte, das Modell oder Ähnliches, geben Sie die Werte ein und klicken Sie auf **{{ui:xyplot.run}}**.

### Das Abbrechen-Menü

Klicken Sie auf das ∨ rechts neben der roten Schaltfläche ×, um das folgende Menü zu zeigen.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): Entfernt alles, Wartendes und gerade Gezeichnetes. Es erscheint keine Rückfrage.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: Hält die Verarbeitung der Warteschlange an und setzt sie fort.
- **{{ui:params.invoke.openQueue}}**

## Das fertige Bild ansehen

![Der Bildschirm nach Abschluss der Generierung. Das Bild wird im Betrachter in der Mitte angezeigt und steht auch in der Galerie rechts](shot:generate-result)

Sobald Sie klicken, wechselt die Mitte zum Betrachter.
Beim Zeichnen erscheint über der Galerie rechts ein Band „{{ui:gallery.generating.title}}“, in dem Sie das entstehende Bild, die Schrittzahl und den Fortschritt sehen. Auch die dünne Linie am oberen Rand der Mitte zeigt den Fortschritt.

Danach wird das Bild zur Galerie hinzugefügt und im Betrachter angezeigt.
Das Bild wird im aktuell gewählten Board gespeichert (dem mit „{{ui:gallery.boards.autoBadge}}“ im rechten Bedienfeld). Boards sowie das Ordnen, Vergleichen und Wiederholen von Bildern werden unter [Die Galerie und der Betrachter](03-gallery.md) erklärt.

> Stört es Sie, dass der Betrachter von selbst zu jedem neuen Bild wechselt, schalten Sie „{{ui:gallery.settings.autoSwitch}}“ in den {{ui:gallery.settings.title}} (Zahnrad-Schaltfläche) aus.

## Vorgaben

![Die Liste der Vorgaben mit mitgelieferten und gespeicherten Vorgaben](shot:presets)

Eine Kombination von Einstellungen, die Sie oft nutzen, können Sie als Vorgabe speichern. Klicken Sie ganz oben im linken Bedienfeld auf die Karte „{{ui:presets.label}}“, um die Liste zu öffnen.

Eine Vorgabe enthält Folgendes zusammen.

- Die Prompts (positiv und negativ)
- Das Modell und die einzelnen Einstellungen (Größe, Schritte, CFG, Scheduler, VAE und so weiter)
- LoRAs und Referenzbilder

Seed und Anzahl sind nicht enthalten.

So verwenden Sie sie.

- Klicken Sie auf einen Eintrag der Liste, werden seine Einstellungen übernommen (**{{ui:presets.apply}}**).
- Mit **{{ui:presets.saveNew}}** unten in der Liste (oder der Speichern-Schaltfläche neben der Karte) speichern Sie die aktuellen Einstellungen unter einem Namen.
- Über das „…“ rechts neben einem Eintrag können Sie **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** und **{{ui:presets.delete}}** wählen.
- Die Liste gliedert sich in „{{ui:presets.group.mine}}“ und „{{ui:presets.group.builtin}}“. Die mitgelieferten Vorgaben sind Beispiele, die zur App gehören.

Unabhängig davon gibt es über dem positiven und dem negativen Feld jeweils auch ein Vorgabenfeld. Es speichert und ruft nur den Text des Prompts auf. Es eignet sich, um feste Wendungen zu speichern (Zusammenstellungen von Qualitätswörtern oder von Wörtern, die man vermeiden möchte).

## Die Prompt-Liste

![Die Prompt-Liste. Wörter und Bedeutungen sind nach Kategorien geordnet, mit den Schaltflächen Positiv und Negativ zum Hinzufügen](shot:prompt-book)

Damit Sie Prompts auch aufbauen können, wenn Sie englische Wörter nicht im Kopf haben, gibt es die **{{ui:params.promptBook.open}}**. Öffnen Sie sie mit der Schaltfläche über dem positiven und dem negativen Feld.

- Wählen Sie links eine Kategorie (Frisuren, Ausdrücke, Kleidung, Bildaufbau und so weiter), werden nur die Wörter dieser Kategorie aufgelistet. Das Suchfeld oben durchsucht Wörter, Bedeutungen, Kategorien und Notizen gleichzeitig.
- Klicken Sie rechts neben einem Wort auf „{{ui:params.prompt.positive}}“ oder „{{ui:params.prompt.negative}}“, wird das Wort zum Prompt hinzugefügt. Ein hinzugefügtes Wort erhält ein Häkchen, und ein erneuter Klick entfernt es.
- Tippen Sie ein Wort und seine Bedeutung in das Eingabefeld ganz oben und klicken Sie auf **{{ui:params.promptBook.register}}**, um ein eigenes Wort hinzuzufügen. Der Stift rechts neben einem Wort bearbeitet es, der Papierkorb löscht es.

## Referenzbilder

**{{ui:params.refImage.sectionLabel}}** ist eine Funktion, die ein neues Bild in Richtung der „Stimmung“ oder des „Stils“ eines vorhandenen lenkt. Das Bild wird nicht unverändert kopiert. Farbpalette, Zeichenstil und Gesamteindruck dienen als Anhaltspunkte.

1. Klicken Sie unter dem Prompt auf die Schaltfläche **＋**, um einen Rahmen hinzuzufügen.
2. Ziehen Sie ein Bild aus der Galerie auf diesen Rahmen. Auch eine Bilddatei von Ihrem Computer können Sie ablegen.
3. Klicken Sie auf den Rahmen, dann öffnet sich ein kleines Einstellungsfenster.

Im kleinen Fenster legen Sie Folgendes fest.

- **{{ui:params.refImage.model}}**: Das spezielle Modell für Referenzbilder (IP-Adapter). Es muss zur Familie des gewählten Modells passen.
- **{{ui:params.refImage.methodLabel}}**: Was als Anhaltspunkt dient, etwa das ganze Bild, nur der Stil oder nur der Bildaufbau (bei manchen Modellfamilien wird es nicht angezeigt).
- **{{ui:params.refImage.weight}}**: Wie stark gelenkt wird.
- **{{ui:params.refImage.begin}}** und **{{ui:params.refImage.end}}**: Von wo bis wo im Zeichenvorgang die Wirkung eintritt.

Ist ein erforderliches Modell oder eine Erweiterung nicht installiert, erscheint am Rahmen ein Warnzeichen, und im kleinen Fenster sowie unter der Schaltfläche Starten steht ein Hinweis. Über die Schaltfläche im Hinweis können Sie es installieren.

> Ein Referenzbild dient dazu, „die Stimmung zu lenken“. Wenn Sie „auf Grundlage dieses Bildes neu zeichnen“ möchten, nutzen Sie die Leinwand. Siehe [Auf der Leinwand weiter zeichnen](05-canvas.md).

### Charaktere

Im Feld „{{ui:character.row.label}}“ über den Referenzbildern rufen Sie registrierte Charaktere auf (beliebig viele Bilder derselben Figur samt Wörtern, die ihr Aussehen beschreiben).
Wählen Sie einen aus, werden dessen Referenzbilder und Aussehen-Wörter gesetzt. Wie ein Charakter registriert wird, steht unter [Bilder verbessern](04-improve.md).

## Warteschlange

![Der Tab Warteschlange. Der gerade verarbeitete Eintrag und die wartenden Einträge sind aufgelistet](shot:queue)

Im Tab **{{ui:app.tabs.queue}}** sehen und verwalten Sie die Warteschlange der Generierung. Wenn Einträge warten, erscheint am Tab {{ui:app.tabs.queue}} in der Seitennavigation ein Zähler.

Oben auf dem Bildschirm gibt es Folgendes.

- Den Verarbeitungsstatus („{{ui:queue.processor.running}}“ oder „{{ui:queue.processor.paused}}“) und die Steuerschaltflächen.
- Die Aufschlüsselung der Einträge ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- Oben rechts den Fortschritt des gerade gezeichneten Eintrags.

Die Schaltflächen bewirken Folgendes.

| Schaltfläche | Funktion |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Hält die Verarbeitung der Warteschlange an oder setzt sie fort. Was gerade gezeichnet wird, wird unverändert zu Ende gezeichnet |
| **{{ui:queue.action.cancelCurrent}}** | Stoppt, was gerade gezeichnet wird |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Bricht alles Wartende ab |
| **{{ui:queue.action.prune}}** | Entfernt abgeschlossene Einträge (abgeschlossen, fehlgeschlagen, abgebrochen) aus der Liste |
| **{{ui:queue.action.clear}}** | Entfernt alle Einträge. Es erscheint ein Bestätigungsfenster |

Klicken Sie unten in der Liste auf eine Zeile, um die Detailinformationen dieses Eintrags zu öffnen (die Zeiten, die erzeugten Bilder, bei einem Fehlschlag den Grund und den Inhalt der Einstellungen).
Das × rechts in einer Zeile bricht nur diesen Eintrag ab. Fehlgeschlagene oder abgebrochene Einträge erhalten eine Schaltfläche zum Wiederholen.

## Tastenkürzel

Bei Kürzeln, die beim Tippen nicht funktionieren, verlassen Sie vor dem Drücken das Eingabefeld.

| Aktion | Taste |
|---|---|
| Generieren (ans Ende der Warteschlange anhängen) | `Ctrl+Enter` (funktioniert auch beim Tippen des Prompts) |
| Vorn in die Warteschlange einreihen und generieren | `Ctrl+Shift+Enter` |
| Abbrechen, was gerade gezeichnet wird | `Shift+X` |
| Die gesamte Warteschlange leeren (ohne Rückfrage) | `Ctrl+Shift+X` |
| Zum Prompt-Feld wechseln | `Alt+A` |
| Linkes und rechtes Bedienfeld öffnen und schließen | `T`, `G` |
| Beide Bedienfelder zusammen öffnen und schließen | `F` |
| Tabs wechseln (der Reihe nach von {{ui:app.tabs.generate}} bis {{ui:app.tabs.queue}}) | `1` bis `9` |
| Die Liste der Kürzel öffnen | `Shift+?` |

Die Kürzel sehen Sie auch unter „{{ui:app.nav.hotkeys}}“ im Menü **{{ui:app.nav.settings}}** der Seitennavigation.
