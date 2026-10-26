# KI-Assistent, Einstellungen und Tastenkürzel

Dieses Kapitel erklärt den KI-Assistenten, der Einstellungen nach einer Beschreibung in Worten vornimmt, den Einstellungsbildschirm, die Liste der Tastenkürzel, den Bildschirm mit Informationen zur App und das Entwicklerprotokoll.

Der Einstellungsbildschirm, die Tastenkürzel und die Informationen zur App werden über das **{{ui:app.nav.settingsMenu}}** unten links im Bildschirm geöffnet.

## KI-Assistent

![Das Fenster des KI-Assistenten. Der erste Bildschirm, in dem die KI gewählt und die Anmeldung vorgenommen wird](shot:agent)

Beim Drücken der Schaltfläche **KI** (**{{ui:agent.open}}**) in der Navigation links öffnet sich das Fenster **{{ui:agent.title}}**. Das Fenster lässt sich verschieben, indem man seine Titelzeile zieht.

Statt Modelle und LoRAs auszuwählen oder Prompt und Größe selbst festzulegen, genügt es, in Worten zu beschreiben, was erzeugt werden soll, etwa „ein Mädchen im Anime-Stil an einem Strand bei Sonnenuntergang“. Der Assistent wählt dann die Einstellungen aus und trägt sie für Sie ein.

### Erste Schritte (Anmeldung)

Für den KI-Assistenten führt novira keine KI selbst aus, sondern ruft einen KI-Befehl auf dem Computer auf (Claude oder Codex), der die Antworten erstellt. Zur Nutzung ist folgende Vorbereitung nötig.

1. Einen der beiden Befehle auf dem Computer installieren: **Claude** von Anthropic oder **Codex** von OpenAI.
2. Den Assistenten öffnen und den gewünschten Eintrag drücken (**{{ui:agent.setup.claude}}** oder **{{ui:agent.setup.codex}}**).
3. Es öffnet sich ein Browser, in dem die Anmeldung erfolgt.

Wird dieser Befehl auf dem Computer nicht gefunden, erscheint der Hinweis „Der Befehl ○○ wurde auf diesem PC nicht gefunden. Bitte zuerst installieren.“ Installieren Sie diesen Befehl dann zuerst.

Der genutzte Dienst und der zugehörige Vertrag sind die des Anbieters, den Sie gewählt haben. novira speichert keine API-Schlüssel. Was ausgetauscht wird (der gesendete Text, die aktuelle Liste der Modelle und Einstellungen usw.), wird an den gewählten Dienst gesendet.

Die gewählte KI steht in der Titelzeile oben im Fenster. Zum Wechseln drücken Sie oben auf die Schaltfläche **{{ui:agent.changeProvider}}**.

### Was der Assistent übernimmt

Aus dem eingegebenen Text legt der Assistent Folgendes fest und trägt es in die Einstellungen ein. Was eingetragen wurde, erscheint als Liste in der Antwort.

| Was | Beispiel |
|---|---|
| Modellauswahl | Wählt aus den installierten Modellen ein passendes aus |
| LoRA hinzufügen | Fügt eine LoRA hinzu, die zum Stil passt |
| Prompt | Schreibt den Prompt und den Negativ-Prompt |
| Einstellungen ändern | Größe, Schritte, CFG, Scheduler, Seed |
| Workflow | Erstellt einen Graph oder korrigiert den geöffneten Graph |
| Text | Korrigiert den Text und die Sprechblasen, die in **{{ui:media.tab.text}}** geöffnet sind |
| Video, Musik, Stimme | Ändert die Einstellungen des jeweiligen Bildschirms |
| Comic | Ändert in **{{ui:app.tabs.comic}}** die Aufteilung in Bildfelder, fügt Bildfelder hinzu und teilt sie, und ändert Prompt und Pose jedes Bildfelds sowie die Sprechblasen (siehe unten „Hilfe beim Comic“) |
| Pose | Platziert in **{{ui:app.tabs.canvas}}** eine Figur in der Pose, die Sie in Worten wünschen (siehe [Auf der Leinwand weiter zeichnen](05-canvas.md#pose-auf-der-leinwand-erstellen)) |
| Empfehlungen für Erweiterungen | Weist auf Erweiterungen hin, die zum Vorhaben passen, und lässt sie per Schaltfläche installieren |
| Fragen zur App | Antwortet mit den Namen der Bildschirme und sagt, wo zu drücken ist |
| Erweiterungen erklären | Erklärt, was eine Erweiterung kann und wie sie verwendet wird (siehe unten „Fragen zur App und zu Erweiterungen“) |

Der Assistent sieht, welcher Bildschirm gerade geöffnet ist. Ist zum Beispiel **{{ui:media.tab.text}}** geöffnet und sagen Sie „Schreibe den Text vertikal“, ändert sich dieser Text.

Der Assistent ändert nur Einstellungen. Er erzeugt keine Bilder. Sieht das Ergebnis gut aus, genügt ein Druck auf **{{ui:agent.generate}}** in der Antwort, und die Erzeugung beginnt sofort.

### Hilfe beim Comic

Wenn Sie bei geöffnetem **{{ui:app.tabs.comic}}** bitten, liest der Assistent die geöffnete Seite (die Form der Bildfelder, den Prompt jedes Bildfelds, die Posen und die Sprechblasen) und schreibt sie direkt um. Sie können zum Beispiel so bitten.

- Auf „Mach 5 Bildfelder mit einem Höhepunkt. Das erste groß und schräg geteilt“ erstellt er die Aufteilung in Bildfelder. Er kann dafür eine Standardvorlage verwenden oder die Form der Bildfelder selbst festlegen.
- Auf „Schreib zu dieser Geschichte die Prompts für jedes Bildfeld“ schreibt er für jedes Bildfeld einen Prompt mit einem Bildausschnitt, der zum Verlauf der Geschichte passt (Nahaufnahme, Totale, Froschperspektive usw.).
- Auf „Setz in jedes Bildfeld Dialoge“ setzt er Sprechblasen und schreibt die Dialoge hinein.
- Auf „Lass das Mädchen in Bildfeld 2 rennen“ gibt er diesem Bildfeld eine Pose.

Die Bilder selbst zeichnet er nicht. Wenn die Prompts eingetragen sind, klicken Sie auf **{{ui:comic.panel.draw}}** oder **{{ui:comic.page.drawAll}}**. Ein Klick auf **{{ui:agent.undo}}** setzt alle Comicseiten, die diese Antwort geändert hat, auf einmal zurück.

### Modell und Denkaufwand wählen

Mit der kleinen Schaltfläche in Form eines Gehirns rechts neben dem Namen des Chats wählen Sie **{{ui:agent.model.label}}** und **{{ui:agent.effort.label}}**, die der Assistent verwendet. Die Auswahl gilt ab der nächsten gesendeten Nachricht. Claude und Codex merken sich ihre Auswahl getrennt.

- Bei Claude wählen Sie das Modell aus **{{ui:agent.model.default}}**, Fable, Opus, Sonnet und Haiku. Mit **{{ui:agent.model.custom}}** lässt sich der Name eines Modells direkt eingeben. Der Denkaufwand hat 5 Stufen, von **{{ui:agent.effort.low}}** bis **{{ui:agent.effort.max}}**.
- Bei Codex lässt sich das Modell nicht wählen (es gilt die Einstellung des Befehls selbst). Der Denkaufwand ist **{{ui:agent.effort.low}}**, **{{ui:agent.effort.medium}}** oder **{{ui:agent.effort.high}}**.

Bei **{{ui:agent.model.default}}** gilt die Einstellung des Befehls selbst.

### Vorlagen aufrufen

Wenn Sie am Anfang des Eingabefelds „/“ tippen, öffnet sich eine Liste mit Vorlagen für häufige Anfragen. Wenn Sie nach dem „/“ weitertippen, bleiben nur die Vorlagen, deren Name, Befehl oder Text diese Zeichen enthält (zum Beispiel „/Comic“).

Wählen Sie mit den Pfeiltasten nach oben und unten, und bestätigen Sie mit Enter oder Tab. Ein Klick auf eine Zeile der Liste bestätigt ebenfalls. Der Text der gewählten Vorlage kommt ins Eingabefeld; ergänzen Sie den Rest, und senden Sie dann (das Bestätigen allein sendet nichts). Die Esc-Taste schließt die Liste.

### Fragen zur App und zu Erweiterungen

Neben Einstellungen lassen sich auch Fragen stellen. Zum Beispiel „Wie entferne ich einen Hintergrund?“ oder „Wo füge ich ein Modell hinzu?“. Der Assistent antwortet mit den auf dem Bildschirm angezeigten Namen und sagt, wo zu drücken ist. Die Antwort kommt in der gerade verwendeten Sprache.

Auch zu Erweiterungen lassen sich Fragen stellen. Der Assistent erklärt in einfachen Worten, was eine Erweiterung kann, wann sie sich eignet und wie sie verwendet wird. Es gibt drei Wege zu fragen.

- In der Liste unter **{{ui:app.nav.extensions}}** eine Karte drücken, um die Details zu öffnen, und dann **{{ui:agent.ask.button}}** drücken. Eine Frage zu dieser Erweiterung wird in einem neuen Chat gesendet.
- Im Suchfeld oben unter **{{ui:app.nav.extensions}}** ein Wort eingeben und dann das erscheinende **{{ui:agent.ask.resultsButton}}** drücken. Der Assistent erklärt die Unterschiede zwischen den gefundenen Erweiterungen (bis zu den ersten 8) und mit welcher sich der Einstieg lohnt.
- Im Chat den Namen einer Erweiterung (in lateinischen Buchstaben) schreiben und fragen. Der Assistent sucht unter den veröffentlichten Erweiterungen nach solchen, deren Name oder Beschreibung passt, und antwortet (ist die Liste noch nicht geladen, wird sie dann geladen).

Bei einer installierten Erweiterung nennt der Assistent auch die Namen der hinzugefügten Nodes und womit sie zu verbinden sind. Bei einer noch nicht installierten Erweiterung wird der Antwort eine Karte beigefügt, und sie lässt sich direkt mit **{{ui:workflows.packs.install}}** installieren.

> Die Erklärung beruht auf der veröffentlichten Beschreibung und den Node-Informationen der Erweiterung. Was der Assistent nicht weiß, sollte er als „weiß ich nicht“ beantworten, doch er kann sich auch irren. Vor der Installation sollte die Seite des Anbieters geprüft werden.

### Rückgängig machen

Eine Antwort, die Einstellungen eingetragen hat, erhält eine Schaltfläche **{{ui:agent.undo}}**. Ein Druck darauf setzt die Einstellungen auf den Stand vor dieser Antwort zurück.

Nach einem Neustart der App lassen sich frühere Änderungen jedoch nicht mehr rückgängig machen (die Schaltfläche lässt sich nicht mehr drücken).

### Chatverlauf

Der Austausch mit dem Assistenten bleibt als „Chat“ erhalten. Beim Drücken auf den Namen des Chats oben im Fenster öffnet sich die Liste **{{ui:agent.session.history}}**.

- Wird ein Eintrag aus der Liste gewählt, lässt sich das Gespräch an der Stelle fortsetzen, an der dieser Chat aufgehört hat.
- Mit **{{ui:agent.session.rename}}** lässt sich ein Name vergeben.
- Mit **{{ui:agent.session.delete}}** lässt er sich entfernen.
- Mit **{{ui:agent.session.new}}** daneben lässt sich ein neuer Chat beginnen.

> Solange auf eine Antwort gewartet wird, lässt sich nichts weiter senden. Entweder abwarten, bis die Anzeige „{{ui:agent.thinking}}“ verschwindet, oder die Schaltfläche **{{ui:agent.stop}}** drücken, die an die Stelle der Senden-Schaltfläche tritt. Eine abgebrochene Anfrage ändert keine Einstellungen.

Durch Ziehen an einer beliebigen der vier Kanten oder vier Ecken des Fensters lässt sich die Größe ändern. Die rechte untere Ecke zeigt dafür eine Markierung. Die Größe wird gemerkt. Wenn eine Antwort den Gedankengang der KI mitbringt, erscheint er als eine Zeile über der Antwort. Ein Druck darauf öffnet die ganze Darstellung (**{{ui:agent.thoughts.label}}**). Es ist eine kurze Zusammenfassung der KI darüber, wie sie die Anfrage gelesen hat und warum sie so entschieden hat, nicht ihr unverändertes internes Denken.

## Einstellungen

![Der Einstellungsbildschirm. Die Bereiche Allgemein, Konten, Generierung, Oberfläche und Entwickler sind aufgelistet](shot:settings)

Wird **{{ui:app.nav.settings}}** über das **{{ui:app.nav.settingsMenu}}** unten links gewählt, öffnet sich der Einstellungsbildschirm. Änderungen werden sofort verwendet und bleiben auch nach dem Schließen der App erhalten.

> Dieses Bild zeigt einen Beispielbildschirm, der im Browser läuft. **{{ui:settings.uiZoom.label}}**, das es nur in der Desktop-Version gibt, ist darauf nicht zu sehen.

### {{ui:settings.section.general}}

| Eintrag | Bedeutung |
|---|---|
| {{ui:settings.language.label}} | Auswahl aus {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} und {{ui:settings.language.de}}. Die Sprache des Bildschirms wechselt sofort |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (Standard) oder **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

Diese Felder sind für den Fall gedacht, dass eine Seite, die Modelle bereitstellt, eine Anmeldung verlangt. Das Eingegebene wird verschlüsselt auf diesem Computer gespeichert und nicht auf dem Bildschirm angezeigt.

| Eintrag | Bedeutung |
|---|---|
| {{ui:settings.civitaiKey.label}} | Wird zum Herunterladen von Modellen verwendet, für die eine Anmeldung nötig ist |
| {{ui:settings.hfToken.label}} | Wird zum Herunterladen von Modellen verwendet, für die eine Zugriffsanfrage nötig ist |

Einfügen und **{{ui:settings.civitaiKey.save}}** drücken. Später sind auch **{{ui:settings.civitaiKey.change}}** und **{{ui:settings.civitaiKey.remove}}** möglich.

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**: Zeigt Bilder während der Erzeugung im Rahmen „{{ui:gallery.generating.title}}“ der Galerie weich an. Ist der Schalter aus, erscheinen sie als grobe Punkte.
- **{{ui:settings.lowMemory.label}}**: Für Computer, deren GPU wenig Speicher hat. Ist der Schalter an, bleiben Modelle nicht im GPU-Speicher, sodass weniger Speicher genügt, die Erzeugung aber langsamer ist. Beim Umschalten wird die Engine neu gestartet. Ist gerade ein Eintrag in Arbeit, gilt die Einstellung ab dem nächsten Start der Engine. Sie lässt sich nicht verwenden, solange die App mit einer anderswo gestarteten Engine verbunden ist.

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}** (nur Desktop-Version): Die Größe des gesamten Bildschirms. Zur Auswahl stehen 50 % bis 300 %. Sie lässt sich auch mit `Ctrl` und `+` / `-` ändern.
- **{{ui:settings.confirmOnDelete}}**: Zeigt vor dem Löschen eines Bildes eine Bestätigung. Auch wenn im Bestätigungsbildschirm „{{ui:common.dontAskAgain}}“ gewählt wird, wird dieser Schalter ausgeschaltet.

### {{ui:share.backup.section}}

![Der Bereich Sicherung in den Einstellungen: die Schaltflächen zum Erstellen einer Sicherung und zum Wiederherstellen aus einer Sicherung](shot:settings-backup)

Die erzeugten Bilder und alles, was in der App eingestellt und registriert wurde, lassen sich in einer einzigen ZIP-Datei speichern. Sie dient dem Umzug auf einen anderen Computer oder als Vorsorge für den Notfall.

- **{{ui:share.backup.createLabel}}**: Es öffnet sich ein Fenster zur Wahl des Speicherorts. Der Dateiname lautet von Anfang an „novira-backup-Datum-Uhrzeit.zip“. Bei vielen Bildern dauert es eine Weile, und der Fortschritt wird in diesem Bereich angezeigt.
- **{{ui:share.backup.restoreLabel}}**: Hier wird die ZIP-Datei einer Sicherung gewählt. Nach der Prüfung des Inhalts erscheint ein Bestätigungsfenster.

Was in einer Sicherung enthalten ist und was nicht:

| Enthalten | Nicht enthalten |
|---|---|
| Bilder, Videos und Audio der Galerie samt Vorschaubildern | Modelle |
| Boards, Workflows, Comics und die Aufzeichnungen der Warteschlange | Die Bild-Engine (ComfyUI) und Erweiterungen |
| Charaktere, Vorgaben, die Prompt-Liste, Entwürfe, die Chats des KI-Assistenten und die Bildschirmeinstellungen | API-Schlüssel und Tokens sowie Einstellungen, die zu diesem Computer gehören (etwa der Speicherort von ComfyUI) |

![Die Bestätigung der Wiederherstellung: Zeitpunkt der Sicherung, Anzahl der Inhalte und der Hinweis auf das Ersetzen](shot:restore-confirm)

Das Bestätigungsfenster zeigt, wann die Sicherung erstellt wurde und wie viele Bilder, Boards und Workflows sie enthält. Nach einem Druck auf **{{ui:share.backup.confirm}}** wird die App beendet und neu gestartet, und die aktuellen Daten werden durch den Inhalt der Sicherung ersetzt. Schlägt das fehl, werden die ursprünglichen Daten wiederhergestellt, und es wird eine Meldung angezeigt.

> Ersetzte Daten lassen sich nicht zurückholen. Bei Bedarf vor der Wiederherstellung eine Sicherung des aktuellen Stands erstellen. API-Schlüssel und Tokens sind nur für diesen Computer verschlüsselt und müssen daher nach der Wiederherstellung unter **{{ui:settings.section.accounts}}** erneut eingegeben werden. Im Browser wird eine JSON-Datei ohne Bilder heruntergeladen, und eine Wiederherstellung ist nicht möglich.

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**: Zeigt in der Navigation links eine Schaltfläche „{{ui:app.devlog.short}}“ an (siehe unten „Entwicklerprotokoll“).
- **{{ui:settings.clearIntermediates}}**: Löscht Bilder, die nicht in der Galerie erscheinen, etwa Zwischenergebnisse der Leinwand. Die Anzahl der zu löschenden Bilder steht auf der Schaltfläche.
- **{{ui:settings.resetWebUi}}**: Setzt die Einstellungen und den Zustand des Bildschirms auf die Anfangswerte zurück. Bilder und Modelle werden nicht gelöscht. Nach dem Drücken mit **{{ui:settings.resetConfirm}}** bestätigen und mit **{{ui:settings.reload}}** neu laden.

Der Einstellungsbildschirm enthält außerdem die Schalter „{{ui:settings.useCpuNoise}}“, „{{ui:settings.enableInformationalPopovers}}“, „{{ui:settings.enableImageDebugging}}“ und „{{ui:settings.clearIntermediatesOnStartup}}“. In der aktuellen Version verändern diese weder die Generierung noch das Verhalten des Bildschirms.

Ganz unten im Bildschirm wird die Version der App angezeigt.

## Tastenkürzel

![Die Liste der Tastenkürzel. Aktionen und Tasten sind nach Kategorien wie App und Leinwand aufgelistet](shot:hotkeys)

Wird **{{ui:app.nav.hotkeys}}** über das **{{ui:app.nav.settingsMenu}}** unten links gewählt oder `Shift+?` gedrückt, öffnet sich die Liste. Mit dem Suchfeld oben lässt sich nach Aktionsnamen oder Tasten suchen.

Hier sind die häufig genutzten zusammengefasst. Alle sind in der Liste auf dem Bildschirm nachzusehen.

### Gesamte App

| Taste | Aktion |
|---|---|
| `Ctrl+Enter` | Generieren (zur Warteschlange hinzufügen) |
| `Ctrl+Shift+Enter` | Vorn in der Warteschlange einfügen und generieren |
| `Shift+X` | Den Eintrag in Arbeit abbrechen |
| `Ctrl+Shift+X` | Die gesamte Warteschlange leeren |
| `Alt+A` | Zum Prompt-Feld wechseln |
| `T` | Linkes Bedienfeld öffnen und schließen |
| `G` | Rechtes Bedienfeld öffnen und schließen |
| `F` | Beide Bedienfelder gemeinsam öffnen und schließen |
| `1` bis `9`, `0` | Zum Tab mit dieser Nummer wechseln |
| `Shift+?` | Liste der Tastenkürzel öffnen |
| `Ctrl` + `+` / `-` | Den gesamten Bildschirm vergrößern und verkleinern |

### Leinwand

| Taste | Aktion |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Ansicht verschieben |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Pinsel verkleinern und vergrößern |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Zwischen dem aktuellen und dem zuvor verwendeten Werkzeug wechseln |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### Galerie und Betrachter

| Taste | Aktion |
|---|---|
| Pfeiltasten | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (alles außer dem Seed laden) |
| `P`, `S`, `A` | Prompt, Seed bzw. alles laden |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Workflows

| Taste | Aktion |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Gewählte Nodes und Verbindungen löschen |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Während in ein Feld getippt wird, funktionieren Einzeltasten wie `T` und `G` nicht.

## Über diese App

![Der Bildschirm mit Informationen zur App. Logo, Version, Lizenz und die Liste der verwendeten Open-Source-Software](shot:about)

Wenn Sie unten links im **{{ui:app.nav.settingsMenu}}** den Eintrag **{{ui:app.nav.about}}** wählen, erscheinen oben der Name der App, ihre Version, ihre Lizenz und das Copyright. Darunter gibt es zwei Registerkarten.

- **{{ui:settings.about.license.title}}**: der vollständige Text der Lizenz von novira (Apache License 2.0). Der Installationsordner enthält dieselbe Datei (`LICENSE`).
- **{{ui:settings.about.oss.title}}**: die Open-Source-Software, die die App verwendet. Jede Zeile zeigt Name und Version. Ein Klick auf **{{ui:settings.about.oss.showLicense}}** zeigt den vollständigen Lizenztext unter der Zeile (ein erneuter Klick schließt ihn). Ein Klick auf **{{ui:settings.about.oss.homepage}}** öffnet die Seite im Browser. Die Generierungs-Engine und Erweiterungen sind nicht in der App enthalten; ihre vollständige Lizenz steht auf ihrer Homepage.

Die Schaltflächen über der Liste schränken sie auf **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** oder **{{ui:settings.about.oss.short.packs}}** (die gerade installierten Erweiterungen) ein. Das Suchfeld findet Software nach Name. Die vollständigen Lizenztexte der enthaltenen Software stehen auch gesammelt in `THIRD_PARTY_NOTICES.txt` im Installationsordner.

Erweiterungen (benutzerdefinierte Knoten von ComfyUI) und Modelle unterliegen bei der Installation der Lizenz ihres jeweiligen Anbieters.

## Entwicklerprotokoll

Dies ist ein Protokoll, mit dem sich die Ursache suchen lässt, wenn etwas nicht gut funktioniert. Im Alltag muss es nicht genutzt werden.

Wird **{{ui:settings.showDevLog}}** unter **{{ui:settings.title}}** eingeschaltet, erscheint in der Navigation links die Schaltfläche „{{ui:app.devlog.short}}“. Ein Druck darauf öffnet rechts das Bedienfeld **{{ui:app.devlog.title}}**.

Hier sind interne Aufzeichnungen der App (das Backend-Log), Warnungen auf dem Bildschirm und nicht abgefangene Fehler mit Uhrzeit aufgelistet.

- Mit der Auswahl oben lässt sich auf **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** oder **{{ui:app.devlog.level.error}}** eingrenzen.
- Wird im Filterfeld ein Wort eingegeben, werden nur die Zeilen angezeigt, die dieses Wort enthalten.
- Mit **{{ui:app.devlog.copy}}** lassen sich die angezeigten Zeilen als Text kopieren. Beim Melden eines Problems kann er eingefügt werden.
- Mit **{{ui:app.devlog.clear}}** lässt sich das Log leeren.

> Das Protokoll ist eine Aufzeichnung für die Zeit, in der die App geöffnet ist. Beim Schließen verschwindet das Log auf dem Bildschirm. Ausführlichere Wege der Fehlersuche finden sich unter [Hilfe bei Problemen](10-troubleshooting.md).
