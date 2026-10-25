# Hilfe bei Problemen

Dieses Kapitel fasst zusammen, welche Ursachen es gibt, wenn etwas nicht klappt, und was sich versuchen lässt. Am besten anhand der Wörter suchen, die auf dem Bildschirm erscheinen.

Zuerst geben die folgenden beiden Stellen oft einen Hinweis auf die Ursache.

- Der Tab **{{ui:app.tabs.queue}}**: Bei einem fehlgeschlagenen Eintrag steht dort der Grund (siehe [unten](#generierung-schlägt-fehl)).
- {{ui:app.devlog.title}}: Eine Aufzeichnung der Interna der App (siehe [KI-Assistent und Einstellungen](09-assistant-settings.md)).

## Start und Engine

Zum Erzeugen von Bildern und mehr nutzt novira eine „Bild-Engine“ (ComfyUI und das Python, das sie ausführt). Die App installiert die Engine selbst und startet sie selbst.

### Der Start dauert lange

Beim ersten Start dauert es eine Weile, weil die Engine heruntergeladen und entpackt werden muss. **{{ui:engine.firstRunNote}}**

Im ersten Bildschirm erscheinen drei Phasen: **{{ui:splash.step.downloading}}**, **{{ui:splash.step.extracting}}** und **{{ui:splash.step.starting}}**. Während des Downloads werden auch Größe, Geschwindigkeit und verbleibende Zeit angezeigt. Bitte warten, bis der Vorgang abgeschlossen ist.

Ist die Engine bereit, wechselt der Bildschirm. Ab dem zweiten Mal dauert es nur die kurze Zeit vom Start, bis die Engine antwortet.

### Meldungen am oberen Bildschirmrand

Während die Engine vorbereitet wird oder wenn etwas schiefgegangen ist, erscheint am oberen Bildschirmrand eine Meldung.

| Meldung | Bedeutung |
|---|---|
| {{ui:engine.title.downloading}} | Die Engine wird heruntergeladen. Sie umfasst mehrere GB. Bei einer langsamen Verbindung dauert es entsprechend |
| {{ui:engine.title.extracting}} | Die heruntergeladenen Dateien werden entpackt |
| {{ui:engine.title.starting}} | Die Engine wird gestartet, und es wird auf die Verbindung gewartet |
| {{ui:engine.title.error}} | Die Vorbereitung ist fehlgeschlagen. Der Grund erscheint darunter |

### Die Meldung „{{ui:engine.title.error}}“ erscheint

Erscheint sie im ersten Bildschirm beim Start, öffnet ein Druck auf **{{ui:splash.open}}** die App ohne die Engine. In dem Fall lassen sich keine Bilder und Ähnliches erzeugen, aber Bilder ansehen und Modelle ordnen ist möglich.

Was sich versuchen lässt:

1. Den Text des Grundes lesen. Prüfen, ob eine Internetverbindung besteht und ob Speicherplatz frei ist.
2. Es erneut versuchen. Auch nach einer fehlgeschlagenen Vorbereitung der Engine versucht die App beim nächsten Start einer Generierung, sie erneut vorzubereiten. Hilft das nicht, die App schließen und neu öffnen.
3. Ist der Download abgeschlossen und nur das Entpacken fehlgeschlagen, bleiben die heruntergeladenen Dateien erhalten, sodass ein neuer Versuch beim Entpacken fortfährt.
4. Sicherheitssoftware prüft möglicherweise die neuen Dateien und hält das Entpacken an. Die App versucht es automatisch mehrmals erneut. Tritt es weiter auf, den Datenordner (siehe unten) von der Prüfung ausnehmen oder die Software vorübergehend ausschalten.
5. Steht im Grund „see logs/comfyui.log“, enthält das Log der Engine einen ausführlichen Grund ([Logs lesen](#logs-lesen)).

> Die Engine ist ComfyUI für Windows, und standardmäßig wird die Version für NVIDIA-GPUs installiert. Es gibt auch Einstellungen für eine AMD-GPU oder ein selbst installiertes ComfyUI, doch diese sind für fortgeschrittene Nutzer gedacht ([Erweiterte Einstellungen](#erweiterte-einstellungen)).

### Die Engine scheint mittendrin stehen geblieben zu sein

Die Wartezeit zwischen dem Start der Engine und ihrer Antwort beträgt standardmäßig 3 Minuten. Danach erscheint ein Fehler mit der Bedeutung „ComfyUI did not answer in time“. Wurde die Engine mitten im Start beendet, erscheint „ComfyUI exited while starting“. In beiden Fällen bleibt der Grund im Log der Engine (`comfyui.log`) erhalten.

## Generieren nicht möglich

### Die Schaltfläche zum Starten lässt sich nicht drücken

Fährt man im Bildschirm **{{ui:app.tabs.generate}}** mit der Maus über die Schaltfläche zum Starten, erscheint unter **{{ui:params.invoke.cannotInvoke}}** eine Liste von Gründen. In den Bildschirmen für Video, Musik, Stimme und Logos stehen die Gründe unter der Schaltfläche. Werden die angezeigten Gründe nacheinander behoben, lässt sich die Schaltfläche drücken.

| Angezeigter Grund | So wird er behoben |
|---|---|
| {{ui:params.readiness.noModel}} | Ein Modell wählen. Ist keines installiert, weiter bei „Es ist kein Modell installiert“ unten |
| {{ui:params.readiness.loraMissing}} | Die gewählte LoRA wird nicht gefunden. Möglicherweise wurde sie gelöscht oder verschoben. Die LoRA neu wählen oder entfernen |
| LoRA „○○“ ist mit dem Modell nicht kompatibel | Die Basis (SDXL, SD1.X usw.) ist verschieden. Eine LoRA mit derselben Basis verwenden oder sie entfernen |
| Referenzbild ○: kein Bild oder kein Modell gewählt | Im Feld für das Referenzbild ein Bild und ein Modell einsetzen |
| Referenzbilder benötigen die Erweiterung ○○ | Die Erweiterung über den Hinweis im Feld für das Referenzbild installieren ([Eine Erweiterung fehlt](#eine-erweiterung-fehlt)) |
| {{ui:params.readiness.upscaleNoImage}} | Ein Bild für das Upscaling wählen |
| {{ui:params.readiness.upscaleNoModel}} | Ein Modell für das Upscaling wählen. Ist keines installiert, lässt sich unter **{{ui:models.install.tab.starter}}** im Tab {{ui:app.tabs.models}} eines installieren |
| {{ui:video.problem.prompt}}, {{ui:music.problem.tags}}, {{ui:voice.problem.text}}, {{ui:logo.problem.text}} | Ein Pflichtfeld ist leer. Bitte ausfüllen |
| {{ui:video.problem.image}} | Im Modus „Aus Bild“ wurde kein Bild zum Animieren gewählt |
| {{ui:voice.problem.description}} | Im Modus „Stimme beschreiben“ ist die Beschreibung der Stimme leer |
| {{ui:video.problem.pack}}, {{ui:music.problem.pack}}, {{ui:voice.problem.pack}}, {{ui:logo.problem.pack}} | Die zugehörigen Modelle sind nicht installiert. Weiter beim nächsten Punkt |

### Die Modelle für Video, Musik, Stimme oder Logos sind nicht installiert

Im linken Bedienfeld des jeweiligen Bildschirms erscheint eine Karte; dort **{{ui:pack.install}}** drücken. Bis die Installation abgeschlossen ist, lässt sich nichts erzeugen.

- Schlägt der Download zwischendurch fehl, wechselt die Schaltfläche auf der Karte zu **{{ui:pack.retry}}**. Ein Druck darauf startet einen neuen Versuch.
- Bei der Stimme wird auch die Engine zum Vorlesen installiert. Die Vorbereitung der Bild-Engine muss zuvor abgeschlossen sein.
- Das schnelle Video-Modell ist ein eigener Download, getrennt vom Standard-Video-Modell.

Einzelheiten stehen unter [Video, Musik, Stimme, Logos](07-media.md).

### Es ist kein Modell installiert

Zeigt der Tab **{{ui:app.tabs.models}}** die Meldung **{{ui:models.empty.title}}**, ist kein einziges Modell vorhanden.

- Unter **{{ui:models.install.tab.starter}}** in **{{ui:models.import}}** lässt sich das erste Modell installieren.
- Im Tab **{{ui:app.tabs.browse}}** lässt sich auch ein gewünschtes Modell suchen und herunterladen.
- Sind bereits Modelldateien vorhanden, lässt sich mit **{{ui:models.install.tab.scan}}** in **{{ui:models.import}}** ein ganzer Ordner übernehmen.

Einzelheiten stehen unter [Modelle verwalten und finden](08-models.md).

### Eine Erweiterung fehlt

Bei manchen Funktionen erscheint ein Hinweis, dass eine bestimmte Erweiterung benötigt wird. Dazu gehören das Korrigieren von Gesichtern, das Auswählen eines Bereichs, das Entfernen eines Hintergrunds, das Ergänzen von Videoframes und die Verwendung von Referenzbildern.

1. Neben der Meldung **{{ui:params.refImage.installPack}}** drücken.
2. Ist die Installation abgeschlossen, **{{ui:params.refImage.restartEngine}}** drücken, um die Engine neu zu starten.
3. Nach dem Neustart den Vorgang erneut versuchen.

Erweiterungen lassen sich auch als Liste unter **{{ui:workflows.panel.packs}}** im Tab **{{ui:app.tabs.workflows}}** installieren und entfernen.

> Ist die App mit einer selbst vorbereiteten Engine verbunden und nicht mit der von der App installierten, kann die App keine Erweiterungen installieren. Sie müssen dann bei dieser Engine installiert werden.

### Die GPU hat zu wenig Speicher oder konkurriert mit anderen Apps

Bilder, Videos und Musik nutzen die GPU des Computers. Verwenden andere Apps (Spiele, Videobearbeitung, Videos im Browser usw.) die GPU, kann der Speicher knapp werden und zu Fehlern führen.

Bei Speichermangel kann der Fehler die Buchstaben „OOM“ (Out of Memory, also Speichermangel) enthalten.

Schlägt ein Auftrag wegen Speichermangels fehl, erkennt die App das und zeigt den Hinweis **{{ui:queue.oom.title}}**. Er erscheint über der Galerie, unter dem fehlgeschlagenen Eintrag im Tab **{{ui:app.tabs.queue}}**, in den Bildschirmen für Video, Musik, Stimme und Logos sowie als Benachrichtigung unten rechts.

![Der Hinweis auf zu wenig GPU-Speicher, mit den Schaltflächen zum erneuten Versuch in kleinerer Größe und zum Neustart im Sparmodus](shot:out-of-memory)

Mit den Schaltflächen des Hinweises lässt sich eines von beidem versuchen:

- **{{ui:queue.oom.retrySmaller}}**: Erzeugt das Bild mit denselben Einstellungen und demselben Seed erneut, bei gleichem Seitenverhältnis mit etwa 75 % der Fläche. Das erscheint nur bei Bildern, die in einer festgelegten Größe erzeugt werden (nicht bei Video, Musik, Stimme, Logos und Upscaling).
- **{{ui:queue.oom.lowMemory}}**: Schaltet **{{ui:settings.lowMemory.label}}** ein (siehe [KI-Assistent und Einstellungen](09-assistant-settings.md)) und startet die Engine neu. Ist gerade ein Eintrag in Arbeit, gilt die Einstellung ab dem nächsten Start der Engine. Ist der Modus bereits eingeschaltet, erscheint die Schaltfläche nicht.

Nachdem ein Auftrag wegen Speichermangels fehlgeschlagen ist, bittet die App die Engine, die geladenen Modelle zu entladen und den Speicher freizugeben. Der nächste Auftrag beginnt daher mit dem Laden des Modells und dauert etwas länger.

Was sich versuchen lässt:

- Andere Apps schließen, die die GPU nutzen, etwa Spiele oder Videobearbeitung, und erneut erzeugen.
- Die Bildgröße verkleinern.
- Weniger LoRAs und Referenzbilder verwenden.
- Video in kleinerer Größe erzeugen und danach mit **{{ui:video.finish}}** vergrößern. Auch **{{ui:video.light.fp8}}** und **{{ui:video.light.tiled}}** unter **{{ui:video.light.title}}** lassen sich ausprobieren.
- Die App neu öffnen, um den belegten Speicher freizugeben.

Das Stimmmodell wird aus der GPU entfernt, wenn es eine Weile nicht benutzt wurde. Die Erzeugung läuft einzeln nacheinander ab.

### Generierung schlägt fehl

Schlägt das Erzeugen eines Bildes, Videos, von Musik oder Ähnlichem fehl, erhält der Eintrag im Tab **{{ui:app.tabs.queue}}** den Status **{{ui:queue.status.failed}}**. Ein Druck auf den Eintrag öffnet ihn, und der Grund erscheint unter **{{ui:queue.detail.error}}**. In den Bildschirmen für Video, Musik, Stimme und Logos erscheinen außerdem oben in der Mitte eine Fehleranzeige und der Grund (bis zu den letzten 3).

Ist der Grund bekannt, lässt sich mit der Schaltfläche **{{ui:queue.action.retry}}** des Eintrags mit denselben Einstellungen erneut versuchen.

Der Text des Grundes stammt aus dem Inneren der Engine oder der App und kann daher auf Englisch sein. Hier die häufigsten.

| Text des Grundes (sinngemäß) | Bedeutung und was sich versuchen lässt |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | Die Engine findet dieses Modell nicht. Die Modelldatei wurde verschoben, oder die Einstellung für die Suchordner passt nicht. Im Tab Modelle erneut installieren oder den Speicherort prüfen |
| ComfyUI is not reachable at ... | Die Verbindung zu der separat vorbereiteten Engine ist nicht möglich. Prüfen, ob diese Engine läuft |
| ComfyUI exited while starting / did not answer in time | Die Engine lässt sich nicht starten. Das Log der Engine ansehen |
| ... OOM | Die GPU hat zu wenig Speicher. Siehe den vorherigen Punkt |
| ... models are not supported by the ComfyUI backend yet | FLUX- und SD3.X-Modelle lassen sich für die Bilderzeugung noch nicht verwenden. Ein SDXL- oder SD1.X-Modell wählen |
| Reference images need the ... custom node pack | Die für Referenzbilder nötige Erweiterung ist nicht installiert |
| This ComfyUI is too old for video / music | Der verwendeten Engine fehlen Funktionen, die für Video oder Musik nötig sind. Bei der von der App installierten Engine kommt das nicht vor. Bei einer selbst vorbereiteten Engine aktualisieren |
| The video / music / logo models are not installed yet | Die zugehörigen Modelle sind nicht installiert. Im jeweiligen Bildschirm herunterladen |
| ComfyUI has no ... node; install the custom node pack | Die Erweiterung für einen im Workflow verwendeten Node ist nicht installiert |
| Interrupted because novira was closed | Die App wurde mitten in der Erzeugung geschlossen. Erneut erzeugen |

### Das Bild wurde erzeugt, ist aber nicht zu sehen

Zeigt die Erzeugung den Status **{{ui:queue.status.completed}}**, doch in der Galerie erscheint nichts, Folgendes prüfen.

- **Ein anderes Board**: Neue Bilder gehen in das Board mit der Markierung **{{ui:gallery.boards.autoBadge}}** (standardmäßig **{{ui:gallery.boards.uncategorized}}**). Ist ein anderes Board geöffnet, erscheinen sie dort nicht. Das Board wechseln oder mit **{{ui:gallery.boards.setAutoAdd}}** erneut das Board wählen, in das neue Bilder gelangen.
- **Logos landen unter „Assets“**: Logos landen unter **{{ui:gallery.view.assets}}**, nicht unter **{{ui:gallery.view.images}}**.
- **Wie Video und Audio aussehen**: Videos erscheinen als Vorschaubild mit ▶, Audio mit ♪. Sie sind verborgen, wenn eine Suche oder ein Filter aktiv geblieben ist.

Wird es dennoch nicht gefunden, im Tab **{{ui:app.tabs.queue}}** die Spalte **{{ui:queue.col.destination}}** des Eintrags prüfen. Ein Eintrag mit dem Ausgabeziel **{{ui:queue.destination.canvas}}** erscheint auf der Leinwand, nicht in der Galerie.

## Speicherort der Daten und Sicherung

### Wo die Daten liegen

Bilder, Modelle und Aufzeichnungen liegen alle in einem Ordner namens **`novira-data`**. Der Speicherort ist wie folgt.

- Ausgelieferte Version: der bei der Installation gewählte Ordner. Standardmäßig ist es `novira-data` im selben Ordner wie die ausführbare Datei der App (`novira.exe`).
- Version in Entwicklung: `novira-data` im obersten Ordner des Repositorys.

Mit der Umgebungsvariablen `NOVIRA_DATA_DIR` lässt sich ein anderer Ort festlegen.

| Ordner oder Datei | Inhalt |
|---|---|
| `outputs` | Die erzeugten Bilder, Videos und Audiodateien |
| `novira.sqlite` | Aufzeichnungen wie Bildinformationen, Boards, die Warteschlange, die Liste der Modelle und Workflows |
| `thumbnails` | Verkleinerte Bilder |
| `models` | Die installierten Modelle |
| `comfyui` | Die von der App installierte Bild-Engine |
| `cache` | Temporäre Daten, die die Engine verwendet |
| `voice` | Die Bibliothek zum Vorlesen von Sprache |
| `logs` | Logs (siehe unten) |
| `settings.json` | Einstellungen für fortgeschrittene Nutzer (die Datei muss nicht vorhanden sein) |
| `secrets` | API-Schlüssel und Tokens (verschlüsselt) |
| `agent.json` | Die Art der KI, die für den KI-Assistenten gewählt wurde |

Die von der App installierte Engine (ComfyUI und Python) und ihre Arbeitsdaten liegen ebenfalls im Datenordner.

Die Bildschirmeinstellungen der App (Sprache, Design, Vorgaben, der Verlauf der KI-Chats usw.) liegen nicht in `novira-data`, sondern im Speicher der Benutzeroberfläche.

### Sicherung

novira hat eine Funktion zum Erstellen einer Sicherung und eine Funktion zum Wiederherstellen aus einer Sicherung. Um wichtige Bilder zu schützen, in den Einstellungen den Bereich **{{ui:share.backup.section}}** verwenden (siehe [KI-Assistent und Einstellungen](09-assistant-settings.md#sicherung)). Eine Sicherung enthält die erstellten Bilder und das, was in der App eingestellt und registriert wurde, aber nicht die Modelle und die Bild-Engine. Sollen auch diese erhalten bleiben, den Ordner selbst kopieren.

1. Die App schließen (und prüfen, dass gerade nichts erzeugt wird).
2. Den gesamten Ordner `novira-data` auf ein anderes Laufwerk oder Ähnliches kopieren.

Groß sind vor allem `models` und `comfyui`. Sollen nur die Bilder und Aufzeichnungen erhalten bleiben, sind `outputs` und `novira.sqlite` die Hauptteile. Modelle in `models` lassen sich oft erneut von der Quelle herunterladen, doch bei solchen, deren Bereitstellung beendet wurde, ist das mitunter nicht möglich.

> API-Schlüssel und Tokens sind mit einer Windows-Funktion verschlüsselt. Auf einem anderen Computer oder bei einem anderen Benutzer sind sie mitunter nicht lesbar; in dem Fall in den Einstellungen erneut eingeben.

Die Bildschirmeinstellungen der App, Vorgaben und der Verlauf der KI-Chats sind in dieser Kopie nicht enthalten, aber in einer Sicherung.

## Logs lesen

Logs lassen sich an drei Stellen einsehen.

| Ort | Inhalt |
|---|---|
| {{ui:app.devlog.title}} (in der App) | Die internen Aufzeichnungen der App sowie Warnungen und Fehler auf dem Bildschirm. Die Anzeige wird in den Einstellungen eingeschaltet ([KI-Assistent und Einstellungen](09-assistant-settings.md)) |
| `novira-data\logs\novira.log` | Die eigene Aufzeichnung der App. Wird sie groß (über 2 MB), wandert sie nach `novira.log.1` |
| `novira-data\logs\comfyui.log` | Die Aufzeichnung der Bild-Engine. Hier erscheint der Grund, wenn sie sich nicht starten lässt oder die Generierung fehlschlägt |

In einem Log werden neue Zeilen unten angefügt. Ist etwas passiert, ganz unten nachsehen. Zeilen mit „error“ oder „failed“ sind die Hinweise.

## Ein Problem melden

Liegt Folgendes vor, lässt sich die Ursache schneller finden.

1. **Was getan wurde und was passiert ist**: Die Reihenfolge der Schritte, was erwartet wurde und was tatsächlich geschah.
2. **Die Wörter auf dem Bildschirm**: Den Text des Fehlers genau abschreiben (das Feld **{{ui:queue.detail.error}}** im Tab **{{ui:app.tabs.queue}}** oder die Meldung am oberen Bildschirmrand).
3. **Die Version der App**: Sie steht ganz unten im Einstellungsbildschirm oder unter **{{ui:app.nav.about}}**.
4. **Das Entwicklerprotokoll**: Der mit **{{ui:app.devlog.copy}}** kopierte Text.
5. **Die Log-Dateien**: `novira.log` und `comfyui.log`, rund um den Zeitpunkt, zu dem das Problem auftrat.
6. **Informationen zum Computer**: Art und Speicher der GPU sowie die Windows-Version.

> Logs können Prompts und Speicherorte von Dateien enthalten. Vor der Weitergabe prüfen, ob etwas dabei ist, das nicht gezeigt werden soll.

## Erweiterte Einstellungen

Wird im Datenordner eine Datei `settings.json` abgelegt, lässt sich das Verhalten etwa der Engine ändern. Normalerweise wird sie nicht benötigt.

| Name der Einstellung | Bedeutung |
|---|---|
| `comfyuiPackage` | Die Art der zu installierenden Engine. `nvidia` (Standard) oder `amd` |
| `comfyuiUrl` | Verbindet mit einem bereits laufenden ComfyUI (die App installiert und startet dann keine Engine) |
| `comfyuiDir` | Verwendet den Ordner eines selbst installierten ComfyUI |
| `modelRoots` | Fügt Ordner hinzu, in denen nach Modellen gesucht wird |
| `comfyuiStartTimeoutSecs` | Die Anzahl der Sekunden, die auf den Start der Engine gewartet wird (Standard 180) |
| `lowMemoryMode` | Sparmodus (`true` oder `false`). Wird **{{ui:settings.lowMemory.label}}** in den Einstellungen umgeschaltet, wird er hier eingetragen |

Ist die Datei fehlerhaft geschrieben, startet die App nicht und zeigt den Grund an. Nach einer Änderung die App neu öffnen.
