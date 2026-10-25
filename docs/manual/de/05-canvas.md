# Leinwand

![Der gesamte Tab Leinwand. In der Mitte die Leinwand, unten rechts die Liste der Ebenen](shot:canvas)

Der Tab **{{ui:app.tabs.canvas}}** ist eine Werkbank zum Zeichnen, Platzieren und teilweisen Neuzeichnen von Bildern. Sie können ein Bild einfügen und erweitern, eine Maske über die Stelle legen, die neu gezeichnet werden soll, oder mit einer Strichfigur eine Pose festlegen.

Der Bildschirm ist in drei Bereiche geteilt.

- Links: ein Bedienfeld mit denselben Einstellungen wie im Tab Generieren (Prompt, Modell, Größe usw.). Auf der Leinwand kommt der Eintrag **{{ui:params.compositing.title}}** hinzu.
- Mitte: die Leinwand. Darüber stehen die Werkzeugschaltflächen.
- Rechts: die Liste der **{{ui:canvas.layers.title}}**, die Ihre Bilder enthalten.

Wenn Sie bei leerer Leinwand auf **{{ui:params.invoke.invoke}}** klicken, wird innerhalb des gestrichelten Rahmens (dem Generierungsbereich) ganz normal ein Bild erzeugt. Die eigentliche Stärke der Leinwand zeigt sich, wenn Sie dort ein Bild oder eine grobe Skizze platzieren. Ebenen und Masken werden automatisch gespeichert und sind beim nächsten Öffnen der App wieder da (der Verlauf zum Rückgängigmachen wird nicht gespeichert).

## Bilder platzieren und zeichnen

Es gibt mehrere Möglichkeiten, ein Bild auf die Leinwand zu bringen.

- Mit dem Pinsel zeichnen. Ist keine Ebene ausgewählt, wird automatisch eine {{ui:canvas.add.raster}} angelegt.
- Ein Bild aus der Galerie auf die Leinwand ziehen. Es erscheint ein Rahmen zur Wahl des Ziels (Raster, Control, Inpainting-Maske usw.); legen Sie das Bild dort ab.
- `Ctrl+V` fügt ein Bild aus der Zwischenablage als neue Rasterebene ein (es wird dabei auch in der Galerie gespeichert).
- Ein Bild in der Galerie mit der rechten Maustaste anklicken (im Betrachter über das Pinselsymbol) und unter **{{ui:gallery.menu.sendToCanvas}}** ein Ziel wählen.

Die Ziele sind folgende.

| Ziel | Was daraus wird |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Leert die Leinwand und beginnt neu mit derselben Größe wie das Bild. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Beginnt ebenfalls neu, aber das Bild wird zu einer Control-Ebene. |
| **{{ui:gallery.canvas.raster}}** | Fügt es der aktuellen Leinwand als Rasterebene hinzu. |
| **{{ui:gallery.canvas.control}}** | Fügt es als Control-Ebene hinzu. |
| **{{ui:gallery.canvas.inpaint}}** | Fügt es als Inpainting-Maske hinzu. |
| **{{ui:gallery.canvas.regional}}** | Fügt es als Referenzbild für die regionale Steuerung hinzu (siehe [Regionale Steuerung ist noch nicht verfügbar](#regionale-steuerung-ist-noch-nicht-verfügbar)). |

## Werkzeuge

Die Werkzeuge stehen in der Leiste oben. Sie lassen sich auch über Buchstabentasten auf der Tastatur umschalten.

| Werkzeug | Taste | Wofür es dient |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Zeichnet Bilder. Die Farbe ändern Sie mit der Farbschaltfläche in der Leiste. |
| **{{ui:canvas.tool.eraser}}** | `E` | Löscht Gezeichnetes. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Verwandelt den übermalten Bereich in ein Mosaik (zum Verbergen von etwas). Die Blockgröße ist die Zahl in der Leiste. Wirkt nur auf Ebenen mit Bildinhalt. |
| **{{ui:canvas.tool.rect}}** | `U` | Füllt ein Rechteck. |
| **{{ui:canvas.tool.lasso}}** | `L` | Zeichnet eine freie Form und füllt sie mit der Farbe (bei Masken: als Maske). |
| **{{ui:canvas.tool.pose}}** | `O` | Setzt eine Strichmännchen-Pose auf eine Control-Ebene und lässt Sie die Gelenke bewegen (siehe unten „Pose auf der Leinwand erstellen“). |
| **{{ui:canvas.tool.move}}** | `V` | Verschiebt Ebenen. Die Pfeiltasten bewegen die gewählte Ebene um 1 px (mit Shift 10 px). |
| **{{ui:canvas.tool.bbox}}** | `C` | Verschiebt den Generierungsbereich (Begrenzungsrahmen) und ändert seine Größe. |
| **{{ui:canvas.tool.view}}** | `H` | Verschiebt die Ansicht. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Nimmt eine Farbe aus dem Bild auf. |

Außerdem sind folgende Bedienungen möglich.

- Die Pinselstärke ändern Sie mit **{{ui:canvas.toolbar.brushWidth}}** in der Leiste oder mit den Tasten `[` und `]`. Mit `Q` wechseln Sie zwischen dem aktuellen und dem zuvor verwendeten Werkzeug.
- Vergrößern und Verkleinern geht mit dem Mausrad oder den Tasten `+` und `-`. Mit `Ctrl+0` sehen Sie die ganze Leinwand, mit `Ctrl+1` die tatsächliche Größe (100 %).
- Zum Verschieben der Ansicht ziehen Sie bei gedrückter `Space`-Taste oder bei gedrücktem Mausradknopf.
- Mit **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) und **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) machen Sie Gezeichnetes rückgängig oder stellen es wieder her.

Das Zahnrad **{{ui:canvas.settings.title}}** enthält unter anderem die Anzeige eines Rasters, das Abdunkeln der Fläche außerhalb des Generierungsbereichs, eine Einstellung, die gezeichnete Linien auf den Generierungsbereich beschränkt, und eine Funktion, die sichtbare Rasterebenen zu einer zusammenfasst.

## Der Generierungsbereich (Begrenzungsrahmen)

Der gestrichelte Rahmen in der Leinwand ist der Bereich, in dem diesmal ein Bild erzeugt wird. Bei jeder Generierung wird nur das Innere dieses Rahmens erzeugt, und seine Größe wird zur Größe des Bildes.

- Wechseln Sie zu **{{ui:canvas.tool.bbox}}** (`C`) und ziehen Sie den Rahmen, um ihn zu verschieben. Ziehen an einer Ecke oder Kante ändert die Größe.
- Die Größe können Sie auch im linken Bedienfeld mit **{{ui:params.image.bboxWidth}}** und **{{ui:params.image.bboxHeight}}** festlegen.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) passt den Rahmen an die platzierten Bilder an.

## Ebenen

Unter **{{ui:canvas.layers.title}}** unten rechts werden die Dinge aufgelistet, die Sie auf der Leinwand platziert haben. Mit der Schaltfläche **{{ui:common.add}}** fügen Sie welche hinzu.

![Das geöffnete Menü „Hinzufügen“ der Ebenen](shot:canvas-add-layer)

Es gibt Ebenenarten mit unterschiedlichen Aufgaben.

| Art | Aufgabe |
|---|---|
| **{{ui:canvas.add.raster}}** | Eine gewöhnliche Bildebene. Darauf zeichnen Sie und platzieren Bilder. Was hier liegt, wird zum „Originalbild“. |
| **{{ui:canvas.add.control}}** | Ein Bild, das als Hinweis für Form, Linien, Pose usw. dient. Es wirkt als Anweisung für die Generierung und wird nicht Teil des Bildes selbst. |
| **{{ui:canvas.add.inpaint}}** | Sie malen den Bereich aus, der „hier neu gezeichnet werden soll“. |
| **{{ui:canvas.add.regional}}** | Eine Ebene, die für jede Stelle einen anderen Prompt vorgibt. In der aktuellen Desktop-Version kann sie nicht für die Generierung verwendet werden. |
| **{{ui:canvas.add.globalRef}}** | Ein Referenzbild, dessen Stimmung das ganze Bild übernehmen soll. Es entspricht den Referenzbildern im Tab Generieren. |

In der Ebenenliste sind folgende Bedienungen möglich.

- Das Augensymbol schaltet zwischen sichtbar und ausgeblendet um, das Schlosssymbol sperrt oder entsperrt. Ausgeblendete Ebenen werden nicht für die Generierung verwendet. Auf einer gesperrten Ebene kann nicht gezeichnet werden.
- Ein Doppelklick auf den Namen benennt die Ebene um.
- Per Rechtsklick können Sie duplizieren, die Reihenfolge ändern (nach vorn oder hinten; Ebenen derselben Art lassen sich auch per Ziehen in der Liste umordnen), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (nur Control-Ebenen), in eine andere Art umwandeln, in die Zwischenablage kopieren, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** und löschen.
- Über **{{ui:canvas.layers.more}}** („…“) lassen sich außerdem die sichtbaren Rasterebenen zu einer zusammenfassen und alle Ebenen löschen.

![Das Kontextmenü einer Ebene](shot:canvas-layer-menu)

Unter der ausgewählten Ebene öffnen sich deren Einstellungen.

- {{ui:canvas.add.inpaint}}: Farbe und Füllmuster der Maske (betrifft nur die Darstellung auf dem Bildschirm) sowie **{{ui:canvas.mask.denoiseLimit}}** (wenn Sie es einschalten und senken, bleibt das Originalbild auch innerhalb der Maske eher erhalten). Im Rechtsklickmenü der Maske kehrt **{{ui:canvas.entityMenu.invertMask}}** sie innerhalb des Generierungsbereichs um.
- {{ui:canvas.add.control}}: siehe den nächsten Abschnitt „{{ui:canvas.add.control}}“.

## Wie neu gezeichnet wird

Wenn Sie auf der Leinwand auf **{{ui:params.invoke.invoke}}** klicken, prüft die App den Generierungsbereich und legt die Art der Bilderzeugung automatisch fest. Sie müssen sie nicht selbst wählen.

| Zustand im Generierungsbereich | So wird das Bild erzeugt |
|---|---|
| Auf den sichtbaren Rasterebenen ist nichts gezeichnet | Ein neues Bild wird aus Text erzeugt (Text zu Bild). |
| Die Rasterebene ist nur teilweise gefüllt | Die leeren Teile werden ergänzt, um das Bild zu erweitern (Outpainting). Die leeren Teile werden zuvor mit einer Farbe gefüllt. |
| Alles ist gefüllt, und die Inpainting-Maske ist nicht bemalt | Das aktuelle Bild dient als Grundlage und wird neu gezeichnet (Bild zu Bild). |
| Alles ist gefüllt, und die Inpainting-Maske ist bemalt | Nur der maskierte Teil wird neu gezeichnet (Inpainting). Außerhalb der Maske bleibt das Originalbild unverändert. |

Bei Bild zu Bild bestimmen Sie mit **{{ui:params.image.strength}}** im linken Bedienfeld, wie stark sich das Bild ändert. 0 belässt das Original, 1 zeichnet es komplett neu.

Beim Outpainting wählen Sie unter **{{ui:params.compositing.title}}** im linken Bedienfeld mit **{{ui:params.compositing.infillTitle}}**, womit die leeren Teile gefüllt werden. Bei **{{ui:params.compositing.infill.color}}** werden sie mit der gewählten Farbe (Schwarz, Weiß, Grau usw.) gefüllt. Bei einer anderen Wahl werden sie so gefüllt, dass die umgebenden Farben ineinander übergehen. Wie weich der Übergang ist, bestimmen Sie mit **{{ui:params.compositing.maskBlur}}**.

> Inpainting funktioniert mit gewöhnlichen Modellen direkt. Ein spezielles „Inpainting-Modell“ ist nicht nötig.

## Über die Verwendung des Ergebnisses entscheiden (Staging)

Ein auf der Leinwand erzeugtes Bild wird nicht sofort in die Leinwand übernommen. Es wird über dem Generierungsbereich angezeigt, und über die Leiste darunter (**{{ui:canvas.staging.title}}**) entscheiden Sie, ob Sie es verwenden.

| Schaltfläche | Was sie bewirkt |
|---|---|
| Pfeile links und rechts (`←` `→`) | Zeigen bei mehreren erzeugten Bildern das nächste oder vorherige an. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Übernimmt dieses Bild als neue Rasterebene in die Leinwand. Die übrigen Bilder werden verworfen. |
| **{{ui:canvas.staging.hideResults}}** | Blendet die Ergebnisse aus, damit Sie sie mit dem Originalbild vergleichen können. |
| **{{ui:canvas.staging.saveToGallery}}** | Speichert dieses Bild in der Galerie. |
| **{{ui:canvas.staging.discard}}** | Verwirft nur dieses Bild. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Verwirft alle. |

> Die Ergebnisbilder erscheinen nicht von selbst in der Galerie. Möchten Sie ein Bild in der Galerie behalten, klicken Sie zuerst auf **{{ui:canvas.staging.saveToGallery}}**. Verworfene Bilder sind weg.

Der Griff (⋮⋮) am linken Ende der Ergebnisleiste dient dazu, ein Bild an eine andere Stelle zu ziehen und dort abzulegen.

## Control-Ebenen

Eine Control-Ebene ist ein Hinweis nach dem Motto „zeichne entlang dieser Form, dieser Linie, dieser Pose“. Sie legen dort Strichzeichnungen, Umrisse, Posenbilder usw. ein.

Dafür benötigen Sie ein ControlNet-Modell, das zum Hauptmodell passt. Wie Sie es installieren, steht im Kapitel [Modelle](08-models.md). Wählen Sie die Ebene aus und in ihren Einstellungen das **{{ui:common.model}}**. Ohne Modell erscheint an der Schaltfläche „Starten“ eine Meldung wie „Für Control-Ebene 1 ist kein Modell ausgewählt“, und es kann kein Bild erzeugt werden.

Die Einstellungen sind folgende.

- **{{ui:canvas.control.weight}}**: Wie stark dem Hinweis gefolgt wird.
- **{{ui:canvas.control.begin}}** und **{{ui:canvas.control.end}}**: Von welchem Anteil bis zu welchem Anteil der Generierung er wirkt.
- **{{ui:canvas.control.controlMode}}**: Es gibt **{{ui:canvas.control.mode.balanced}}** und **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** verhält sich derzeit wie **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}**: Wandelt das Bild in eine Vorlage für Hinweise um, etwa Linien oder Tiefe. Es ist eine einfache Umwandlung innerhalb der App. Probieren Sie sie mit **{{ui:canvas.control.process}}** aus und übernehmen Sie sie bei gutem Ergebnis mit **{{ui:common.apply}}** ins Bild.

## Eine Pose erstellen (Strichfigur)

![Der Dialog zum Festlegen einer Pose mit einer Strichfigur](shot:pose)

Sie können eine Pose festlegen, indem Sie eine Strichfigur bewegen. Das ist praktisch, wenn die Angabe einer Pose in Worten nicht gut funktioniert.

1. Klicken Sie im Tab **{{ui:app.tabs.canvas}}** bei den Ebenen auf **{{ui:common.add}}** und wählen Sie **{{ui:pose.menu}}**.
2. Wählen Sie unter **{{ui:pose.preset}}** eine ähnliche Pose ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Ziehen Sie die Kreise an den Gelenken, um die Haltung zu ändern. Sie können einen Kreis auch auswählen und mit den Pfeiltasten bewegen (mit gedrückter `Shift`-Taste in größeren Schritten). **{{ui:pose.mirror}}** spiegelt die Figur seitlich, und **{{ui:pose.reset}}** stellt die ursprüngliche Vorlage wieder her.
4. Wählen Sie die **{{ui:pose.size}}**. Meist genügt die Größe der Leinwand.
5. Klicken Sie auf **{{ui:pose.use}}**.

Die Pose kommt als Control-Ebene in die Leinwand. Ist die Leinwand leer, beginnt sie neu in dieser Größe.

Dafür benötigen Sie ein ControlNet-Modell, das OpenPose unterstützt. Ist eines installiert, wählt die App es automatisch als Modell der Ebene aus. Ist keines installiert, werden Sie per Benachrichtigung darüber informiert. Wählen Sie das Modell nach der Installation in den Einstellungen der Ebene aus.

> Es kann nur die Pose einer einzelnen Person festgelegt werden. Feinheiten wie die Finger der Hände oder die Blickrichtung des Gesichts lassen sich nicht festlegen; geben Sie Gesicht und Hände im Prompt an.

> Wie stark die Pose wirkt, bestimmt die **{{ui:canvas.control.weight}}** der Ebene. Eine Pose-Ebene ist von Anfang an auf maximale Stärke und auf Wirkung vom Anfang bis zum Ende eingestellt. Wenn die Pose mehr Spielraum haben soll, senken Sie den Wert.

### Pose auf der Leinwand erstellen

![Das mit dem Pose-Werkzeug auf die Leinwand gesetzte Strichmännchen](shot:canvas-pose)

Mit dem Werkzeug **{{ui:canvas.tool.pose}}** (`O`) können Sie eine Pose direkt auf der Leinwand erstellen. Eine gesetzte Pose lässt sich später beliebig oft korrigieren.

- Ein Klick auf eine leere Stelle setzt ein stehendes Strichmännchen. Ist keine Control-Ebene ausgewählt, wird eine neue Control-Ebene angelegt, mit der Stärke für Posen und einem Modell, das OpenPose unterstützt (sofern installiert).
- Ziehen Sie den Kreis eines Gelenks, dreht er sich samt dem folgenden Körperteil (die Knochenlänge bleibt gleich). Ziehen am Hals bewegt den ganzen Körper. Ziehen mit gedrückter `Shift`-Taste bewegt nur dieses Gelenk.
- Ein Klick auf ein Gelenk bei gedrückter `Alt`-Taste blendet es aus oder wieder ein (etwa bei Gliedmaßen, die aus dem Bild ragen).
- Die Taste `R` oder die Schaltfläche **{{ui:canvas.pose.random}}** in der Leiste ersetzt die Pose der ausgewählten Ebene durch eine neue zufällige Pose. Sie können beliebig oft drücken und so lange probieren, bis Ihnen eine gefällt.
- Mit den Schaltflächen für die Zahl und den Blitz in der Leiste des Pose-Werkzeugs erzeugen Sie so viele Bilder hintereinander und ändern dabei jedes Mal die Pose (bis zu 16). Auch der Seed ändert sich mit jeder Pose, sodass Sie mit denselben Einstellungen Bilder in verschiedenen Haltungen erhalten. Ist das Erzeugen gerade nicht möglich, wird der Grund angezeigt und nichts startet.
- Auf einer Ebene lassen sich beliebig viele Figuren platzieren. Spiegeln, Drehen und Vergrößern oder Verkleinern erledigen Sie über das Rechtsklickmenü der Ebene.
- Sie können es auch in Worten verlangen. Öffnen Sie den KI-Assistenten, während der Tab **{{ui:app.tabs.canvas}}** geöffnet ist, und beschreiben Sie die Pose, etwa „eine laufende Pose“ oder „hebe die linke Hand“, dann wird eine Figur platziert (bis zu 4 Figuren). Sagen Sie danach „etwas weiter nach vorn gebeugt“, korrigiert er diese Pose. Die Pose ist nur eine Vermutung aus Ihren Worten; passt sie nicht, ziehen Sie die Gelenke, um sie zu korrigieren.
- Eine Pose lässt sich auch aus einer Person in einem Bild erstellen. Klicken Sie ein Bild in der Galerie mit der rechten Maustaste an und wählen Sie **{{ui:canvas.poseFromImage.menu}}**, oder drücken Sie die gleichnamige Schaltfläche in der Leiste des Pose-Werkzeugs: Die Skelette der Personen werden gelesen und als Strichmännchen platziert (bis zu 4 Personen). Platzierte Posen lassen sich wie jede andere Pose korrigieren. Dafür wird die Erweiterung (comfyui_controlnet_aux) benötigt; fehlt sie, bietet der Dialog die Installation an. Beim ersten Mal dauert das Herunterladen der Modelle eine Weile. Eine zu kleine oder teilweise verdeckte Person wird möglicherweise nicht gefunden.
- Die Schaltfläche **{{ui:canvas.pose.presets}}** in der Leiste des Pose-Werkzeugs öffnet ein Fenster mit den Kategorien links und einer Karte je Pose rechts. Jede Karte zeigt die OpenPose-Figur in einem Rahmen in der Form des Erzeugungsbereichs. Die „{{ui:canvas.pose.group.panel}}“ (nah und fern, zwei Personen, Gruppen, Alltagsszenen, Drama und Gefühle) legen zusätzlich fest, wo die Personen stehen und wie groß sie sind, und ersetzen alle Posen der gewählten Ebene. Die „{{ui:canvas.pose.group.standard}}“ und die „{{ui:canvas.pose.group.manga}}“ ersetzen die erste Pose der gewählten Ebene an derselben Stelle und in derselben Größe; ist keine vorhanden, wird eine neue gesetzt. Eine Pose, die den Rahmen verlassen würde (erhobene Arme, Tritt), wird so verkleinert, dass sie hineinpasst.
- Die Schaltfläche **{{ui:canvas.pose3d.menu}}** in der Leiste des Posen-Werkzeugs bearbeitet eine Pose in 3D (die erste Pose der gewählten Control-Ebene oder, falls keine da ist, eine stehende Figur). Beim Ziehen eines Gelenks bleibt die Knochenlänge erhalten, und ein Knochen kann von Ihnen weg oder auf Sie zu zeigen. Das Ziehen des Hintergrunds dreht den Körper, das Mausrad zoomt. Die Schaltflächen **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** und **{{ui:canvas.pose3d.top}}** drehen auf feste Ansichten. **{{ui:canvas.pose3d.apply}}** legt die jetzt sichtbare Form als Pose auf die Leinwand (die Tiefe wird gemerkt, sodass man sie erneut in 3D öffnen und weiterdrehen kann); Schließen ohne Übernehmen lässt die Pose, wie sie war. Die 3D-Ansicht braucht WebGL im Browser; fehlt es, weist der Dialog darauf hin.

![Posen eines Bildes lesen, bevor sie auf die Leinwand kommen](shot:canvas-pose-from-image)

![Das Fenster „Fertige Posen und Kompositionen“ mit der gewählten Kategorie „Zwei Personen“](shot:canvas-pose-presets)

![Der Dialog zum Bearbeiten einer Pose in 3D](shot:canvas-pose-3d)

Wenn Sie eine Pose aus einem Foto herauslösen möchten, können Sie die Vorlage „{{ui:workflows.templates.poseControl.title}}“ unter [Workflows](06-upscaling-workflows.md) verwenden.

## Regionale Steuerung ist noch nicht verfügbar

**{{ui:canvas.add.regional}}** ist auf dem Bildschirm vorhanden, kann aber in der aktuellen Desktop-Version nicht für die Generierung verwendet werden. Ist eine bemalte Ebene für regionale Steuerung vorhanden, wird die Generierung abgelehnt, und es erscheint eine Fehlermeldung (auf Englisch). Blenden Sie beim Generieren auf der Leinwand die Ebene für regionale Steuerung aus oder löschen Sie sie.

## Speichern und Aufräumen

- Um das Leinwandbild in der Galerie zu speichern, klicken Sie in der Leiste oben auf **{{ui:canvas.toolbar.saveToGallery}}** (das Disketten-Symbol). Die sichtbaren Rasterebenen im Generierungsbereich werden zusammengefasst und als ein Bild gespeichert.
- Um nur eine Ebene zu speichern, klicken Sie mit der rechten Maustaste auf die Ebene und wählen **{{ui:canvas.entityMenu.saveToGallery}}**.
- Unter **{{ui:canvas.settings.title}}** finden Sie außerdem **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** und **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** löscht alle Ebenen.

Funktionen zum Korrigieren von Bildern gibt es auch unter [Bilder verbessern und wiederverwenden](04-improve.md). Das Ergebnis von „{{ui:gallery.menu.segment}}“ lässt sich an die Leinwand senden und weiter neu zeichnen.
