# Bilder korrigieren und wiederverwenden

Dieses Kapitel fasst die Funktionen zusammen, die Sie brauchen, wenn Sie denken: „Dieses fertige Bild möchte ich noch ein wenig korrigieren“, „Ich möchte ein paar weitere in derselben Stimmung“ oder „Diesen Charakter möchte ich auch in einer anderen Szene verwenden“.

Die meisten Funktionen rufen Sie über eine Schaltfläche der Werkzeugleiste über dem Betrachter (der Ansicht, die ein Bild groß zeigt) oder über das Menü auf, das Sie mit einem Rechtsklick auf ein Bild in der Galerie erhalten. Setzen Sie die Maus auf eine Schaltfläche der Werkzeugleiste, um ihren Namen zu sehen. Die Grundlagen zu Betrachter und Galerie finden Sie unter [Die Galerie und der Betrachter](03-gallery.md).

## Was wofür verwendet wird

| Ziel | Verwendung | Was zusätzlich nötig ist |
|---|---|---|
| Mit denselben Einstellungen ein paar weitere erzeugen oder eines leicht verändert neu machen | **{{ui:gallery.derive.menu}}** | Das für das Originalbild verwendete Modell ist installiert |
| Den Hintergrund entfernen und nur die Person oder das Objekt behalten | **{{ui:cutout.menu}}** | Die Erweiterung ComfyUI-RMBG |
| Transparente Ränder abschneiden | **{{ui:gallery.menu.trim}}** (nur per Rechtsklick) | Nichts |
| Einen Teil eines Bildes übermalen und dann löschen, ausschneiden oder neu zeichnen | **{{ui:gallery.menu.segment}}** | Zum Löschen die Erweiterung comfyui-inpaint-nodes |
| Kleine, verzerrte Gesichter korrigieren | **{{ui:facefix.menu}}** | Die Erweiterungen ComfyUI-Impact-Pack und ComfyUI-Impact-Subpack |
| Ein Bild in eine schwarz-weiße Manga-Seite verwandeln | **{{ui:gallery.manga.menu}}** (nur in der Werkzeugleiste des Betrachters) | Die Erweiterung ComfyUI-MangaScreen |
| Aus einem Bild einen Prompt schreiben lassen | **{{ui:caption.menu}}** | Die Erweiterung ComfyUI-Florence2 |
| Einen Charakter registrieren und in anderen Bildern verwenden | **{{ui:character.menu}}** | Die Erweiterung für Referenzbilder (IP-Adapter) |
| Bilder mit geänderten Einstellungen in einer Tabelle nebeneinanderstellen | **{{ui:xyplot.menu}}** | Nichts |
| Aus halb gezeichneten Kandidaten auswählen | Der Tab **{{ui:app.views.drafts}}** | Nichts |
| Dieselbe Verarbeitung auf viele Bilder anwenden | **{{ui:gallery.menu.batch}}** (mehrere wählen und rechtsklicken) | Hängt von der Verarbeitung ab |

## Die Korrekturwerkzeuge verwenden

Die vier Werkzeuge {{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}} und {{ui:canvas.poseFromImage.menu}} sind im Rechtsklickmenü eines Galeriebildes unter **{{ui:gallery.tools.heading}}** zusammengefasst. Jedes arbeitet in einem Band, das sich über dem Bild im Betrachter öffnet. Das Bild bleibt im Betrachter, sodass Sie es beim Prüfen zoomen und verschieben können.

- Die Wahl eines Eintrags führt ihn sofort mit den Einstellungen vom letzten Mal aus. Das Bild erscheint im Betrachter, und das Band zeigt den Fortschritt.
- Die Zahnrad-Schaltfläche rechts neben einem Eintrag öffnet die Einstellungen im Band, ohne etwas auszuführen. Ändern Sie die Einstellungen und klicken Sie auf **{{ui:gallery.tools.run}}**. Die geänderten Einstellungen gelten auch beim nächsten Mal.
- Die Schaltflächen **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}** und **{{ui:caption.menu}}** in der Werkzeugleiste des Betrachters öffnen die Einstellungen ebenfalls im Band. Ein erneuter Klick auf die Schaltfläche schließt es.
- Die Schaltflächen links im Band wechseln zu einem anderen Werkzeug.
- Nach dem Abschluss zeigt das Band das Ergebnis und die verwendeten Einstellungen. **{{ui:gallery.tools.edit}}** geht zu den Einstellungen zurück, damit Sie sie ändern und erneut ausführen können.
- Die Arbeit läuft in der Warteschlange. Das Schließen des Bandes oder der Wechsel zu einem anderen Bild oder Bildschirm hält sie nicht an. Nur **{{ui:common.cancel}}** im Band hält sie an. Ein Ergebnis, das ein Bild ist, wird auch bei geschlossenem Band in der Galerie gespeichert.

## Wenn eine Erweiterung nötig ist

Hintergrund entfernen, Gesichter korrigieren und Ähnliches funktionieren, indem der Bild-Engine (ComfyUI) „Erweiterungen“ hinzugefügt werden. Ist eine Erweiterung nicht installiert, steht im Band „… benötigt die Erweiterung XXX.“, und es werden Schaltflächen zum Installieren angezeigt.

1. Klicken Sie auf **{{ui:gallery.tools.install}}**. Das Nötige wird automatisch heruntergeladen und installiert. Die Installation läuft im Hintergrund, und ihr Fortschritt erscheint in der Download-Anzeige. Das Schließen des Bandes hält sie nicht an.
2. Nach der Installation wechselt die Schaltfläche im Band zu **{{ui:gallery.tools.restart}}**. Klicken Sie darauf, und ComfyUI wird neu gestartet.
3. Nach dem Neustart lässt sich das Werkzeug unverändert verwenden.

Bei der ersten Verwendung beginnt auch der Download der Modelle, die die Erweiterung nutzt, daher dauert es eine Weile. Sie müssen mit dem Internet verbunden sein. Dieser Download läuft innerhalb der von Ihnen gestarteten Arbeit, das Schließen des Bandes hält ihn also nicht an.

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

- Wenn das Bild nicht erzeugt wurde, also nicht aus einem Text entstand (Bild zu Bild, Inpainting und Outpainting zählen ebenfalls als erzeugt). Vergrößerte Bilder, Videos, Audio und Ähnliches sind ausgenommen.
- Wenn das für das Originalbild verwendete Modell nicht installiert ist. Es erscheint eine Benachrichtigung mit dem Namen des Modells.

## Hintergrund entfernen

![Der entfernte Hintergrund im Band des Betrachters, verglichen mit dem Original](shot:cutout)

Erkennt automatisch, was im Bild zu sehen ist, und erzeugt ein Bild ohne Hintergrund. Sie müssen nichts per Klick markieren.

1. Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie unter **{{ui:gallery.tools.heading}}** den Eintrag **{{ui:cutout.menu}}**: Er wird sofort mit den Einstellungen vom letzten Mal ausgeführt. Um zuerst die Einstellungen zu ändern, öffnen Sie das Band mit dem Zahnrad rechts neben dem Eintrag oder mit der Scheren-Schaltfläche in der Werkzeugleiste des Betrachters.
2. Ändern Sie im Band bei Bedarf die Einstellungen.
   - **{{ui:cutout.model}}**: Meist ist die Voreinstellung in Ordnung.
   - **{{ui:cutout.sensitivity}}**: Je niedriger der Wert, desto mehr von den Bereichen mit unklarer Grenze bleibt erhalten.
   - **{{ui:cutout.edge}}**: Ein positiver Wert erweitert die Kontur, ein negativer Wert schneidet sie ab.
   - **{{ui:cutout.background}}**: Wählen Sie **{{ui:cutout.background.alpha}}** oder **{{ui:cutout.background.white}}**.
3. Klicken Sie auf **{{ui:gallery.tools.run}}**.

Das fertige Bild wird als neues Bild im selben Board wie das Original gespeichert. **Das Originalbild bleibt erhalten.** Der Betrachter vergleicht dann das neue Bild mit dem Original. Sind Sie mit dem Ergebnis nicht zufrieden, klicken Sie auf **{{ui:gallery.tools.edit}}**, ändern Sie die Einstellungen und führen Sie es erneut aus.

Ein weißer Hintergrund eignet sich gut, wenn Sie das Bild später als Referenzbild für einen [Charakter](#charakter-registrieren-und-verwenden) nutzen möchten. Die Hintergrundfarbe überträgt sich dann seltener auf neu erzeugte Bilder.

## Transparente Ränder abschneiden

Ein Bild mit transparentem Hintergrund behält um das Bild herum transparente Ränder. Mit **{{ui:gallery.menu.trim}}** speichern Sie ein neues transparentes Bild, das genau auf den Teil mit Inhalt zugeschnitten ist. Das ist praktisch, wenn Sie es als Sticker oder Material verwenden.

- Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie den Eintrag. Direkt nach dem Entfernen eines Hintergrunds geht dasselbe auch über **{{ui:cutout.trim}}** im Band (er erscheint nur, wenn Sie den Hintergrund transparent gemacht haben).
- Ein Schatten, der so schwach ist, dass er kaum sichtbar ist, wird als Rand abgeschnitten.
- Bei einem Bild, dessen transparenter Bereich nicht bis an den Bildrand reicht, erscheint „Es gibt keinen Rand zuzuschneiden.“ und nichts wird gespeichert. Auch ein vollständig transparentes Bild lässt sich nicht zuschneiden.

## Einen Bereich auswählen und korrigieren

Den zu korrigierenden Teil wählen Sie aus, indem Sie ihn mit einem Pinsel übermalen. Das Bild öffnet sich auf der [Leinwand](05-canvas.md), sodass Sie beim Malen feiner Details zoomen und sich bewegen können.

1. Öffnen Sie das Bild im Betrachter und klicken Sie auf **{{ui:gallery.menu.segment}}** (Sie können es auch im Rechtsklickmenü der Galerie wählen).
2. Die Leinwand öffnet sich mit dem Bild und einer leeren, gewählten **{{ui:canvas.add.inpaint}}**. Das Werkzeug ist der **{{ui:canvas.tool.brush}}**.
3. Übermalen Sie den Teil, den Sie korrigieren möchten. Zu viel Übermaltes entfernen Sie mit dem **{{ui:canvas.tool.eraser}}**. Um stattdessen den Rest auszuwählen, klicken Sie mit der rechten Maustaste auf die Maske und wählen **{{ui:canvas.entityMenu.invertMask}}**.
4. Wählen Sie, was mit dem übermalten Teil geschehen soll. Ist die Zeile der Maske gewählt, erscheinen darunter ein Textfeld und Schaltflächen (Löschen und Ausschneiden stehen auch im Rechtsklickmenü der Maske).

| Ziel | Vorgehen | Was nötig ist |
|---|---|---|
| Löschen und in das umgebende Bild einfügen | **{{ui:canvas.partFix.erase}}**. Das Ergebnis liegt auf der Leinwand im Staging, wählen Sie also **{{ui:canvas.staging.accept}}** oder verwerfen Sie es. | Die Erweiterung comfyui-inpaint-nodes. Mit dem Modell LaMa (ca. 200 MB) wirkt das Löschen natürlich. Ohne es ist auch ein einfaches Löschen möglich. |
| Nur den übermalten Teil als transparentes Bild speichern | **{{ui:canvas.partFix.cutOutAction}}** | Nichts |
| Nach einer Textanweisung neu zeichnen | Schreiben Sie in das Textfeld, was dort gezeichnet werden soll, etwa „a blue ribbon“, und klicken Sie auf **{{ui:canvas.partFix.redraw}}**. Nur der übermalte Teil wird neu gezeichnet, mit dem Modell und den Einstellungen des Tabs Generieren. Bei leerem Textfeld wird der Prompt des Tabs Generieren verwendet. Der Prompt des Tabs Generieren wird nicht geändert. Das Ergebnis liegt im Staging, wählen Sie also **{{ui:canvas.staging.accept}}** oder verwerfen Sie es. | Ein Bildmodell |
| Ein Mosaik anwenden | Verwenden Sie die Maske nicht; fahren Sie mit dem Werkzeug **{{ui:canvas.tool.mosaic}}** direkt über den Teil. | Nichts |

Das Originalbild ändert sich nicht. Ein Ausschnitt wird als neues Bild in der Galerie gespeichert.

## Gesichter korrigieren

![Die Einstellungen der Gesichtskorrektur, geöffnet im Band des Betrachters](shot:facefix)

Bei Weitwinkelaufnahmen werden kleine Gesichter oft verzerrt. **{{ui:facefix.menu}}** findet die Gesichter im Bild automatisch, zeichnet nur die Gesichter in hoher Auflösung neu und setzt sie wieder in das Originalbild ein. Außer den Gesichtern ändert sich nichts.

1. Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie unter **{{ui:gallery.tools.heading}}** den Eintrag **{{ui:facefix.menu}}**: Er wird sofort ausgeführt. Um die Einstellungen vor dem Ausführen zu prüfen, öffnen Sie das Band mit dem Zahnrad rechts neben dem Eintrag oder mit der Schaltfläche **{{ui:facefix.menu}}** in der Werkzeugleiste des Betrachters.
2. Nur beim ersten Mal werden die Erweiterungen ComfyUI-Impact-Pack und ComfyUI-Impact-Subpack benötigt. Installieren Sie sie mit **{{ui:gallery.tools.install}}** im Band und klicken Sie auf **{{ui:gallery.tools.restart}}**. Das Modell zum Finden von Gesichtern stellt das Subpack selbst bereit.
3. Prüfen Sie die Einstellungen.
   - **{{ui:facefix.model}}**: Das für das Originalbild verwendete Modell ist gewählt.
   - **{{ui:facefix.detector}}**: Das Modell, mit dem die Gesichter gefunden werden. Meist ist die Voreinstellung in Ordnung.
   - **{{ui:facefix.prompt}}**: Der Prompt des Originalbilds ist eingetragen. Wenn Sie Merkmale des Gesichts ergänzen, wirkt es besser.
   - **{{ui:facefix.strength}}**: Je niedriger, desto näher am ursprünglichen Gesicht; je höher, desto stärker wird neu gezeichnet.
   - **{{ui:facefix.sensitivity}}**: Ein höherer Wert erfasst nur eindeutige Gesichter, ein niedrigerer Wert auch kleine Gesichter und Profile. Dann werden aber auch eher Dinge erfasst, die keine Gesichter sind.
4. Klicken Sie auf **{{ui:gallery.tools.run}}**.

Das Ergebnis wird im selben Board wie das Original gespeichert, und der Betrachter vergleicht es mit dem Original. Wenn es Ihnen nicht gefällt, klicken Sie auf **{{ui:gallery.tools.edit}}**, ändern Sie die Einstellungen und führen Sie es erneut aus. Das Modell und das, was gezeichnet werden soll, werden nur gemerkt, solange Sie am selben Bild arbeiten.

> Ein mit einer LoRA erzeugtes Bild wird ohne die LoRA neu gezeichnet. Deshalb kann nur das Gesicht stilistisch leicht abweichend aussehen.

> Wenn „Das Gesichtserkennungsmodell (YOLO) wurde nicht gefunden.“ erscheint, starten Sie ComfyUI neu oder installieren Sie die Erweiterungen erneut.

## Ein Bild als Manga-Seite fertigstellen

**{{ui:gallery.manga.menu}}** in der Werkzeugleiste des Betrachters verwandelt das geöffnete Bild in eine schwarz-weiße Manga-Seite mit klaren Linien. Schattierungen werden zu flachen Tönen und echten Rasterpunkten, und die Hauptlinien innerhalb tiefschwarzer Flächen werden dünn und weiß ausgespart. Das Zeichnen selbst erzeugt immer das normale Farbbild; die Fertigstellung ist ein Schritt, den Sie danach an einem Bild vornehmen, das Ihnen gefällt.

1. Öffnen Sie das Bild im Betrachter und klicken Sie auf **{{ui:gallery.manga.menu}}**. Das Original wird links angezeigt.
2. Nur beim ersten Mal wird die Erweiterung ComfyUI-MangaScreen benötigt. Ist sie nicht installiert, erscheint ein Hinweis; klicken Sie auf **{{ui:gallery.manga.installPack}}** und dann auf **{{ui:gallery.manga.restartEngine}}**. Die Schaltflächen darunter warten, bis sie installiert ist.
3. Ändern Sie bei Bedarf die Werte (sie werden für das nächste Mal gemerkt):
   - **{{ui:gallery.manga.screenLines}}**: Reihen von Punkten über die Breite. 120 ist grob, 200 normal, 300 fein.
   - **{{ui:gallery.manga.whitePoint}}**: Heller als dieser Wert wird papierweiß. Senken Sie ihn, um den Raster von Haut und hellem Haar zu entfernen.
   - **{{ui:gallery.manga.blackPoint}}**: Dunkler als dieser Wert wird tiefschwarz. Erhöhen Sie ihn für mehr Schwarz.
   - **{{ui:gallery.manga.gradation}}**: Weiche Schatten lassen ihre Punkte mit der Dunkelheit wachsen, statt in Stufen geschnitten zu werden. 0 behält nur flache Flächen.
   - **{{ui:gallery.manga.whiteLines}}**: Wie viele Linien innerhalb tiefschwarzer Flächen weiß ausgespart werden. 0 schaltet es aus.
   **{{ui:gallery.manga.reset}}** setzt alle Werte zurück.
4. Klicken Sie auf **{{ui:gallery.manga.tryRun}}**, um das Ergebnis rechts neben dem Original zu sehen. Ein Versuch speichert nichts.
5. Klicken Sie auf **{{ui:gallery.manga.save}}**, wenn es Ihnen gefällt. Die Seite wird als neues Bild im selben Board wie das Original gespeichert, und das Original ändert sich nicht. Mit **{{ui:gallery.manga.open}}** sehen Sie sie an.

Das Speichern stellt das Bild mit den angezeigten Werten erneut fertig, es dauert also so lange wie ein Versuch.

## Aus einem Bild einen Prompt erstellen

![Im Band des Betrachters für ein Bild geschriebene Tags](shot:caption)

Die Funktion betrachtet ein Bild und erstellt einen Prompt (Tags oder einen Satz), mit dem sich das Bild zeichnen lässt. Nutzen Sie es, wenn Sie Bilder erzeugen möchten, die einem Bild ähneln, das Ihnen gefällt, oder wenn Sie nicht sicher sind, wie man einen Prompt schreibt.

1. Klicken Sie in der Galerie mit der rechten Maustaste auf ein Bild und wählen Sie unter **{{ui:gallery.tools.heading}}** den Eintrag **{{ui:caption.menu}}**: Die Wörter werden sofort aufgeschrieben. Die Schaltfläche **{{ui:caption.fromPrompt}}** über dem Prompt-Feld im Tab Generieren tut dasselbe. Diese Schaltfläche verwendet das in der Galerie gewählte Bild; ist keines gewählt, öffnet sie ein Fenster zur Wahl einer Bilddatei. Auf diese Schaltfläche können Sie auch ein Bild aus der Galerie oder eine Bilddatei von Ihrem Computer ziehen.
2. Um die Schreibweise zu ändern, klicken Sie im Band auf **{{ui:gallery.tools.edit}}** und wählen unter **{{ui:caption.style}}** entweder **{{ui:caption.style.tags}}** oder **{{ui:caption.style.sentence}}**.
3. Klicken Sie auf **{{ui:gallery.tools.run}}**.
4. Die Wörter lassen sich direkt im Band bearbeiten. Klicken Sie dann auf **{{ui:caption.replace}}**, **{{ui:caption.append}}** oder **{{ui:caption.copy}}**.

Ersetzen und Hinzufügen wirken auf „{{ui:params.prompt.positive}}“ im Tab Generieren. Diese Funktion fügt der Galerie kein Bild hinzu.

> Diese Funktion benötigt die Erweiterung ComfyUI-Florence2. Ist sie nicht installiert, können Sie sie über das Band installieren (siehe „Wenn eine Erweiterung nötig ist“ in diesem Kapitel). Bei der ersten Verwendung beginnt der Download des Modells zum Beschreiben von Bildern (Florence-2 PromptGen).

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

## Eine LoRA für einen Charakter wählen

Wählen Sie im Bearbeitungsdialog des Charakters unter **{{ui:lora.section}}** eine LoRA. Danach können Sie **{{ui:lora.use}}** ein- und ausschalten und **{{ui:lora.weight}}** ändern; bei der Verwendung des Charakters werden die LoRA und ihr Trigger-Wort dem Prompt hinzugefügt. Das Training von LoRAs findet in der separaten App novira-train statt.

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
| {{ui:xyplot.axis.strength}} | Zahlen (0,05 bis 1). Wirkt nur beim Erzeugen aus einem Bild (Bild zu Bild). |
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

1. Wählen Sie **{{ui:drafts.model}}**. Anfangs ist das Modell des Tabs Generieren gewählt. Jedes Bildmodell, das der Tab Generieren anbietet, lässt sich wählen: SDXL und SD1.X, aber auch die Modelle, die ohne ihre Text-Encoder und VAEs geliefert werden, wie Anima, Flux, FLUX.2 und Z-Image. Bearbeitungsmodelle (Flux Fill, Flux Kontext, Qwen-Image-Edit) verändern nur ein Bild, das Sie ihnen geben, und stehen daher nicht in der Liste; wenn Sie welche haben, werden ihre Namen darunter angezeigt.
2. Legen Sie **{{ui:drafts.count}}** fest (1 bis 24 Bilder; anfangs 4, was Sie mit **{{ui:settings.draftCount.label}}** in den Einstellungen ändern können). Anzahl und Position bleiben beim Wechsel zu anderen Bildschirmen so, wie Sie sie eingestellt haben, bis Sie die App schließen.
3. Legen Sie **{{ui:drafts.position}}** fest (25 bis 60 %; anfangs 35 %). Je kleiner der Wert, desto schneller geht es, aber desto gröber sind die Bilder.
4. Klicken Sie auf **{{ui:drafts.start}}**.

Die Entwurfsbilder werden in der Reihenfolge aufgelistet, in der sie fertig werden. Prompt und weitere Einstellungen stammen aus dem Tab Generieren.

Ein Klick auf ein Bild wählt es aus (ein erneuter Klick hebt die Auswahl auf). Ein Doppelklick zeigt es groß im Betrachter. Die Stern-Schaltfläche (**{{ui:drafts.keep}}**) und das ✕ (**{{ui:drafts.reject}}**) sind Markierungen für Ihren eigenen Gebrauch. Klicken Sie unten rechts auf die Schaltfläche „N Bilder {{ui:manual.drafts.finish}}“ (N ist die Anzahl der gewählten Bilder), dann werden die gewählten Bilder bis zum Ende gezeichnet. Um neu zu wählen, klicken Sie auf **{{ui:drafts.clearSelection}}**.

Bis zum Ende gezeichnete Bilder kommen wie bei einer normalen Generierung in die Galerie, und über dem Entwurf erscheint „{{ui:drafts.badge.finished}}“. Wenn einige Entwürfe fehlgeschlagen sind, erscheint die Schaltfläche „N fehlgeschlagene {{ui:manual.drafts.retry}}“.

> Obwohl es „{{ui:manual.drafts.finish}}“ heißt, wird nicht aus der Mitte fortgesetzt. Mit demselben Seed wird von Anfang bis Ende neu gezeichnet. Deshalb dauert das Fertigstellen genauso lange wie eine normale Generierung. Sie erhalten ein Bild mit der Komposition, die Sie im Entwurf gesehen haben.

> Entwürfe lassen sich bei der Generierung aus Text verwenden und beim Neuzeichnen eines Bildes, das in den Abschnitt **{{ui:params.i2i.title}}** gelegt wurde. Bei {{ui:params.i2i.title}} wird ein Entwurf bis zur Position gezeichnet, bezogen auf die tatsächlich gezeichneten Schritte, die von der **{{ui:params.image.strength}}** abhängen. Entwurfsbilder werden nicht in der Galerieliste aufgelistet.

Entwürfe werden „in der Reihenfolge, in der Sie sie gestartet haben“ in den Tabs oben aufgelistet. Nur die neuesten 5 bleiben als Tabs. Jeder Entwurf steht auf dem Bildschirm **{{ui:drafts.history.title}}**, den die Schaltfläche „Verlauf“ links neben den Tabs öffnet.

- Wählen Sie in der linken Spalte einen Zeitraum ({{ui:drafts.history.period.today}}, {{ui:drafts.history.period.yesterday}}, {{ui:drafts.history.period.week}}, {{ui:drafts.history.period.older}}) und ein Modell, um nur diese Entwürfe zu sehen. Das Feld oben findet Entwürfe anhand von Wörtern ihres Prompts oder von Modellnamen.
- Die Entwürfe sind nach Tagen getrennt und zeigen die damals gezeichneten Bilder, die Uhrzeit, die Größe und wie viele Entwürfe und fertige Bilder es gibt.
- **{{ui:drafts.history.open}}** öffnet einen Entwurf, und **{{ui:drafts.history.reuse}}** setzt seine Einstellungen wieder in das Formular des Tabs Generieren.

Wenn Sie einen nicht mehr brauchen, schließen Sie ihn mit dem ✕ an seinem Tab oder im Verlauf, oder schließen Sie alle älteren, die keine Tabs sind, auf einmal mit „{{ui:drafts.closeOlder}}“ auf dem Verlaufsbildschirm.

## Gesammelt verarbeiten

![Der Dialog zur gesammelten Verarbeitung](shot:batch)

Hintergrundentfernung oder Vergrößerung können Sie auf mehrere gewählte Bilder auf einmal anwenden.

1. Wählen Sie in der Galerie mehrere Bilder (Klick bei gedrückter Taste `Ctrl`, oder Klick bei gedrückter Taste `Shift`, um einen Bereich zu wählen).
2. Klicken Sie mit der rechten Maustaste auf ein gewähltes Bild und wählen Sie **{{ui:gallery.menu.batch}}**.
3. Wählen Sie die Verarbeitung.
   - **{{ui:batch.op.removeBackground.title}}**: Macht den Hintergrund transparent. Die Erweiterung ComfyUI-RMBG wird benötigt. Ist sie nicht installiert, erscheint eine Schaltfläche zum Installieren.
   - **{{ui:batch.op.upscale.title}}**: Vergrößert mit einem Upscaling-Modell. Haben Sie kein Modell, installieren Sie eines über den Bildschirm [Modelle](08-models.md).
4. Klicken Sie auf **{{ui:batch.run}}**.

Jedes Bild kommt als eigener Eintrag in die Warteschlange. Den Fortschritt sehen Sie im Tab **{{ui:app.tabs.queue}}**. Die Ergebnisse kommen als neue Bilder in dasselbe Board wie die Originalbilder. Die Originalbilder ändern sich nicht.

Wenn Sie ein einzelnes Bild sorgfältig und mit wechselnden Einstellungen verarbeiten möchten, verwenden Sie die einzelnen Funktionen dieses Kapitels ([Hintergrund entfernen](#hintergrund-entfernen)). Um ein einzelnes Bild zu vergrößern, können Sie auch den Tab [Upscaling](06-upscaling-workflows.md) nutzen.
