# Modelle verwalten und finden

Um Bilder zu erzeugen, wird ein „Modell“ benötigt, das die Grundlage für die Bilder bildet. novira hat den Tab **{{ui:app.tabs.models}}**, in dem sich die vorhandenen Modelle ordnen lassen, und den Tab **{{ui:app.tabs.browse}}**, mit dem sich Modelle im Internet suchen und herunterladen lassen.

Dieses Kapitel erklärt die Bedienung der beiden Tabs, die Arten von Modellen und das Lesen der Lizenzen.

## Arten von Modellen

Ein Modell hat eine „{{ui:models.sort.base}}“ (zu welcher Familie es gehört) und einen „{{ui:models.sort.type}}“ (welche Aufgabe es hat).

### Basis (Familie)

Modelle werden je Familie gebaut, und Modelle verschiedener Familien lassen sich nicht kombinieren. Eine LoRA für SD1.5 kann zum Beispiel nicht mit einem SDXL-Modell verwendet werden.

| Anzeige | Bedeutung |
|---|---|
| SD1.X | Stable Diffusion 1.5 und ähnliche. Läuft ressourcenschonend |
| SD2.X | Die Stable-Diffusion-2-Familie |
| SDXL | Die Stable-Diffusion-XL-Familie. Auch viele Illustrationsmodelle (Illustrious, NoobAI, Pony usw.) gehören dazu |
| SD3.X | Die Stable-Diffusion-3-Familie |
| FLUX | Die FLUX-Familie |
| Any | Modelle, die nicht an eine Familie gebunden sind (z. B. Upscaler) |

> In der aktuellen Desktop-Version lassen sich für die Bilderzeugung Modelle der Basis SD1.X, SD2.X und SDXL verwenden. FLUX und SD3.X erscheinen zwar in der Liste, doch beim Start einer Generierung mit diesen Modellen kommt ein Fehler, der besagt, dass diese Basis noch nicht unterstützt wird.

Wenn die Basis von Modell und LoRA nicht zusammenpassen, lässt sich die Schaltfläche zum Starten im Bildschirm **{{ui:app.tabs.generate}}** nicht drücken, und der Grund wird angezeigt.

### Typen

| Typ | Aufgabe |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | Der Hauptteil, der das Bild zeichnet |
| {{ui:models.type.lora}} | Ein kleines Modell, das dem Hauptmodell hinzugefügt wird und einen Stil oder einen Charakter ergänzt |
| {{ui:models.type.vae}} | Ein Baustein für den letzten Schliff von Farben und Details eines Bildes |
| {{ui:models.type.controlnet}} | Legt die Form eines Bildes fest, etwa Pose oder Strichzeichnung |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Übertragen die Stimmung eines Referenzbildes in die Generierung |
| {{ui:models.rail.upscale}} | Dienen dazu, Bilder zu vergrößern |
| {{ui:models.rail.encoders}} | Bausteine, die Text verstehen |
| {{ui:models.rail.diffusion}} | Modelle für Video, etwa Wan, oder für spezielle Abläufe |

Modelle für Video, Musik, Stimme und Logos erscheinen nicht in dieser Liste. Sie werden jeweils in ihrem eigenen Bildschirm heruntergeladen ([Video, Musik, Stimme, Logos](07-media.md)).

## Der Tab Modelle

![Der Tab Modelle. Links die Kategorien, in der Mitte die Modellkarten](shot:models)

Der Tab **{{ui:app.tabs.models}}** ist eine Liste der installierten Modelle.

### Finden

Mit **{{ui:models.rail.title}}** links lässt sich die Liste nach Typ eingrenzen. Rechts steht die Anzahl.

- **{{ui:models.rail.all}}**: Alles
- **{{ui:models.rail.favorites}}**: Alles, was mit einem Stern markiert wurde
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

In der Leiste oben lässt sich nach Namen eingrenzen (**{{ui:models.searchPlaceholder}}**), nach Basis eingrenzen, mit **{{ui:models.sort.label}}** ordnen ({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), zwischen **{{ui:models.view.grid}}** und **{{ui:models.view.list}}** wechseln und die Größe der Vorschaubilder anpassen.

Unten links auf einer Karte stehen Labels für die Basis (SDXL usw.) und das Format. Fährt man mit der Maus über eine Karte, erscheinen ein Stern (Favorit) und ein Menü.

Unten rechts im Bildschirm werden die Anzahl der Modelle und ihre Gesamtgröße angezeigt.

### Modelle hinzufügen

Oben rechts gibt es zwei Schaltflächen.

- **{{ui:models.find}}**: Wechselt zum Tab **{{ui:app.tabs.browse}}** (siehe den Abschnitt weiter unten).
- **{{ui:models.import}}**: Übernimmt vorhandene Dateien oder ein Modell, dessen Adresse bekannt ist.

Beim Drücken von **{{ui:models.import}}** öffnet sich der Bildschirm **{{ui:models.import.title}}**, in dem vier Methoden zur Auswahl stehen.

| Tab | Bedienung |
|---|---|
| {{ui:models.install.tab.source}} | Die Adresse eines Modells oder den Speicherort einer Datei auf dem Computer eingeben und **{{ui:models.install.install}}** drücken |
| {{ui:models.install.tab.scan}} | Den Speicherort eines Ordners eingeben und **{{ui:models.install.scan}}** drücken; die darin enthaltenen Modelle werden aufgelistet. Mit **{{ui:models.install.installAll}}** lassen sich alle auf einmal installieren |
| {{ui:models.install.tab.starter}} | Die App hat Modelle ausgewählt und aufgelistet, die zu Beginn nützlich sind. Modelle, von denen sie abhängen (z. B. ein VAE), werden mitinstalliert |
| {{ui:models.install.tab.huggingface}} | Ein Feld zum Suchen anhand des Hugging-Face-Repository-Namens (`Autor/Name`) |

In das Feld **{{ui:models.install.tab.source}}** lässt sich Folgendes eingeben.

- Die Adresse der Seite eines Modells auf Civitai
- Eine direkte Adresse zu einer Modelldatei (beginnt mit `https://`)
- Der Speicherort einer Datei auf dem Computer (in der Form `C:\models\model.safetensors`)
- Eine Datei von Hugging Face (in der Form `Autor/Name::Dateiname`)

Wird eine Datei auf dem Computer angegeben, wird sie in den Modellordner der App übernommen (auf demselben Laufwerk wächst der Speicherbedarf kaum, auf einem anderen Laufwerk wird sie kopiert).

> Im Tab **{{ui:models.install.tab.huggingface}}** wird nach Eingabe des Repos (`Autor/Name`) und einem Klick auf **{{ui:models.install.hfLookup}}** eine Liste der einzelnen Modelldateien (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) des Repos angezeigt. Dateien in Ordnern einer Diffusers-Pipeline wie `unet` und `vae` erscheinen nicht. Ist ein Hugging-Face-Token hinterlegt, wird die Liste damit abgerufen.

Die Installationen laufen nacheinander ab. Der Fortschritt ist in der **{{ui:models.queue.title}}** zu sehen, die sich öffnet, wenn unten links im Bildschirm **{{ui:models.dock.queue}}** gedrückt wird (bei laufender Arbeit steht dort z. B. „1 in Installation“). Hier lässt sich auch jeder Eintrag einzeln mit **{{ui:models.queue.cancel}}** stoppen, und fertige Einträge lassen sich mit **{{ui:models.queue.prune}}** aufräumen.

Eine Datei, die noch heruntergeladen wird, gelangt erst nach Abschluss in den Modellordner. Auch wenn der Vorgang unterbrochen wird, bleibt keine halbfertige Datei zurück.

### Modelldetails

![Wird ein Modell ausgewählt, erscheinen rechts die Details: Größe, Speicherort, Lizenz, Quelle usw.](shot:models-detail)

Beim Drücken einer Karte öffnen sich rechts die Details. Zum Schließen wird oben rechts **{{ui:models.detail.close}}** gedrückt.

Die Details zeigen den Namen, die Labels für Basis und Typ, die Beschreibung, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (kopierbar), **{{ui:models.details.license}}** und **{{ui:models.details.source}}**.

Mit den Schaltflächen oben lässt sich Folgendes tun.

- **{{ui:models.detail.openSource}}**: Öffnet die Seite des Anbieters im Browser (nur bei Modellen mit Adresse).
- **{{ui:common.edit}}**: Korrigiert Name, Beschreibung, Basis und Typ. Nutzen Sie das, wenn Basis oder Typ nicht automatisch richtig erkannt wurden.
- **{{ui:common.delete}}**: Löscht das Modell (siehe unten).

### Triggerwörter

LoRAs und Ähnliches haben Wörter (Triggerwörter), die wirken, wenn sie in den Prompt eingefügt werden. Werden sie unter **{{ui:models.triggers.title}}** eingetragen, erscheinen die Wörter als Schaltflächen, sobald diese LoRA im Bildschirm **{{ui:app.tabs.generate}}** ausgewählt wird. Ein Druck darauf fügt das Wort dem Prompt hinzu.

Ein Wort ins Eingabefeld schreiben und **{{ui:common.add}}** drücken, um es einzutragen. Mit dem × lässt es sich entfernen. Änderungen werden sofort gespeichert. Bei von Civitai installierten Modellen sind die vom Anbieter angegebenen Wörter mitunter schon von Anfang an eingetragen.

### Standardeinstellungen

Ein Hauptmodell hat **{{ui:models.defaults.title}}**. Das sind Werte, die automatisch eingesetzt werden, wenn dieses Modell im Generierungsbildschirm ausgewählt wird.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Breite und Höhe

Außerdem lassen sich **{{ui:models.defaults.vae}}** und **{{ui:models.defaults.vaePrecision}}** speichern. Gespeichert werden nur die Einträge, deren Schalter eingeschaltet ist. Mit **{{ui:common.save}}** wird bestätigt.

Die empfohlenen Werte unterscheiden sich von Modell zu Modell. Wer die häufig genutzten Modelle einmal einrichtet, muss sie nicht jedes Mal neu anpassen.

### Löschen

Beim Drücken von **{{ui:common.delete}}** erscheint eine Bestätigung. **{{ui:models.deleteWarning}}**

Ein von novira installiertes Modell (eines im Datenordner der App) wird jedoch samt Datei gelöscht, während ein Modell in einem selbst vorbereiteten Ordner nur aus der Liste entfernt wird und die Datei erhalten bleibt.

## Lizenz-Labels

Modelle haben vom Anbieter festgelegte Nutzungsbedingungen (eine Lizenz). novira zeigt deren wichtigste Punkte mit Labels an.

| Label | Bedeutung |
|---|---|
| {{ui:browse.commercial.allowed}} | Der Verkauf der erzeugten Bilder und die Nutzung in Generierungsdiensten sind erlaubt |
| {{ui:browse.commercial.limited}} | Die kommerzielle Nutzung ist an Bedingungen geknüpft (z. B. nur der Verkauf erzeugter Bilder) |
| {{ui:browse.commercial.denied}} | Die kommerzielle Nutzung ist nicht erlaubt. Sie ist auf den privaten Gebrauch beschränkt |

Beim Drücken eines Labels erscheint die Liste **{{ui:browse.permission.title}}**. Dort ist zu sehen, ob z. B. „{{ui:browse.permission.sellImages}}“, „{{ui:browse.permission.sellModel}}“ und „{{ui:browse.permission.shareMerges}}“ jeweils erlaubt, nicht erlaubt oder nicht angegeben sind.

Das Label wird bei Civitai aus den vom Autor festgelegten Nutzungsrechten und bei Hugging Face aus der angezeigten Lizenz bestimmt. Es ist ein Richtwert auf Grundlage der Angaben der Seiten; letztlich sollte der Lizenztext des Anbieters geprüft werden. **{{ui:browse.permission.disclaimer}}**

Ist die Lizenz eines installierten Modells nicht bekannt, wird **{{ui:models.details.licenseUnknown}}** angezeigt.

> Es gibt auch Modelle mit nichtkommerzieller Lizenz. Das Video-Modell **{{ui:video.model.fast}}** hat zum Beispiel eine nichtkommerzielle Lizenz. Wenn erzeugte Bilder oder Videos beruflich oder für den Verkauf genutzt werden, muss die Lizenz des verwendeten Modells unbedingt geprüft werden.

## Der Tab Entdecken

![Der Tab Entdecken. Oben Suchort, Typ, Suchfeld und Filter, darunter die Modellkarten](shot:browse)

Der Tab **{{ui:app.tabs.browse}}** ist ein Bildschirm, mit dem sich Modelle im Internet suchen und direkt herunterladen lassen.

### Suchort

Mit dem Schalter oben links wird der Suchort gewählt.

- **{{ui:browse.source.civitai}}**: Eine Seite, auf der viele Illustrationen und LoRAs versammelt sind.
- **{{ui:browse.source.huggingface}}**: Eine Seite mit vielen Modellen von Forschungseinrichtungen und Unternehmen. Dort lassen sich Modelle nicht über den Namen finden: Fügen Sie die URL der Modellseite (die Seite eines Ordners oder einer Datei genügt) oder `owner/name` in das große Feld in der Mitte des Bildschirms ein und klicken Sie auf **{{ui:models.install.hfLookup}}**. Haken Sie die angezeigten Dateien an und klicken Sie dann oben rechts auf die Installieren-Schaltfläche, um den Download zu starten. Wenn Sie die URL eines Ordners eingefügt haben, werden zunächst nur die Dateien dieses Ordners angezeigt.

Daneben wird die **{{ui:browse.kind.label}}** gewählt. Zur Auswahl stehen **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** und **{{ui:browse.kind.all}}**.

### Filtern

Ins Suchfeld werden Modellname, Autor oder Tag eingegeben. Nach der Eingabe und kurzem Warten werden die Ergebnisse aktualisiert.

Mit den Menüs rechts lassen sich die Ergebnisse eingrenzen.

| Eintrag | Bedeutung |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}} usw. |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | Gesamte Zeit, Jahr, Monat, Woche, Tag (nur bei Civitai) |
| {{ui:browse.nsfw.label}} | Standardmäßig aus. Wenn eingeschaltet, erscheinen auch Modelle für Erwachsene |

Beim Scrollen bis ans Ende werden weitere Ergebnisse geladen. Mit **{{ui:browse.status.loadMore}}** lässt sich ebenfalls nachladen. Konnte nichts abgerufen werden, **{{ui:browse.status.retry}}** drücken.

### Karten lesen und herunterladen

Eine Karte zeigt ein Beispielbild, den Namen des Modells, den Autor, die Anzahl der Downloads, die Anzahl der Likes und das Lizenz-Label. Bei LoRAs werden auch Triggerwörter angezeigt.

- **{{ui:browse.card.download}}**: Lädt die Hauptdatei dieses Modells herunter.
- Das Symbol rechts (**{{ui:browse.card.openCivitai}}**): Öffnet die Seite des Anbieters im Browser.

Beim Drücken einer Karte öffnen sich von rechts die Details. Zu sehen sind Versionen, die Dateiliste (Größe und Format), Triggerwörter, Tags, die Beschreibung und die Lizenz. Eine Version wählen und bei der gewünschten Datei **{{ui:browse.card.download}}** drücken. Ein Druck auf ein Triggerwort kopiert es. Geschlossen wird durch einen Klick daneben oder mit `Esc`.

Beginnt der Download, erscheint unten links im Bildschirm ein kleines Feld mit der Bezeichnung **{{ui:browse.dock.title}}**, in dem der Fortschritt zu sehen ist. Mit **{{ui:browse.dock.cancel}}** lässt er sich stoppen, und fertige Einträge lassen sich mit **{{ui:browse.dock.clear}}** entfernen. Eine Karte, deren Download abgeschlossen ist, wechselt zu **{{ui:browse.card.installed}}** und wird auch der Liste im Tab **{{ui:app.tabs.models}}** hinzugefügt.

> Beim Herunterladen eines Modells, für das eine Anmeldung nötig ist, den Civitai-API-Schlüssel unter **{{ui:settings.title}}** eintragen. Bei Modellen auf Hugging Face, für die eine Zugriffsanfrage nötig ist, tragen Sie das Hugging-Face-Token ein. Beides wird verschlüsselt auf diesem Computer gespeichert und nicht auf dem Bildschirm angezeigt. Einzelheiten unter [KI-Assistent und Einstellungen](09-assistant-settings.md).

Um mit der Bilderzeugung fortzufahren, geht es weiter bei [Bilder erzeugen](02-generate.md).
