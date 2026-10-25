# Bilder verbessern und wiederverwenden

Dieses Kapitel fasst die Funktionen zusammen, die Sie brauchen, wenn Sie denken: „Dieses fertige Bild möchte ich noch ein wenig verbessern“, „Ich möchte ein paar weitere in derselben Stimmung“ oder „Diesen Charakter möchte ich auch in einer anderen Szene verwenden“.

Die meisten Funktionen rufen Sie über eine Schaltfläche der Werkzeugleiste über dem Betrachter (der Ansicht, die ein Bild groß zeigt) oder über das Menü auf, das Sie mit einem Rechtsklick auf ein Bild in der Galerie erhalten. Setzen Sie die Maus auf eine Schaltfläche der Werkzeugleiste, um ihren Namen zu sehen. Die Grundlagen zu Betrachter und Galerie finden Sie unter [Galerie](03-gallery.md).

## Was wofür verwendet wird

| Ziel | Verwendung | Was zusätzlich nötig ist |
|---|---|---|
| Mit denselben Einstellungen ein paar weitere erzeugen oder eines leicht verändert neu machen | **{{ui:gallery.derive.menu}}** | Das für das Originalbild verwendete Modell ist installiert |
| Den Hintergrund entfernen und nur die Person oder das Objekt behalten | **{{ui:cutout.menu}}** | Die Erweiterung ComfyUI-RMBG |
| Transparente Ränder abschneiden | **{{ui:gallery.menu.trim}}** (nur per Rechtsklick) | Nichts |
| Einen Teil eines Bildes auswählen und ausschneiden, löschen oder neu zeichnen | **{{ui:gallery.menu.segment}}** | Eine Erweiterung wie ComfyUI-segment-anything-2 |
| Kleine, verzerrte Gesichter korrigieren | **{{ui:facefix.menu}}** | Die Erweiterungen ComfyUI-Impact-Pack und ComfyUI-Impact-Subpack |
| Aus einem Bild einen Prompt schreiben lassen | **{{ui:caption.menu}}** | Die Erweiterung ComfyUI-Florence2 |
| Einen Charakter registrieren und in anderen Bildern verwenden | **{{ui:character.menu}}** | Die Erweiterung für Referenzbilder (IP-Adapter) |
| Bilder mit geänderten Einstellungen in einer Tabelle nebeneinanderstellen | **{{ui:xyplot.menu}}** | Nichts |
| Aus halb gezeichneten Kandidaten auswählen | Der Tab **{{ui:app.views.drafts}}** | Nichts |
| Dieselbe Verarbeitung auf viele Bilder anwenden | **{{ui:gallery.menu.batch}}** (mehrere wählen und rechtsklicken) | Hängt von der Verarbeitung ab |

## Wenn eine Erweiterung nötig ist

Hintergrund entfernen, Bereiche auswählen, Gesichter korrigieren und Ähnliches funktionieren, indem der Bild-Engine ComfyUI „Erweiterungen“ hinzugefügt werden. Ist eine Erweiterung nicht installiert, steht im Dialog „… benötigt die Erweiterung XXX.“, und es werden Schaltflächen zum Installieren angezeigt.

1. Klicken Sie auf **{{ui:cutout.install}}**. Das Nötige wird automatisch heruntergeladen und installiert.
2. Nach der Installation wechselt die Schaltfläche zu **{{ui:cutout.restart}}**. Klicken Sie darauf, und ComfyUI wird neu gestartet.
3. Nach dem Neustart lässt sich derselbe Dialog unverändert verwenden.

Bei der ersten Verwendung beginnt auch der Download der Modelle, die die Erweiterung nutzt, daher dauert es eine Weile. Sie müssen mit dem Internet verbunden sein.

> Manche Erweiterungen brauchen für die Installation Zeit und Speicherplatz. ComfyUI-Impact-Pack benötigt für die Installation Git. Auf einem Computer ohne Git schlägt die Installation fehl. Wenn eine Meldung erscheint, lesen Sie sie, bevor Sie handeln.

Erweiterungen können Sie auch über den Tab „{{ui:workflows.panel.packs}}“ unter [Workflows](06-upscaling-workflows.md) installieren. Wenn es nicht klappt, lesen Sie auch [Hilfe bei Problemen](10-troubleshooting.md).

## Mit denselben Einstellungen ein weiteres erzeugen (Ableiten)

![Das geöffnete Menü „Weitere ableiten“ in der Werkzeugleiste des Betrachters](shot:derive-menu)

Öffnen Sie ein Bild, das Ihnen gefällt, im Betrachter und klicken Sie in der Werkzeugleiste auf die Schaltfläche **{{ui:gallery.derive.menu}}** (das Symbol mit der Verzweigung). In der Galerie klicken Sie mit der rechten Maustaste auf das Bild und wählen **{{ui:gallery.derive.menu}}**.

Es stehen die folgenden drei Arten zur Auswahl.

| Eintrag | Was er bewirkt |
|---|---|
| „Gleiche Einstellungen, neuer Seed“ (1 oder 4 Bilder) | Zeichnet mit geändertem Seed, aber unverändertem Prompt, Modell, Größe usw. Die Komposition ändert sich, die Stimmung bleibt gleich. |
| „Mit kleinen Änderungen wiederholen“ (1 oder 4 Bilder) | Nimmt das Originalbild als Grundlage und zeichnet es schwach neu (mit der Stärke 0,45). Komposition und Farben bleiben erhalten, nur die Details ändern sich. |
| **{{ui:gallery.derive.custom}}** | Sie legen selbst fest, wie stark verändert wird (siehe nächster Abschnitt). |

Nach der Wahl kommen die neuen Bilder in die Warteschlange und werden im selben Board wie das Original aufgelistet. **Die Einstellungen im Tab Generieren werden nicht überschrieben.** Auch der Prompt, den Sie gerade eingeben, bleibt unverändert.

> Wenn Sie die Einstellungen zuerst wieder auf den Bildschirm holen und selbst anpassen möchten, bevor Sie ein Bild erzeugen, verwenden Sie **{{ui:gallery.menu.remix}}**. Ableiten ist dafür gedacht, „mit einem Klick und mit den ursprünglichen Einstellungen“ ein neues Bild zu erzeugen.

### Die Stärke der Änderung wählen und neu erzeugen

![Der Dialog zur Festlegung der Stärke der Änderung](shot:derive)

Wenn Sie **{{ui:gallery.derive.custom}}** wählen, öffnet sich ein Dialog.

1. Bewegen Sie den Regler **{{ui:gallery.derive.dialog.strength}}**. Je weiter links ({{ui:gallery.derive.dialog.close}}), desto mehr von Komposition und Farben des Originals bleibt erhalten; je weiter rechts ({{ui:gallery.derive.dialog.free}}), desto eher entsteht ein anderes Bild.
2. Wählen Sie **{{ui:gallery.derive.dialog.count}}** aus 1, 2, 4 und 8.
3. Klicken Sie auf **{{ui:gallery.derive.dialog.create}}**.

Als Richtwert: Bei etwa 0,25 entsteht ein Bild, das fast gleich dem Original ist, bei etwa 0,75 ein Bild, in dem der Charakter erhalten bleibt, die Komposition sich aber stark ändert. Es ist von Bild zu Bild verschieden, probieren Sie also einige Werte aus. Der Wert des Reglers gilt nur für diesen einen Durchgang.

### Was übernommen wird und was nicht

- Übernommen: Die beim Erzeugen des Bildes verwendeten Einstellungen, etwa Prompt, Negativ-Prompt, Modell, LoRA, Größe, Schritte, CFG-Skala und Scheduler.
- Referenzbilder und Control-Ebenen werden zusammen mit dem Bild gespeichert und daher unverändert verwendet. Wurde ein solches Bild jedoch aus der Galerie gelöscht, lässt sich nichts erzeugen. Der Grund erscheint in einer Benachrichtigung.
- Nicht übernommen: Masken, regionale Steuerung und Entwurfseinstellungen. Wurde ein Bild vor der Einführung dieser Funktion mit Referenzbildern o. Ä. erzeugt, sind diese nicht gespeichert und können daher nicht übernommen werden. Wenn etwas nicht übernommen werden konnte, werden Sie per Benachrichtigung informiert.

In den folgenden Fällen lässt sich die Schaltfläche nicht anklicken, oder es erscheint eine Benachrichtigung und es wird nichts erzeugt.

- Wenn das Bild nicht aus einem Text erzeugt wurde (dazu zählen auch Bild-zu-Bild, Inpainting und Outpainting). Vergrößerte Bilder, Videos, Audio und Ähnliches sind ausgenommen.
- Wenn das für das Originalbild verwendete Modell nicht installiert ist. Es erscheint eine Benachrichtigung mit dem Namen des Modells.

## Hintergrund entfernen

![Der Dialog zum Entfernen des Hintergrunds](shot:cutout)

Erkennt automatisch, was im Bild zu sehen ist, und erzeugt ein Bild ohne Hintergrund. Sie müssen nichts per Klick markieren.

1. Öffnen Sie das Bild im Betrachter und klicken Sie auf **{{ui:cutout.menu}}** mit dem Scheren-Symbol (es steht auch im Rechtsklickmenü).
2. Ändern Sie bei Bedarf die Einstellungen.
   - **{{ui:cutout.model}}**: Meist ist die Voreinstellung in Ordnung.
   - **{{ui:cutout.sensitivity}}**: Je niedriger der Wert, desto mehr von den Bereichen mit unklarer Grenze bleibt erhalten.
   - **{{ui:cutout.edge}}**: Ein positiver Wert erweitert die Kontur, ein negativer Wert schneidet sie ab.
   - **{{ui:cutout.background}}**: Wählen Sie **{{ui:cutout.background.alpha}}** oder **{{ui:cutout.background.white}}**.
3. Klicken Sie auf **{{ui:cutout.run}}**.

Das fertige Bild wird als neues Bild im selben Board wie das Original gespeichert. **Das Originalbild bleibt erhalten.** Wenn Sie mit dem Ergebnis nicht zufrieden sind, ändern Sie die Einstellungen und klicken Sie auf **{{ui:cutout.again}}**. Mit **{{ui:cutout.open}}** zeigen Sie es im Betrachter an.

Ein weißer Hintergrund eignet sich gut, wenn Sie das Bild später als Referenzbild für einen [Charakter](#charakter-registrieren-und-verwenden) nutzen möchten. Die Hintergrundfarbe überträgt sich dann seltener auf neu erzeugte Bilder.

## Transparente Ränder abschneiden

Ein Bild mit transparentem Hintergrund behält um das Bild herum transparente Ränder. Mit **{{ui:gallery.menu.trim}}** speichern Sie ein neues transparentes Bild, das genau auf den Teil mit Inhalt zugeschnitten ist. Das ist praktisch, wenn Sie es als Sticker oder Material verwenden.

- Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie den Eintrag. Direkt nach dem Entfernen eines Hintergrunds geht dasselbe auch über **{{ui:cutout.trim}}** im Dialog (er erscheint nur, wenn Sie den Hintergrund transparent gemacht haben).
- Ein Schatten, der so schwach ist, dass er kaum sichtbar ist, wird als Rand abgeschnitten.
- Bei einem Bild, dessen transparenter Bereich nicht bis an den Bildrand reicht, erscheint „Es gibt keinen Rand zuzuschneiden.“ und nichts wird gespeichert. Auch ein vollständig transparentes Bild lässt sich nicht zuschneiden.

## Einen Bereich auswählen und korrigieren

![Der Dialog, in dem per Klick festgelegt wird, was im Bild ausgewählt wird](shot:segment)

Sie wählen das gemeinte Objekt im Bild per Klick aus. Den ausgewählten Teil können Sie dann ausschneiden, löschen oder neu zeichnen.

1. Öffnen Sie das Bild im Betrachter und klicken Sie auf **{{ui:gallery.menu.segment}}**.
2. Nur beim ersten Mal wird die Erweiterung ComfyUI-segment-anything-2 benötigt. Installieren Sie sie nach den Hinweisen auf dem Bildschirm ([Wenn eine Erweiterung nötig ist](#wenn-eine-erweiterung-nötig-ist)).
3. Klicken Sie auf das Objekt, das Sie auswählen möchten. Fehlt etwas, klicken Sie an einer anderen Stelle, um es hinzuzufügen. Ragt die Auswahl über das Ziel hinaus, schalten Sie die Schaltfläche auf **{{ui:segment.mode.exclude}}** um und klicken dort, oder klicken Sie mit der rechten Maustaste (oder bei gedrückter Taste `Shift`). Ein erneuter Klick auf einen gesetzten Punkt hebt diesen Punkt wieder auf. Mit **{{ui:segment.clear}}** fangen Sie von vorn an.
4. Klicken Sie auf **{{ui:segment.run}}**. Der ausgewählte Bereich wird blau angezeigt.
5. Wenn der blaue Bereich stimmt, wählen Sie die nächste Aktion. Möchten Sie stattdessen den „Rest“ auswählen, aktivieren Sie **{{ui:segment.invert}}**.

| Schaltfläche | Was sie bewirkt | Was nötig ist |
|---|---|---|
| **{{ui:segment.cutout}}** | Schneidet nur den ausgewählten Teil aus und speichert ihn als transparentes Bild. | Nichts |
| **{{ui:segment.mosaic}}** | Verwandelt den ausgewählten Teil in grobe Blöcke (Mosaik) und speichert das Bild. Die Blockgröße stellen Sie mit der Zahl daneben ein. | Nichts |
| **{{ui:segment.erase}}** | Entfernt den ausgewählten Teil und gleicht die Stelle an das umgebende Bild an. | Die Erweiterung comfyui-inpaint-nodes. Mit dem Modell LaMa (ca. 200 MB) wirkt das Entfernen natürlicher. Ohne es ist auch ein einfaches Entfernen möglich. |
| **{{ui:segment.redraw.title}}** | Zeichnet nur den ausgewählten Teil nach einer Textanweisung neu. Die übrigen Teile ändern sich nicht. | Ein Bildmodell |
| **{{ui:segment.toCanvas}}** | Sendet das Bild und die Auswahl an die [Leinwand](05-canvas.md). Die Auswahl wird zur Inpainting-Maske. | Nichts |

Beim Neuzeichnen schreiben Sie als Text, **was gezeichnet werden soll** (zum Beispiel: blue hair, red scarf). Das Ergebnis passt eher zu Ihren Erwartungen, wenn Sie so formulieren, wie das Modell es gut versteht (bei einem Anime-Modell etwa mit englischen Tags). Je niedriger Sie **{{ui:segment.redraw.strength}}** einstellen, desto mehr von den ursprünglichen Formen und Farben bleibt erhalten.

Das Ergebnis wird als neues Bild im selben Board wie das Original gespeichert. Das Originalbild ändert sich nicht.

## Gesichter korrigieren

![Der Dialog zum Korrigieren von Gesichtern](shot:facefix)

Bei Bildern mit kleinen, weit entfernten Figuren werden die Gesichter oft verzerrt. **{{ui:facefix.menu}}** findet die Gesichter im Bild automatisch, zeichnet nur die Gesichter in hoher Auflösung neu und setzt sie wieder in das Originalbild ein. Außer den Gesichtern ändert sich nichts.

1. Öffnen Sie das Bild im Betrachter und klicken Sie auf **{{ui:facefix.menu}}** (es steht auch im Rechtsklickmenü).
2. Nur beim ersten Mal werden die Erweiterungen ComfyUI-Impact-Pack und ComfyUI-Impact-Subpack benötigt. Installieren Sie sie mit **{{ui:facefix.install}}** und klicken Sie auf **{{ui:facefix.restart}}**. Das Modell zum Finden von Gesichtern stellt das Subpack selbst bereit.
3. Prüfen Sie die Einstellungen.
   - **{{ui:facefix.model}}**: Das für das Originalbild verwendete Modell ist gewählt.
   - **{{ui:facefix.prompt}}**: Der Prompt des Originalbilds ist eingetragen. Wenn Sie Merkmale des Gesichts ergänzen, wirkt es besser.
   - **{{ui:facefix.strength}}**: Je niedriger, desto näher am ursprünglichen Gesicht; je höher, desto stärker wird neu gezeichnet.
   - **{{ui:facefix.sensitivity}}**: Ein höherer Wert erfasst nur eindeutige Gesichter, ein niedrigerer Wert auch kleine Gesichter und Profile. Dann werden aber auch eher Dinge erfasst, die keine Gesichter sind.
4. Klicken Sie auf **{{ui:facefix.run}}**.

Das Ergebnis wird im selben Board wie das Original gespeichert. Mit **{{ui:facefix.open}}** öffnen Sie es im Betrachter zum Vergleich mit dem Original. Wenn es Ihnen nicht gefällt, ändern Sie die Einstellungen und klicken Sie auf **{{ui:facefix.again}}**.

> Ein mit einer LoRA erzeugtes Bild wird ohne die LoRA neu gezeichnet. Deshalb kann nur das Gesicht stilistisch leicht abweichend aussehen.

> Wenn „Das Gesichtserkennungsmodell (YOLO) wurde nicht gefunden.“ erscheint, starten Sie ComfyUI neu oder installieren Sie die Erweiterungen erneut.

## Aus einem Bild einen Prompt erstellen

![Der Dialog, nachdem er Tags für ein Bild geschrieben hat](shot:caption)

Die Funktion betrachtet ein Bild und erstellt einen Prompt (Tags oder einen Satz), mit dem sich das Bild zeichnen lässt. Nutzen Sie es, wenn Sie Bilder erzeugen möchten, die einem Bild ähneln, das Ihnen gefällt, oder wenn Sie nicht sicher sind, wie man einen Prompt schreibt.

1. Wählen Sie die Schaltfläche **{{ui:caption.menu}}** im Betrachter oder **{{ui:caption.menu}}** im Rechtsklickmenü des Bildes. Sie können es auch über die Schaltfläche **{{ui:caption.fromPrompt}}** über dem Prompt-Feld im Tab Generieren öffnen. Auf diese Schaltfläche können Sie ein Bild aus der Galerie oder eine Bilddatei von Ihrem Computer ziehen.
2. Wählen Sie unter **{{ui:caption.style}}** entweder **{{ui:caption.style.tags}}** oder **{{ui:caption.style.sentence}}**.
3. Klicken Sie auf **{{ui:caption.run}}**.
4. Die Wörter lassen sich direkt dort bearbeiten. Klicken Sie dann auf **{{ui:caption.replace}}**, **{{ui:caption.append}}** oder **{{ui:caption.copy}}**.

Ersetzen und Hinzufügen wirken auf „{{ui:params.prompt.positive}}“ im Tab Generieren. Diese Funktion fügt der Galerie kein Bild hinzu.

> Diese Funktion benötigt die Erweiterung ComfyUI-Florence2. Ist sie nicht installiert, können Sie sie über den Dialog installieren (siehe „Wenn eine Erweiterung nötig ist“ in diesem Kapitel). Bei der ersten Verwendung beginnt der Download des Modells zum Beschreiben von Bildern (Florence-2 PromptGen).

## Charakter registrieren und verwenden

![Der Dialog zum Registrieren als Charakter](shot:character)

Wenn Sie ein Bild eines Charakters registrieren, der Ihnen gefällt, können Sie Bilder in anderen Szenen zeichnen, die dem gleichen Charakter nahekommen. Registriert werden die folgenden drei Dinge.

- Referenzbilder (Bilder desselben Charakters, beliebig viele)
- Aussehensbeschreibung (Haar- und Augenfarbe, Kleidung usw.; sie wird an den Anfang des Prompts gesetzt)
- Die Stärke der Ähnlichkeit

### Registrieren

1. Wählen Sie in der Galerie das Bild, das Sie registrieren möchten. Für mehrere Bilder klicken Sie bei gedrückter Taste `Ctrl`.
2. Wählen Sie die Schaltfläche **{{ui:character.menu}}** im Betrachter oder **{{ui:character.menu}}** im Rechtsklickmenü. Wenn Sie im Tab Generieren das Feld **{{ui:character.row.choose}}** öffnen, steht ganz unten in der Liste **{{ui:character.row.register}}**, und Sie können es auch von dort öffnen.
3. Geben Sie **{{ui:character.name}}** und **{{ui:character.tags}}** ein. Schreiben Sie die Merkmale auf, die sich nicht ändern sollen (braune Haare, eine weiße Bluse, ein blauer Rock usw.).
4. Legen Sie **{{ui:character.weight}}** fest. Je höher Sie den Wert setzen, desto ähnlicher wird es den Referenzbildern, aber desto weniger Freiheit haben Sie bei Szene und Komposition.
5. Klicken Sie auf **{{ui:character.save}}**.

Mit **{{ui:character.addSelected}}** können Sie später in der Galerie gewählte Bilder zu den Referenzbildern hinzufügen. **{{ui:character.removePicture}}** ist das ✕ oben rechts an einem Bild.

Wenn Sie **{{ui:character.whiteBg}}** aktivieren, wird ein Bild erzeugt, in dem der Hintergrund des registrierten Bildes durch Weiß ersetzt ist, und dieses wird als Referenzbild verwendet. So verhindern Sie, dass sich die Hintergrundfarbe auf die erzeugten Bilder überträgt. Das Originalbild bleibt erhalten, und das Bild mit weißem Hintergrund wird als neues gespeichert. Ist die zum Entfernen des Hintergrunds verwendete Erweiterung ComfyUI-RMBG nicht installiert, lässt sich dieser Schalter nicht verwenden, und das Originalbild wird unverändert genutzt.

### Verwenden

1. Öffnen Sie im linken Bedienfeld des Tabs **{{ui:app.tabs.generate}}** (oder des Tabs [Leinwand](05-canvas.md)) **{{ui:character.row.choose}}** und wählen Sie den gewünschten Charakter.
2. Die Referenzbilder des Charakters kommen in das Feld „{{ui:params.refImage.sectionLabel}}“, und die Aussehensbeschreibung wird an den Anfang des Prompts gesetzt.
3. Erzeugen Sie wie gewohnt.

Bei der Verwendung kann die App einiges automatisch anpassen. Sie werden per Benachrichtigung informiert.

- Bei Referenzbildern brennen Bilder bei einer hohen CFG-Skala leichter aus. Ist die CFG-Skala höher als 5, wird sie daher auf 4,5 gesenkt.
- Es sind insgesamt höchstens 8 Referenzbilder möglich. Übersteigt die Summe mit anderen Referenzbildern 8, werden die Bilder vom ersten an verwendet.
- Bei mehreren Referenzbildern wird die Stärke je Bild automatisch gesenkt, damit sie zusammen nicht zu stark werden.
- Aus der Galerie gelöschte Bilder können nicht verwendet werden. Sind alle gelöscht, lässt sich der Charakter nicht verwenden.

Um einen registrierten Charakter zu bearbeiten oder zu löschen, verwenden Sie die „…“-Schaltfläche an einem Eintrag der Liste.

> Das ist eine Funktion, die sich demselben Charakter „annähert“, sie liefert also nicht genau dasselbe Gesicht. Frisur, Farbe, Kleidung usw. bleiben meist erhalten, aber die Gesichtszüge ändern sich ein wenig. Hilfreich ist es, die Merkmale, die erhalten bleiben sollen, in die Aussehensbeschreibung zu schreiben.

> Für Referenzbilder benötigen Sie die Erweiterung ComfyUI_IPAdapter_plus und ein Modell für Referenzbilder. Sind sie nicht installiert, können Sie sie über das Feld für Referenzbilder im Tab Generieren installieren. Zu den Modellen siehe das Kapitel [Modelle](08-models.md).

## Einstellungen mit einem Vergleichsraster vergleichen

![Der Dialog des Vergleichsrasters](shot:xyplot)

Wie verändert sich ein Bild, wenn Sie die CFG-Skala oder die Anzahl der Schritte ändern? Diese Funktion stellt das in einer einzigen Tabelle zum Vergleichen dar.

1. Legen Sie im Tab Generieren wie gewohnt Prompt und Modell fest.
2. Klicken Sie auf das „▼“ rechts neben der Schaltfläche **{{ui:params.invoke.invoke}}** und wählen Sie **{{ui:xyplot.menu}}**.
3. Wählen Sie mit **{{ui:xyplot.x}}** und **{{ui:xyplot.y}}** die Einstellungen, die geändert werden sollen. Es geht auch mit nur einer von beiden.
4. Geben Sie die Werte ein. Zahlen werden durch Kommas getrennt aufgelistet (zum Beispiel: 3, 5, 7).
5. Klicken Sie auf **{{ui:xyplot.run}}**.

Unten im Dialog erscheint die Anzahl der zu erzeugenden Bilder, etwa „3 Spalten × 2 Zeilen = 6 Bilder werden erstellt.“

Die folgenden Einstellungen lassen sich ändern.

| Einstellung | Eingabe |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Zahlen (1 bis 30) |
| {{ui:xyplot.axis.steps}} | Ganze Zahlen (1 bis 150) |
| {{ui:xyplot.axis.seed}} | Ganze Zahlen |
| {{ui:xyplot.axis.strength}} | Zahlen (0,05 bis 1). Wirkt nur beim Erzeugen aus einem Bild (Bild-zu-Bild). |
| {{ui:xyplot.axis.scheduler}} | Aus einer Liste wählen |
| {{ui:xyplot.axis.model}} | Modelle derselben Familie aus einer Liste wählen |
| {{ui:xyplot.axis.prompt}} | Eines pro Zeile schreiben. Sie werden dem Prompt hinzugefügt |

Es gelten folgende Regeln.

- Für eine Einstellung können Sie höchstens 8 Werte eingeben. Die Tabelle kann insgesamt höchstens 36 Bilder enthalten.
- Für horizontal und vertikal lässt sich nicht dieselbe Einstellung wählen.
- Alle Bilder werden mit **demselben Seed** gezeichnet (außer wenn Sie eine Einstellung wählen, die den Seed ändert). Der einzige Unterschied ist die geänderte Einstellung.
- Die Einstellungen werden aus dem Formular des Tabs Generieren zu diesem Zeitpunkt übernommen. Das Formular wird nicht überschrieben.
- Ein Bild, das nicht erzeugt werden konnte, erscheint in der Tabelle als ×. Die Tabelle wird trotzdem mit den übrigen Bildern erstellt.

Die fertige Tabelle wird als ein Bild in der Galerie gespeichert. Mit **{{ui:xyplot.open}}** zeigen Sie sie im Betrachter an. Auch die einzelnen Bilder, aus denen die Tabelle entstanden ist, bleiben in der Galerie.

> Je mehr Bilder, desto mehr Zeit dauert es. Bei 36 Bildern sind 36 Generierungen nötig. Es empfiehlt sich, zunächst 2 oder 3 Werte auszuprobieren.

## Aus Entwürfen auswählen

![Der Tab Entwürfe mit aufgelisteten halb gezeichneten Kandidaten](shot:drafts)

Ein Bild verändert sich stark mit dem Seed. Entwürfe sind eine Funktion, bei der viele Seeds nur „ein Stück weit“ gezeichnet werden und anschließend nur die Kompositionen, die Ihnen gefallen, bis zum Ende gezeichnet werden. Das spart Zeit.

Öffnen Sie in der Mitte des Tabs **{{ui:app.tabs.generate}}** den Tab **{{ui:app.views.drafts}}**.

1. Wählen Sie **{{ui:drafts.model}}**. Anfangs ist das Modell des Tabs Generieren gewählt.
2. Legen Sie **{{ui:drafts.count}}** fest (1 bis 24 Bilder; anfangs 8).
3. Legen Sie **{{ui:drafts.position}}** fest (25 bis 60 %; anfangs 35 %). Je kleiner der Wert, desto schneller geht es, aber desto gröber sind die Bilder.
4. Klicken Sie auf **{{ui:drafts.start}}**.

Die Entwurfsbilder werden in der Reihenfolge aufgelistet, in der sie fertig werden. Prompt und weitere Einstellungen stammen aus dem Tab Generieren.

Ein Klick auf ein Bild wählt es aus (ein erneuter Klick hebt die Auswahl auf). Ein Doppelklick zeigt es groß im Betrachter. Die Stern-Schaltfläche (**{{ui:drafts.keep}}**) und das ✕ (**{{ui:drafts.reject}}**) sind Markierungen für Ihren eigenen Gebrauch. Klicken Sie unten rechts auf die Schaltfläche „N Bilder {{ui:manual.drafts.finish}}“ (N ist die Anzahl der gewählten Bilder), dann werden die gewählten Bilder bis zum Ende gezeichnet. Um neu zu wählen, klicken Sie auf **{{ui:drafts.clearSelection}}**.

Bis zum Ende gezeichnete Bilder kommen wie bei einer normalen Generierung in die Galerie, und über dem Entwurf erscheint „{{ui:drafts.badge.finished}}“. Wenn einige Entwürfe fehlgeschlagen sind, erscheint die Schaltfläche „N fehlgeschlagene {{ui:manual.drafts.retry}}“.

> Obwohl es „{{ui:manual.drafts.finish}}“ heißt, wird nicht aus der Mitte fortgesetzt. Mit demselben Seed wird von Anfang bis Ende neu gezeichnet. Deshalb dauert das Fertigstellen genauso lange wie eine normale Generierung. Sie erhalten ein Bild mit der Komposition, die Sie im Entwurf gesehen haben.

> Entwürfe lassen sich nur bei der Generierung verwenden, die Bilder aus Text erzeugt. Sind Referenzbilder o. Ä. eingestellt, erscheint eine Meldung, und Sie können nicht starten. Entwurfsbilder werden nicht in der Galerieliste aufgelistet.

Entwürfe werden „in der Reihenfolge, in der Sie sie gestartet haben“ in den Tabs oben aufgelistet. Wenn Sie einen nicht mehr brauchen, schließen Sie ihn mit dem ✕ am Tab.

## Gesammelt verarbeiten

![Der Dialog zur gesammelten Verarbeitung](shot:batch)

Hintergrundentfernung oder Vergrößerung können Sie auf mehrere gewählte Bilder auf einmal anwenden.

1. Wählen Sie in der Galerie mehrere Bilder (Klick bei gedrückter Taste `Ctrl`, oder Klick bei gedrückter Taste `Shift`, um einen Bereich zu wählen).
2. Klicken Sie mit der rechten Maustaste auf ein gewähltes Bild und wählen Sie **{{ui:gallery.menu.batch}}**.
3. Wählen Sie die Verarbeitung.
   - **{{ui:batch.op.removeBackground.title}}**: Macht den Hintergrund transparent. Die Erweiterung ComfyUI-RMBG wird benötigt. Ist sie nicht installiert, erscheint eine Schaltfläche zum Installieren.
   - **{{ui:batch.op.upscale.title}}**: Vergrößert mit einem Upscaling-Modell. Haben Sie kein Modell, installieren Sie eines über den Tab [Modelle](08-models.md).
4. Klicken Sie auf **{{ui:batch.run}}**.

Jedes Bild kommt als eigener Eintrag in die Warteschlange. Den Fortschritt sehen Sie im Tab **{{ui:app.tabs.queue}}**. Die Ergebnisse kommen als neue Bilder in dasselbe Board wie die Originalbilder. Die Originalbilder ändern sich nicht.

Wenn Sie ein einzelnes Bild sorgfältig und mit wechselnden Einstellungen verarbeiten möchten, verwenden Sie die einzelnen Funktionen dieses Kapitels ([Hintergrund entfernen](#hintergrund-entfernen)). Um ein einzelnes Bild zu vergrößern, können Sie auch den Tab [Upscaling](06-upscaling-workflows.md) nutzen.
