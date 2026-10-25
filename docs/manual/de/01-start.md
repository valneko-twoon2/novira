# Erste Schritte

## Was novira kann

novira ist eine Windows-Desktop-App, die Bilder, Videos, Musik und Stimmen erzeugt.
Sie schreiben einen Prompt (eine Beschreibung dessen, was entstehen soll) und klicken auf **{{ui:params.invoke.invoke}}**. Das Bild wird auf Ihrem eigenen Computer erzeugt und erscheint rechts in der Galerie.
Aufbau und Bedienung orientieren sich am Bildgenerator InvokeAI. Wer ihn schon kennt, findet sich sofort zurecht.

Im Überblick können Sie Folgendes tun:

- Bilder aus Text erzeugen (darauf liegt der Schwerpunkt dieser Anleitung)
- Ein vorhandenes Bild überarbeiten, nur einen Teil davon neu zeichnen oder es vergrößern
- Videos, Musik, Stimmen, Logos und Bilder mit Text erzeugen
- Den KI-Assistenten um Hilfe bei Einstellungen und Prompts bitten

> Das Zeichnen findet auf Ihrem eigenen Computer statt. Funktionen, die das Internet nutzen, etwa die Suche nach Modellen, deren Download oder der KI-Assistent, stellen nur dann eine Verbindung her, wenn Sie sie verwenden.

## Wie Bilder entstehen

novira besteht aus vier Teilen.

| Teil | Aufgabe |
|---|---|
| novira (diese App) | Die Bildschirme, die Galerie, die Warteschlange und die Modellverwaltung |
| Bild-Engine (ComfyUI) | Der Teil, der tatsächlich zeichnet. novira installiert und startet sie selbstständig |
| Modelle | Die Trainingsdaten, mit denen gezeichnet wird. Jedes Modell ist eine Datei von mehreren GB und wird getrennt von der Engine bezogen |
| Datenordner | Der Ort, an dem Ihre Bilder, Modelle, die Engine selbst und mehr gespeichert sind |

Sie müssen die Engine nicht selbst installieren. novira installiert sie automatisch beim ersten Start.
Die Engine und ihre Komponenten (etwa Python) landen nur im Datenordner von novira. Andere Orte auf Ihrem Computer und eine bereits vorhandene Python-Installation bleiben unverändert.

Der Datenordner heißt `novira-data` und liegt im Ordner der App. Nutzen Sie diesen Ordner, wenn Sie Ihre Bilder und Modelle verschieben oder sichern möchten.

> Die Bilderzeugung nutzt die GPU (Grafikkarte). Standardmäßig installiert novira die Engine für NVIDIA-GPUs.

Ein Modell legt fest, in welchem Stil gemalt wird. Für den Anfang brauchen Sie eines. Wie Sie eines hinzufügen, steht unter [Modelle bereitstellen](08-models.md).

## Beim ersten Start

Beim Öffnen der App erscheint zuerst der Startbildschirm (das Logo und Seifenblasen mit Bildern, die langsam vorbeischweben).
Darunter zeigt eine Karte, was die App gerade tut.

Beim allerersten Start beginnt die Installation der Bild-Engine. Die Karte zeigt nacheinander drei Phasen.

1. **{{ui:splash.step.downloading}}**: ComfyUI und Python werden heruntergeladen. Angezeigt werden auch die Größe, die Geschwindigkeit und die geschätzte Restzeit.
2. **{{ui:splash.step.extracting}}**: Die heruntergeladenen Dateien werden entpackt.
3. **{{ui:splash.step.starting}}**: Die Engine wird gestartet, und novira wartet auf die Verbindung.

> {{ui:engine.firstRunNote}}

Die Installation erfolgt nur einmal. Ab dem zweiten Start ist der Startbildschirm nach wenigen Sekunden vorbei, und die Engine startet sofort.

Sobald die Engine bereit ist, verschwindet der Startbildschirm, und die Hauptansicht öffnet sich.
Während Daten geladen werden, sehen Sie „{{ui:splash.wait.heading.loading}}“, und während die Engine und die für die Bearbeitung nötigen Informationen geladen werden, sehen Sie „{{ui:splash.wait.heading.preparing}}“.

### Meldungen am oberen Bildschirmrand

Wenn die Engine nach dem Öffnen der App neu startet oder neu installiert wird, erscheint oben in der Mitte ein Banner, das den Stand erklärt.

- „{{ui:engine.title.downloading}}“, „{{ui:engine.title.extracting}}“ und „{{ui:engine.title.starting}}“: Die Arbeit läuft. Die Generierung beginnt erst nach dem Abschluss. Danach verschwindet das Banner von selbst.
- „{{ui:engine.title.error}}“: Die Engine konnte nicht vorbereitet werden. Der Grund steht in der Zeile unter dem Banner.

Erscheint auf dem Startbildschirm ein Fehler, wird unter dem Grund die Schaltfläche **{{ui:splash.open}}** angezeigt. Damit öffnet sich die App ohne die Engine. Sie können Ihre Modelle prüfen und Einstellungen ändern, aber keine Bilder erzeugen.
Tritt der Fehler weiterhin auf, siehe [Hilfe bei Problemen](10-troubleshooting.md).

## Die Oberfläche kennenlernen

![Der gesamte Tab Generieren: links das Bedienfeld mit den Parametern, in der Mitte die Startansicht, rechts Board und Galerie](shot:generate)

Von links nach rechts ist der Bildschirm so aufgebaut.

- Der schmale senkrechte Streifen ganz links: die **Seitennavigation**. Mit ihr wechseln Sie zwischen den Tabs.
- Das linke Bedienfeld: das **Parameter-Bedienfeld**. Es enthält die Einstellungen zum Erzeugen eines Bildes, etwa Prompt und Modell.
- Die Mitte: die **Hauptansicht**. Sie ist der Arbeitsbereich, der sich je nach Tab ändert, zum Beispiel Startansicht, Bildbetrachter oder Leinwand.
- Das rechte Bedienfeld: die **Galerie**. Sie zeigt Boards (etwa wie Ordner) und Vorschaubilder der erzeugten Bilder.

### Seitennavigation (Tabs)

| Tab | Wofür er dient | Zifferntaste |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Bilder erzeugen. Über die Symbole oben wechseln Sie auch zu Video, Musik, Stimme, Logos, Text und Comics | `1` |
| **{{ui:app.tabs.canvas}}** | Bilder platzieren, weiter zeichnen oder nur einen Teil neu zeichnen | `2` |
| **{{ui:app.tabs.comic}}** | Comicseiten erstellen: Anordnung der Bildfelder, ein Bild je Bildfeld, Sprechblasen und Erzähltext. Öffnet sich auch über das Symbol ganz rechts oben im Tab {{ui:app.tabs.generate}} | `3` |
| **{{ui:app.tabs.upscaling}}** | Ein Bild vergrößern und dabei feine Details ergänzen | `4` |
| **{{ui:app.tabs.workflows}}** | Bausteine (Nodes) verbinden und ein eigenes Generierungsverfahren aufbauen | `5` |
| **{{ui:app.tabs.models}}** | Vorhandene Modelle auflisten, installieren und löschen | `6` |
| **{{ui:app.tabs.browse}}** | Im Internet nach Modellen suchen und sie übernehmen | `7` |
| **{{ui:app.tabs.queue}}** | Die Warteschlange der Generierung ansehen und anhalten. Ein Zähler zeigt, wie viele warten | `8` |
| **{{ui:app.nav.extensions}}** | ComfyUI-Erweiterungen suchen sowie installieren oder entfernen | `0` |

Nahe dem unteren Rand der Seitennavigation gibt es außerdem Folgendes.

- **{{ui:app.tabs.short.agent}}**: Öffnet das Fenster des KI-Assistenten über dem aktuellen Bildschirm.
- **{{ui:app.nav.settings}}**: Über das Menü öffnen Sie {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} und {{ui:app.nav.about}}.
- Das „n“-Logo ganz oben: Öffnet {{ui:app.nav.about}}.

Die Bedienung der einzelnen Bereiche wird in den folgenden Kapiteln erklärt.

- {{ui:app.tabs.generate}}, {{ui:app.tabs.queue}}: [Bilder erzeugen](02-generate.md)
- Die Galerie und der Betrachter: [Die Galerie und der Betrachter](03-gallery.md)
- {{ui:app.tabs.canvas}}: [Auf der Leinwand weiter zeichnen](05-canvas.md)
- {{ui:app.tabs.comic}}: [Comics zeichnen](12-comic.md)
- {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}}: [Upscaling und Workflows](06-upscaling-workflows.md)
- Video, Musik, Stimme und mehr: [Video, Musik, Stimme, Logos und Text](07-media.md)
- {{ui:app.tabs.models}}, {{ui:app.tabs.browse}}: [Modelle bereitstellen](08-models.md)
- {{ui:app.tabs.short.agent}}, {{ui:app.nav.settings}}: [Der KI-Assistent und die Einstellungen](09-assistant-settings.md)

### Die Tabs in der Mitte (Start, Betrachter, Entwürfe)

Oben in der Mitte des Tabs {{ui:app.tabs.generate}} gibt es drei kleine Tabs.

- **{{ui:app.views.launchpad}}**: Eine Starthilfe. Sie zeigt Karten wie „{{ui:params.launchpad.generate.textTitle}}“ und „{{ui:params.launchpad.generate.refTitle}}“ sowie Hinweise zu Tastenkürzeln.
- **{{ui:app.views.viewer}}**: Der Ort, um ein Bild groß anzusehen. Wählen Sie in der Galerie ein Bild aus, wird es hier angezeigt.
- **{{ui:app.views.drafts}}**: Hier liegen viele halbfertige Kandidaten mit denselben Einstellungen und unterschiedlichen Seeds nebeneinander. Sie lassen nur die gewünschten fertig zeichnen.

Auch andere Tabs haben eigene kleine Tabs (der Tab {{ui:app.tabs.canvas}} hat zum Beispiel {{ui:app.views.canvas}}).

### Bedienfelder ausblenden

Wenn Sie ein Bild größer sehen möchten, können Sie das linke und das rechte Bedienfeld ausblenden.

- Die kleinen Pfeilschaltflächen am oberen Rand der Mitte öffnen und schließen das linke und das rechte Bedienfeld.
- Auf der Tastatur schaltet `T` das linke Bedienfeld um, `G` das rechte und `F` beide zugleich.
- Ziehen Sie die Grenze zwischen den Bedienfeldern, um deren Breite zu ändern. Die Breite bleibt nur erhalten, solange die App geöffnet ist; nach einem Neustart gilt wieder die ursprüngliche Breite.

> Einzelbuchstaben-Kürzel wie `T`, `G` und `F` funktionieren nicht, während Sie in ein Feld tippen. Verlassen Sie zuerst das Feld und drücken Sie dann die Taste.

## Das erste Bild erzeugen (3 Schritte)

So erzeugen Sie zum ersten Mal ein Bild. Vorausgesetzt wird, dass bereits ein Modell installiert ist.

1. **Modell wählen.** Wählen Sie das gewünschte Modell im Modellfeld oben im linken Bedienfeld. Steht im Feld „{{ui:params.model.noModels}}“, schließen Sie zuerst [Modelle bereitstellen](08-models.md) ab.
2. **Prompt schreiben.** Beschreiben Sie im Feld „{{ui:params.prompt.positive}}“ mit Worten, welches Bild Sie möchten. Reihen Sie zum Beispiel Wörter oder kurze Wendungen mit Kommas aneinander, etwa `a lighthouse on a cliff at dusk, calm sea, warm light`. Mit englischen Prompts erhalten Sie bei vielen Modellen eher das gewünschte Ergebnis.
3. **{{ui:params.invoke.invoke}} klicken.** Klicken Sie auf die Schaltfläche oder drücken Sie `Ctrl+Enter`. Über der Galerie rechts erscheint die Anzeige „{{ui:gallery.generating.title}}“, in der Sie das entstehende Bild und den Fortschritt sehen. Danach erscheint das Bild im Betrachter in der Mitte und steht auch in der Galerie.

Ist die Schaltfläche grau und lässt sich nicht klicken, steht der Grund in der Zeile darunter (zum Beispiel „{{ui:params.readiness.noModel}}“). Beheben Sie den Grund, dann ist die Schaltfläche wieder verfügbar.

Das fertige Bild wird automatisch in der Galerie gespeichert. Gefällt es Ihnen nicht, ändern Sie den Prompt oder die Einstellungen ein wenig und klicken Sie erneut.
Weitere Einzelheiten finden Sie unter [Bilder erzeugen](02-generate.md).
