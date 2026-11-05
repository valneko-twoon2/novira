# Bilder erzeugen

Dieses Kapitel erklärt, wie Sie im Tab **{{ui:app.tabs.generate}}** Bilder erzeugen.
Wie der Bildschirm zu lesen ist, steht unter [Erste Schritte](01-start.md). Wie Sie erzeugte Bilder ansehen und ordnen, steht unter [Die Galerie und der Betrachter](03-gallery.md).

Der Ablauf ist immer derselbe.

1. Ein Modell wählen
2. Einen Prompt schreiben
3. Bei Bedarf Einstellungen wie Größe und Seed anpassen
4. Auf **{{ui:params.invoke.invoke}}** klicken

Das Bild wird nicht in dem Moment gezeichnet, in dem Sie klicken. Zuerst kommt es in die „{{ui:app.tabs.queue}}“ (die Reihe der wartenden Einträge). Wenn es an der Reihe ist, werden die Bilder nacheinander gezeichnet.

Das gewählte Modell, die Prompts und die Einstellungen bleiben beim Schließen der App erhalten und sind beim nächsten Start so da, wie sie waren.

## Einen Prompt schreiben

![Der Tab Generieren mit einem Satz im Prompt und festgelegtem Seed](shot:generate-prompt)

Der Bereich „{{ui:params.prompt.title}}“ im linken Bedienfeld hat zwei Felder.

- **{{ui:params.prompt.positive}}**: Hier steht, was gezeichnet werden soll.
- **{{ui:params.prompt.negative}}**: Hier steht, was nicht erscheinen soll, zum Beispiel `blurry, watermark`. Sie können auch mit leerem Feld generieren.

Einige Faustregeln fürs Schreiben.

- Reihen Sie Wörter oder kurze Wendungen aneinander, getrennt durch Kommas (`,`).
- Bei vielen Modellen liefert Englisch eher das erwartete Ergebnis. Gibt die Beschreibung des Modells eine Schreibweise vor, richten Sie sich danach.
- Setzen Sie die wichtigen Wörter weiter nach vorn.

Die kleinen Schaltflächen über den Feldern bewirken Folgendes. Es sind nur Symbole; halten Sie den Zeiger darüber, um den Namen zu sehen.

| Schaltfläche | Funktion |
|---|---|
| **{{ui:params.prompt.recommended}}** | Fügt die Qualitätswörter, die für die Familie des gewählten Modells weit verbreitet sind, zu „{{ui:params.prompt.positive}}“ hinzu und die zu vermeidenden Wörter ans Ende von „{{ui:params.prompt.negative}}“. Modelle, die mit Tags arbeiten (Illustrious, NoobAI, Pony, Anima und so weiter), erhalten Tags wie `masterpiece, best quality` am Anfang; Modelle, die mit Sätzen arbeiten (FLUX, Qwen-Image und so weiter), erhalten Qualitätswörter am Ende. Modelle ohne Negativ-Prompt (FLUX.1) erhalten keine Negativwörter. Bereits vorhandene Wörter werden nicht doppelt eingefügt |
| **{{ui:params.prompt.expand}}** | Bearbeitet Positiv und Negativ nebeneinander in einem großen Fenster |
| **{{ui:params.prompt.textView}}** / **{{ui:params.prompt.tagView}}** | Schaltet das Feld zwischen dem reinen Text und einer Reihe von Tags um, eines pro Wort. Klicken Sie auf einen Tag, um ein Popover zu öffnen: Sie können seine Wörter umschreiben, seine Stärke mit dem Regler ändern, sie auf 1 zurücksetzen oder den Tag entfernen. Ein Tag mit geänderter Stärke wird als `(smile:1.3)` in den Prompt geschrieben. Tippen Sie unten ein Wort in das Feld und drücken Sie Enter, um einen Tag hinzuzufügen |
| **{{ui:params.promptBook.open}}** | Öffnet eine Liste gesammelter Wörter samt Bedeutung (siehe unten) |
| **{{ui:caption.fromPrompt}}** | Betrachtet das in der Galerie gewählte Bild (oder, wenn keines gewählt ist, eine Bilddatei, die Sie auswählen) und schreibt sofort Wörter auf, die sich als Prompt verwenden lassen. Das Ergebnis erscheint im Band des Betrachters. Auf diese Schaltfläche können Sie auch ein Galeriebild oder eine Bilddatei von Ihrem Computer ziehen (erklärt unter [Bilder korrigieren und wiederverwenden](04-improve.md)) |

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

Liegt der Wert von „{{ui:params.invoke.iterations}}“ (siehe unten) bei 2 oder mehr, ergibt sich die Gesamtzahl aus Kombinationen mal Durchläufe. Zum Beispiel ergeben 2 Kombinationen bei 3 Durchläufen insgesamt 6 Bilder.
Diese Syntax funktioniert nur im positiven Feld. Im negativen Feld werden geschweifte Klammern als gewöhnliche Zeichen behandelt.

Mit der Schaltfläche **{{ui:params.prompt.dynamicPreview}}** (dem Symbol `{ }`) über dem positiven Feld prüfen Sie, welche Texte daraus entstehen. Ein Klick darauf zeigt eine Liste der Kombinationen. Das negative Feld hat dieselbe Schaltfläche, und `{a|b}` sowie Wildcards funktionieren auch im negativen Prompt. Die Kombinationen sind alle Paare aus einem positiven und einem negativen Prompt.

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

- **{{ui:params.prompt.modeCombinatorial}}** (Standard): Erzeugt für jede Kombination die bei den Durchläufen eingestellte Anzahl Bilder.
- **{{ui:params.prompt.modeRandom}}**: Erzeugt die bei den Durchläufen eingestellte Anzahl Bilder und wählt für jedes eine Kombination aus. Die Auswahl folgt dem Seed des Bildes, sodass erneutes Zeichnen mit demselben Seed denselben Prompt ergibt.

In beiden Fällen behält jedes fertige Bild den Prompt, der tatsächlich verwendet wurde.

## Seed

Ein Bild entsteht aus einer Zahl, dem „{{ui:params.seed.label}}“. Derselbe Seed mit denselben Einstellungen ergibt dasselbe Bild.

In der Zeile „{{ui:params.seed.label}}“ oben im linken Bedienfeld gibt es zwei Schaltflächen.

- **{{ui:params.seed.random}}** (der Würfel): Bei jeder Generierung wird ein neuer Seed verwendet. Sie erhalten jedes Mal ein anderes Bild. Dies ist die Voreinstellung.
- **{{ui:params.seed.fixed}}** (das Schloss): Es wird mit dem aktuellen Seed gezeichnet. Wie oft Sie auch mit denselben Einstellungen erzeugen, das Bild bleibt gleich. Das ist praktisch, wenn Sie den Unterschied sehen möchten, den ein einzelnes Wort im Prompt macht.

Ist der Seed festgelegt, sind das Zahlenfeld für den Seed und die Schaltfläche „{{ui:params.seed.shuffle}}“ gesperrt (so ändern Sie ihn nicht versehentlich).
Möchten Sie eine bestimmte Zahl verwenden, tippen Sie sie in das Zahlenfeld, während „{{ui:params.seed.random}}“ gewählt ist, und wechseln dann zu „{{ui:params.seed.fixed}}“.
Möchten Sie den Seed eines Bildes verwenden, das Ihnen gefällt, öffnen Sie es in der Galerie und klicken auf „{{ui:gallery.menu.useSeed}}“. Der Seed wird übernommen und festgelegt (siehe [Die Galerie und der Betrachter](03-gallery.md)).

Erhöhen Sie bei festem Seed die Durchläufe, erhalten das zweite und alle weiteren Bilder einen Seed, der jeweils um eins höher ist.

## Ein Modell wählen

![Die geöffnete Modellliste, gegliedert nach Familien wie FLUX, SDXL und SD1.X](shot:model-picker)

Mit der Modellkarte oben im linken Bedienfeld wählen Sie das Modell, das das Bild zeichnet.

1. Klicken Sie auf das Feld mit dem Modellnamen.
2. Wählen Sie aus der Liste. Die Liste ist nach Modellfamilien gegliedert (FLUX, SDXL, SD1.X und so weiter). Bei vielen Einträgen geben Sie einen Teil des Namens in das Suchfeld oben ein, um sie einzugrenzen.

Auch Modelle von Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow und HunyuanImage lassen sich hier wählen. Werden das Modell, der Text-Encoder und das VAE als getrennte Dateien angeboten, sucht die App den Text-Encoder und das VAE anhand des Namens unter den installierten Modellen. Installieren Sie ein Modell, dem eines davon fehlt, fragt die App sofort „{{ui:params.parts.title}}“ und zeigt Namen und Größen, sodass Sie nur die fehlenden Dateien installieren können. Schließen Sie das Fenster mit „Nicht jetzt“, merkt sich das Bedienfeld Generieren, was dem Modell fehlt, und bietet eine Schaltfläche, die diese Dateien installiert, ohne den Bildschirm zu verlassen; bei einem Download über 5 GB fragt sie nach dem Klick noch einmal. Die Starter-Modelle auf dem Bildschirm Modelle (**{{ui:models.install.tab.starter}}**) installieren sie ebenfalls. Masken, Control-Ebenen und der Hires-Fix funktionieren auch mit diesen Modellen. Referenzbilder funktionieren nur mit Modellen von SD1.X und SDXL. Was Sie unter „{{ui:params.generation.scheduler}}“ wählen, wird nicht verwendet: Jede Familie zeichnet mit ihrem eigenen Sampler und Scheduler (`euler / simple` bei Flux; nur Anima zeichnet mit dem gewählten Scheduler), und das Feld „{{ui:params.generation.scheduler}}“ zeigt das Paar, das tatsächlich läuft. Wählen Sie einen „{{ui:params.generation.sampler}}“ oder einen „{{ui:params.generation.noiseSchedule}}“, gilt diese Wahl bei Modellen jeder Familie.

- **Bearbeitungsmodelle.** FLUX Kontext und Qwen-Image-Edit verändern ein Bild, das Sie ihnen geben: Legen Sie das Bild in die Quelle (Bild zu Bild) und schreiben Sie im Prompt, was geändert werden soll. FLUX Fill zeichnet den maskierten Teil neu (nutzen Sie Inpaint oder Outpaint mit einer Maske). Diese Modelle unterstützen weder den Hires-Fix noch Entwürfe oder Control-Ebenen. Die App erkennt sie an ihrem Dateiinhalt, bei Kontext und den Qwen-Bearbeitungsmodellen am Wort `kontext` oder `edit` im Dateinamen; benennen Sie sie nicht um.
- **FLUX.2.** Die klein-Modelle laufen in wenigen Schritten (bei den destillierten nehmen Sie CFG 1); dev verwendet den CFG-Wert als Guidance. Legen Sie ein Bild in die Quelle (Bild zu Bild), bearbeitet FLUX.2 es nach dem Prompt. Masken, Control-Ebenen und der Hires-Fix sind mit FLUX.2 nicht verfügbar (Entwürfe schon).
- **Quantisierte (GGUF-)Modelle.** Eine Modell- oder Text-Encoder-Datei, die auf `.gguf` endet, wird von der Erweiterung ComfyUI-GGUF gelesen. Installieren Sie sie einmal auf dem Bildschirm Erweiterungen (https://github.com/city96/ComfyUI-GGUF) und starten Sie die Engine neu; bis dahin schlägt die Generierung fehl und sagt das auch.
- **Modelle für andere Eingaben.** Modelle, die ein Control-Video, Audio, einen Kamerapfad oder ein Pose-Video brauchen (zum Beispiel Wan Fun Control, Wan Animate, Flux Canny), lassen sich hier noch nicht ausführen. Die Generierung schlägt fehl und nennt, was das Modell braucht.
3. Das gewählte Modell erhält ein ✓, und auch das Bild der Karte (das Titelbild) ändert sich.

Unter der Liste führt die Schaltfläche **{{ui:app.tabs.short.models}}** zum Tab {{ui:app.tabs.models}} (Verwaltung Ihrer Modelle), und die Schaltfläche **{{ui:app.tabs.short.browse}}** führt zum Tab {{ui:app.tabs.browse}} (Suche im Internet). Wie Sie weitere Modelle hinzufügen, steht unter [Modelle bereitstellen](08-models.md).

Sind für das Modell empfohlene Einstellungen (Schritte, CFG, Scheduler, Größe) hinterlegt, werden sie bei der Wahl automatisch eingetragen.
Wechseln Sie zu einem Modell einer anderen Familie, werden LoRAs und Ähnliches, die nicht zum neuen Modell passen, entfernt (Sie erfahren, wie viele es waren).

Mit der Schaltfläche **{{ui:params.profile.title}}** unter dem Modellfeld sehen Sie die empfohlenen Werte für dieses Modell als Liste. Weichen Ihre aktuellen Einstellungen von den empfohlenen ab, wird die Schaltfläche auffälliger gefärbt, und **{{ui:params.profile.apply}}** setzt alles auf die empfohlenen Werte. Die Schritte werden gegen einen Bereich von etwas unter bis etwas über der empfohlenen Zahl geprüft. Anima-Modelle zerfallen bei zu wenigen Schritten leicht (das Bild kann einfarbig flach werden), deshalb liegt ihre Untergrenze höher (24 oder mehr, wenn 30 empfohlen ist).

> Ist kein Modell installiert, steht im Feld „{{ui:params.model.noModels}}“, und Sie können nicht generieren. Schließen Sie zuerst [Modelle bereitstellen](08-models.md) ab.

## Weitere Einstellungen

Unter dem Prompt gibt es Abschnitte, die Einstellungen gruppieren. Per Klick lassen sie sich öffnen und schließen.

| Abschnitt | Inhalt |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (direkt unter dem Prompt) | Bilder, mit denen Stimmung oder Figuren eines Bildes gesteuert werden (siehe unten) |
| **{{ui:params.i2i.title}}** | Das Bild, über das beim Neuzeichnen nach einem Bild gezeichnet wird, und die {{ui:params.image.strength}} (siehe unten) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, Breite und Höhe. Dazu die Schaltflächen „{{ui:params.image.swap}}“, „{{ui:params.image.lock}}“ und „{{ui:params.image.optimal}}“ |
| **{{ui:params.generation.title}}** | LoRA (ein kleines Zusatzmodell, das einen Zeichenstil oder eine Figur hinzufügt), {{ui:params.generation.scheduler}}, {{ui:params.generation.sampler}}, {{ui:params.generation.noiseSchedule}} (gewählt nach den eigenen Namen von ComfyUI; „{{ui:params.generation.engineAuto}}“ folgt dem Scheduler oder dem des Modells und zeigt den Namen, für den es steht, als „Auto (Name)“; FLUX.2 nimmt nur den Sampler), {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Ein zweiter Durchgang, der das gezeichnete Bild vergrößert und erneut zeichnet (siehe unten) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (Bilder, die gekachelt keine Naht zeigen; Modelle von SD1.X und SDXL sowie die Erweiterung ComfyUI-seamless-tiling, installiert über den Bildschirm Erweiterungen) und mehr |

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
- **Die Zahl neben ×** (Durchläufe): Wie viele Bilder in einem Vorgang erzeugt werden. Bei „3“ entstehen drei Bilder.
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
Beim Zeichnen erscheint über der Galerie rechts ein Band „{{ui:gallery.generating.title}}“, in dem Sie das entstehende Bild, die Schrittzahl und den Fortschritt sehen. Auch die dünne Linie am oberen Rand der Mitte zeigt den Fortschritt. Dasselbe Bild erscheint zudem als kleine Zelle am Anfang der Galerie. Klicken Sie auf die Zelle, um das entstehende Bild groß im Betrachter in der Mitte zu sehen. Wenn das Zeichnen endet, tritt das fertige Bild an ihre Stelle.

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
- {{ui:params.hires.title}}, die Einstellungen des Tabs **{{ui:app.tabs.upscaling}}**, die Inpaint-Einstellungen (Maskenunschärfe, Auffüllen und so weiter) und die Art, wie dynamische Prompts erzeugt werden

Seed, Durchläufe und das zu vergrößernde Bild sind nicht enthalten.

So verwenden Sie sie.

- Klicken Sie auf einen Eintrag der Liste, werden seine Einstellungen übernommen (**{{ui:presets.apply}}**).
- Mit **{{ui:presets.saveNew}}** unten in der Liste (oder der Speichern-Schaltfläche neben der Karte) speichern Sie die aktuellen Einstellungen unter einem Namen.
- Über das „…“ rechts neben einem Eintrag können Sie **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** und **{{ui:presets.delete}}** wählen.
- Die Liste gliedert sich in „{{ui:presets.group.mine}}“ und „{{ui:presets.group.builtin}}“. Die mitgelieferten Vorgaben sind Beispiele, die zur App gehören.

### Vorgaben zufällig ausführen

Sie können einen Stapel erzeugen und dabei zufällig zwischen mehreren Vorgaben wechseln. Das eignet sich, wenn Sie viele Bilder hintereinander möchten, deren Prompts und Größen sich stark unterscheiden.

1. Klicken Sie auf die Schaltfläche mit den gekreuzten Pfeilen ({{ui:presets.run.title}}) rechts neben der Karte „{{ui:presets.label}}“.
2. Haken Sie die gewünschten Vorgaben an.
3. Geben Sie die {{ui:presets.run.count}} in das Feld „×“ ein und klicken Sie auf **{{ui:presets.run.queue}}**.

Für jedes Bild wird eine der angehakten Vorgaben mit gleicher Wahrscheinlichkeit gewählt, und auch der Seed ist zufällig. Einstellungen, die eine Vorgabe nicht enthält, kommen aus dem aktuellen linken Bedienfeld. Die Einstellungen des linken Bedienfelds ändern sich nicht.

- Verwenden die Vorgaben verschiedene Modelle, dauert das Laden des Modells bei jedem Wechsel.
- Enthält ein Prompt dynamische Prompts, erhält jedes Bild einen nach seinem Seed gewählten Prompt (nicht alle Kombinationen).
- Lässt sich eine der angehakten Vorgaben nicht generieren, werden ihr Name und der Grund angezeigt, und nichts kann in die Warteschlange gestellt werden.
- Die Haken und die Zahl bleiben für das nächste Öffnen erhalten.

## Prompt-Vorgaben

![Die Prompt-Liste. Wörter und Bedeutungen sind nach Kategorien geordnet, mit den Schaltflächen Positiv und Negativ zum Hinzufügen](shot:prompt-book)

Damit Sie Prompts auch aufbauen können, wenn Sie englische Wörter nicht im Kopf haben, gibt es die **{{ui:params.promptBook.open}}**. Öffnen Sie sie mit der Schaltfläche über dem positiven und dem negativen Feld.

- Wählen Sie links eine Kategorie (Personen, Beziehungen und Interaktionen, Posen, Bewegungen, Ausdrücke, Blick, Bildaufbau, Frisuren, Kleidung und so weiter), werden nur die Wörter dieser Kategorie aufgelistet. Das Suchfeld oben durchsucht Wörter, Bedeutungen, Kategorien und Notizen gleichzeitig.
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

> Ein Referenzbild dient dazu, „die Stimmung zu lenken“. Wenn Sie „auf Grundlage dieses Bildes neu zeichnen“ möchten, nutzen Sie Bild zu Bild, das als Nächstes beschrieben wird.

## Bild zu Bild (nach einem Bild neu zeichnen)

Legen Sie ein Bild in den Abschnitt **{{ui:params.i2i.title}}**, wird es als Ausgangspunkt übermalt. Nutzen Sie das, um Anordnung und Farben eines Bildes zu behalten und es dem Prompt anzupassen.

1. Öffnen Sie den Abschnitt und legen Sie ein Galeriebild (oder eine Bilddatei von Ihrem Computer) auf dem Rahmen ab. Auch **{{ui:params.refImage.openI2i}}** im kleinen Fenster eines Referenzbildes legt eines dort ab.
2. Breite und Höhe wechseln zu der Größe, die das Modell gut zeichnet und die der Form des Bildes am nächsten kommt. Sie können sie danach von Hand ändern.
3. Die **{{ui:params.image.strength}}** bestimmt, wie viel neu gezeichnet wird. Nahe 0 bleibt das Bild, wie es ist; nahe 1 wird es ignoriert. Um 0,5 ist ein guter Anfang.

Ist der {{ui:params.hires.title}} eingeschaltet, wird das über Ihr Bild gezeichnete Bild vergrößert und erneut gezeichnet. Um das Bild zu entfernen, klicken Sie auf das × oben rechts an seinem Rahmen. Um nur einen bemalten Teil neu zu zeichnen, nutzen Sie [Auf der Leinwand weiter zeichnen](05-canvas.md).

### Charaktere

Im Feld „{{ui:character.row.label}}“ über den Referenzbildern rufen Sie registrierte Charaktere auf (beliebig viele Bilder derselben Figur samt Wörtern, die ihr Aussehen beschreiben).
Wählen Sie einen aus, werden dessen Referenzbilder und Aussehen-Wörter gesetzt. Wie ein Charakter registriert wird, steht unter [Bilder korrigieren und wiederverwenden](04-improve.md).

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
| Tabs wechseln (der Reihe nach in der Seitennavigation, von {{ui:app.tabs.generate}} bis {{ui:app.nav.extensions}}) | `1` bis `9` |
| Die Liste der Kürzel öffnen | `Shift+?` |

Die Kürzel sehen Sie auch unter „{{ui:app.nav.hotkeys}}“ im Menü **{{ui:app.nav.settings}}** der Seitennavigation.
