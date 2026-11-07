# KI-Assistent, Einstellungen und Tastenkürzel

Dieses Kapitel erklärt den KI-Assistenten, der Einstellungen nach einer Beschreibung in Worten vornimmt, den Einstellungsbildschirm, die Liste der Tastenkürzel, den Bildschirm mit Informationen zur App und das Entwicklerprotokoll.

Der Einstellungsbildschirm, die Tastenkürzel und die Informationen zur App werden über das **{{ui:app.nav.settingsMenu}}** unten links im Bildschirm geöffnet.

## KI-Assistent

![Der KI-Assistent im rechten Bedienfeld. Der erste Bildschirm, in dem die KI gewählt und die Anmeldung vorgenommen wird](shot:agent)

Wenn Sie oben im rechten Bedienfeld auf den Tab **{{ui:app.right.assistant}}** klicken, ersetzt der **{{ui:agent.title}}** die Galerie. Er lässt sich in den Bildschirmen {{ui:app.tabs.generate}}, {{ui:app.tabs.canvas}}, {{ui:app.tabs.upscaling}} und {{ui:app.tabs.workflows}} verwenden, und beim Wechsel des Bildschirms bleiben Chat und angefangener Text erhalten. Mit dem Tab **{{ui:app.right.gallery}}** kehren Sie zur Galerie zurück. Wenn Sie den Assistenten im Bildschirm {{ui:app.nav.extensions}} etwas fragen, öffnet er sich als Fenster über dem Bildschirm. Dieses Fenster erscheint nur in dem Bildschirm, in dem Sie gefragt haben, und nicht, wenn Sie zu anderen Bildschirmen wie {{ui:app.tabs.models}} oder {{ui:app.tabs.browse}} wechseln. Das Fenster lässt sich verschieben, indem man seine Titelzeile zieht.

Statt Modelle und LoRAs auszuwählen oder Prompt und Größe selbst festzulegen, genügt es, in Worten zu beschreiben, was erzeugt werden soll, etwa „ein Mädchen im Anime-Stil an einem Strand bei Sonnenuntergang“. Der Assistent wählt dann die Einstellungen aus und trägt sie für Sie ein.

### Erste Schritte (Anmeldung)

Für den KI-Assistenten führt novira keine KI selbst aus, sondern ruft einen KI-Befehl auf dem Computer auf (Claude oder Codex), der die Antworten erstellt. Zur Nutzung ist folgende Vorbereitung nötig.

1. Einen der beiden Befehle auf dem Computer installieren: **Claude** von Anthropic oder **Codex** von OpenAI.
2. Den Assistenten öffnen und den gewünschten Eintrag drücken (**{{ui:agent.setup.claude}}** oder **{{ui:agent.setup.codex}}**).
3. Es öffnet sich ein Browser, in dem die Anmeldung erfolgt.

Wird dieser Befehl auf dem Computer nicht gefunden, erscheint der Hinweis „Der Befehl ○○ wurde auf diesem PC nicht gefunden. Bitte zuerst installieren.“ Installieren Sie diesen Befehl dann zuerst.

Der genutzte Dienst und der zugehörige Vertrag sind die des Anbieters, den Sie gewählt haben. Bei Claude und Codex speichert novira keine API-Schlüssel. Was ausgetauscht wird (der gesendete Text und die App-Informationen, die der Assistent für seine Arbeit liest, etwa die Liste der Modelle, die Einstellungen und der Inhalt eines geöffneten Comics oder Textes), wird an den gewählten Dienst gesendet. Die Informationen zu Bildern in der Galerie und die Prompts im Tab „Generieren“ liest der Assistent nur, wenn Sie es erlauben (siehe unten „Erlaubnis, Bilder und Prompts zu lesen“).

Die gewählte KI steht in der obersten Zeile des Assistenten. Zum Wechseln drücken Sie rechts in dieser Zeile die Schaltfläche **{{ui:agent.changeProvider}}**.

### Mit einem Server wie Ollama verbinden

![Der Bildschirm zum Verbinden mit einem Server. Die Ollama-Schaltfläche, die Adresse, das Modell und das Ergebnis des Verbindungstests](shot:agent-server)

Neben Claude und Codex kann der Assistent auch einen Server mit OpenAI-kompatibler API verwenden, der auf diesem Computer oder im Netzwerk läuft (etwa Ollama oder LM Studio). novira fragt den Server nach den Antworten und führt die Werkzeuge des Assistenten (etwa Einstellungen und Editor-Aktionen) selbst aus, daher ist ein Modell nötig, das Tool-Aufrufe unterstützt.

So verbinden Sie sich.

1. Öffnen Sie den Assistenten und drücken Sie **{{ui:agent.setup.openai}}**.
2. Drücken Sie die Schaltfläche des gewünschten Servers (bei Ollama die Schaltfläche **Ollama**). Die Adresse wird eingetragen, und die Liste der Modelle des Servers wird geladen. Bei anderen Servern geben Sie in **{{ui:agent.endpoint.address}}** die Adresse ein, die meist auf „/v1“ endet.
3. Wählen Sie bei **{{ui:agent.endpoint.model}}** ein Modell aus der Liste. Liefert der Server keine Liste, geben Sie den Namen ein.
4. Verlangt der Server einen Schlüssel, geben Sie ihn bei **{{ui:agent.endpoint.key}}** ein. Der Schlüssel wird verschlüsselt auf diesem Computer gespeichert und nur an diesen Server gesendet. Für einen Server auf dem eigenen Computer ist er meist nicht nötig.
5. Drücken Sie **{{ui:agent.endpoint.test}}**. Geprüft wird, ob der Server antwortet, ob das Modell vorhanden ist und ob es die Werkzeuge der App aufrufen kann.
6. Drücken Sie **{{ui:agent.endpoint.use}}**.

Kann das Modell keine Werkzeuge aufrufen, zeigt der Test das an, zusammen mit dem vom Server gelieferten Grund. Über dem Eingabefeld bleibt eine Warnung stehen, und das Senden von Nachrichten wird abgelehnt. Wählen Sie mit der Schaltfläche neben dem Namen des Chats ein anderes Modell, wird erneut geprüft. Der Test schlägt auf dieselbe Weise fehl, wenn der Kontext des Servers (die Länge, die er auf einmal lesen kann) für die Anfragen des Assistenten nicht ausreicht. Das ist bei der Standardeinstellung von Ollama der Fall. Stellen Sie die Kontextlänge des Servers auf mindestens 32768 (in den Einstellungen von Ollama oder mit der Umgebungsvariable OLLAMA_CONTEXT_LENGTH) und drücken Sie noch einmal **{{ui:agent.endpoint.test}}**. novira tut nicht so, als könnte der Server Werkzeuge verwenden.

Solange ein Server verwendet wird, steht in der Kopfzeile des Chats OpenAI API. Mit **{{ui:agent.changeProvider}}** kehren Sie zur Auswahl zurück. Der eingegebene Server bleibt im Formular erhalten.

An einen Server außerhalb dieses Computers werden das, was Sie senden, und, wenn Sie es erlauben, das, was der Assistent gelesen hat, über das Netzwerk gesendet. Bei solchen Servern erscheint unter der Adresse eine Warnung. Bei Servern ohne https fließt alles einschließlich des Schlüssels unverschlüsselt, auch dazu erscheint eine Warnung. Die Nachfrage „{{ui:agent.permission.title}}“ zeigt auch, wohin das Gelesene gesendet wird. Die Antworten des Servers werden nur als Text behandelt, und von den Anfragen werden nur die ausgeführt, die dieselbe Bestätigung durchlaufen wie bei Claude oder Codex.

### Was der Assistent übernimmt

Aus dem eingegebenen Text legt der Assistent Folgendes fest und trägt es in die Einstellungen ein. Was eingetragen wurde, erscheint als Liste in der Antwort.

| Was | Beispiel |
|---|---|
| Modellauswahl | Wählt aus den installierten Modellen ein passendes aus |
| LoRA hinzufügen | Fügt eine LoRA hinzu, die zum Stil passt |
| Prompt | Schreibt den Prompt und den Negativ-Prompt |
| Einstellungen ändern | Größe, Schritte, CFG, Scheduler, Seed |
| Workflow | Erstellt einen Graph oder korrigiert den geöffneten Graph (auch Graphen für Musik, Video und Stimme aus den Nodes von ComfyUI selbst. Ausgeführt wird er von Ihnen mit **{{ui:params.invoke.invoke}}**) |
| Text | Korrigiert den Text und die Sprechblasen, die in **{{ui:media.tab.text}}** geöffnet sind |
| Video, Musik, Stimme | Ändert die Einstellungen des jeweiligen Bildschirms |
| Comic | Ändert in **{{ui:app.tabs.comic}}** die Aufteilung in Bildfelder, fügt Bildfelder hinzu und teilt sie, und ändert Prompt und Pose jedes Bildfelds sowie die Sprechblasen (siehe unten „Hilfe beim Comic“) |
| Pose | Platziert in **{{ui:app.tabs.canvas}}** eine Strichfigur in der Pose, die Sie in Worten wünschen (siehe [Auf der Leinwand weiter zeichnen](05-canvas.md#pose-auf-der-leinwand-erstellen)) |
| Erzeugen | Nur auf Ihre Bitte hin (und beim Probezeichnen weiter unten) werden die aktuellen Einstellungen oder die Bildfelder eines Comics in die Warteschlange der Generierung gestellt |
| Empfehlungen für Erweiterungen | Weist auf Erweiterungen hin, die zum Vorhaben passen, und lässt sie per Schaltfläche installieren |
| Fragen zur App | Antwortet mit den Namen der Bildschirme und sagt, wo zu drücken ist |
| Erweiterungen erklären | Erklärt, was eine Erweiterung kann und wie sie verwendet wird (siehe unten „Fragen zur App und zu Erweiterungen“) |

Der Assistent sieht, welcher Bildschirm gerade geöffnet ist. Ist zum Beispiel **{{ui:media.tab.text}}** geöffnet und sagen Sie „Schreibe den Text vertikal“, ändert sich dieser Text.

Der Assistent trägt die Änderungen während der Arbeit sofort auf dem Bildschirm ein. Während er arbeitet, erscheinen die Änderungen der Reihe nach unter „{{ui:agent.thinking}}“. Bilder und Videos erzeugt er nur auf Ihre Bitte hin (er stellt sie in die Warteschlange der Generierung). Ohne Bitte ändert er nur die Einstellungen. Sieht das Ergebnis gut aus, genügt ein Druck auf **{{ui:agent.generate}}** in der Antwort, und die Erzeugung beginnt sofort. Ist ein Comic geöffnet, erscheint daneben auch die Schaltfläche „Alle Seiten erzeugen“. Ein Druck darauf stellt die Bildfelder mit Prompt aller Seiten gemeinsam in die Warteschlange (ohne Druck geschieht das nicht). Bilder löschen und Modelle oder Erweiterungen installieren kann der Assistent nicht (bei Erweiterungen gibt er nur Empfehlungen). Fettschrift, Aufzählungen, Tabellen und Ähnliches in der Antwort werden in dieser Form dargestellt und nicht als bloße Zeichen.

### Rückfragen und Probezeichnen

Ist bei einer Bitte unklar, was das Ergebnis stark beeinflusst, etwa welche Figur geändert werden soll, der Hintergrund oder die Figur, die Frisur oder die Haarfarbe, fragt der Assistent vor der Änderung nach. Antworten Sie, ändert er es entsprechend. Sagen Sie nach einer Korrektur „Vorher war es besser“ oder „Das Mädchen sollte so bleiben, wie es war“, prüft der Assistent in diesem Chat den Stand vor der Änderung und stellt diesen Teil wieder her (nach dem Beenden der App ist der Stand vor der Änderung nicht mehr bekannt).

Bei einer Bitte, die sich mit Worten schwer vermitteln lässt, etwa „sommerlicher“, erzeugt der Assistent mitunter ein einzelnes Probebild, sieht es sich an und fragt, ob es so gemeint ist. Das Probebild erscheint unter der Antwort. Wenn er das Bild ansieht, erscheint dieselbe Nachfrage wie bei „Erlaubnis, Bilder und Prompts zu lesen“ unten. Wenn Sie kein Probezeichnen möchten, schalten Sie in den Einstellungen **{{ui:settings.assistantTrial.label}}** aus (siehe unten „Einstellungen“).

### Hilfe beim Comic

Wenn Sie bei geöffnetem **{{ui:app.tabs.comic}}** bitten, liest der Assistent die geöffnete Seite (die Form der Bildfelder, den Prompt jedes Bildfelds, die Posen und die Sprechblasen) und schreibt sie direkt um. Sie können zum Beispiel so bitten.

- Auf „Mach 5 Bildfelder mit einem Höhepunkt. Das erste groß und schräg geteilt“ erstellt er die Aufteilung in Bildfelder. Bitten Sie ohne bestimmte Form, wählt er wie in echten Comics ungleiche Zeilenhöhen und Bildfeldbreiten, macht das Bildfeld mit dem Höhepunkt groß und setzt je nach Szene schräge Schnitte oder Bildfelder, die bis zum Papierrand reichen. Zwischen den Bildfeldern lässt er oben und unten mehr Abstand als links und rechts. Die Aufteilung ändert er von Seite zu Seite. Er kann eine Standardvorlage verwenden oder die Form der Bildfelder selbst festlegen.
- Auf „Schreib zu dieser Geschichte die Prompts für jedes Bildfeld“ schreibt er für jedes Bildfeld einen Prompt mit einem Bildausschnitt, der zum Verlauf der Geschichte passt (Nahaufnahme, Totale, Froschperspektive usw.).
- Auf „Schreib zu dieser Geschichte die Regieanweisungen für jedes Bildfeld“ beschreibt er für jedes Bildfeld die Szene in Worten (Ort, Zeit, wer was tut).
- Auf „Setz in jedes Bildfeld Dialoge“ setzt er Sprechblasen und schreibt die Dialoge hinein. Ragt ein Dialog über die Sprechblase hinaus, verkleinert er die Schrift, bis er hineinpasst.
- Auf „Lass das Mädchen in Bildfeld 2 rennen“ gibt er diesem Bildfeld eine Pose. Er schreibt auch die Figuren auf (das Aussehen jeder Figur), damit Gesichter und Kleidung in allen Bildfeldern übereinstimmen. Sprechblasen setzt er neben die sprechende Figur, in einer Größe, die andere nicht überdeckt.
- Auf „Erstelle einen neuen Comic und baue die Aufteilung für 30 Seiten auf“ legt er einen neuen Comic an, fügt Seiten hinzu und führt Aufteilung, Prompts und Dialoge bis zum Ende. Auch wenn Sie aus einem anderen Bildschirm bitten, wechselt er zum Comic-Bildschirm und arbeitet dort. Auch bei langer Arbeit macht er innerhalb einer Bitte weiter, bis er fertig ist. Zum Abbrechen drücken Sie **{{ui:agent.stop}}**.

Bilder zeichnet er nur auf Ihre Bitte hin (er stellt sie in die Warteschlange). Ohne Bitte drücken Sie, sobald die Prompts eingetragen sind, **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}** oder **{{ui:comic.comic.drawAll}}**. Bitten Sie „Zeichne alle Seiten“, stellt er alle Bildfelder aller Seiten gemeinsam in die Warteschlange. Die Schaltfläche „Alle Seiten erzeugen“ unter der Antwort tut dasselbe. Ein Klick auf **{{ui:agent.undo}}** setzt alle Comicseiten, die diese Antwort geändert hat, auf einmal zurück.

### Bilder anhängen

Sie können einer Nachricht Bilder beifügen und etwa bitten: „Überlege dir anhand dieses Bildes einen Prompt.“

- Mit der Büroklammer-Schaltfläche links neben dem Eingabefeld (**{{ui:agent.attach.add}}**) wählen Sie ein Bild auf dem Computer.
- Sie können auch ein Bild aus der Galerie oder eine Bilddatei vom Computer auf das Eingabefeld ziehen und dort ablegen.
- Ein kopiertes Bild lässt sich ebenfalls ins Eingabefeld einfügen.

Angehängte Bilder erscheinen über dem Eingabefeld und lassen sich mit dem × oben rechts wieder entfernen. An eine Nachricht lassen sich bis zu 4 Bilder anhängen. Senden Sie nur Bilder ohne Text, gilt das als Bitte „{{ui:agent.attach.defaultAsk}}“. Vom Computer angehängte Bilder gelangen auch in die Galerie. Die Bilder werden mit der Nachricht an die gewählte KI gesendet (Claude, Codex oder den verbundenen Server). Bei späteren Nachrichten sind sie nicht mehr dabei; hängen Sie das Bild daher erneut an, wenn Sie noch einmal dazu bitten. Modelle, die keine Bilder lesen können, antworten nicht gut.

### Erlaubnis, Bilder und Prompts zu lesen

Die Informationen zu Bildern in der Galerie (Prompt, Modell usw.) und das Prompt-Feld im Tab „Generieren“ können Inhalte enthalten, die Sie nicht zeigen möchten. Will der Assistent sie lesen, erscheint daher zunächst im Chat die Nachfrage „{{ui:agent.permission.title}}“. Sie zeigt auch, was gelesen werden soll.

- **{{ui:agent.permission.once}}**: Erlaubt das Lesen nur dieses eine Mal. Beim nächsten Versuch kommt die Nachfrage wieder.
- **{{ui:agent.permission.always}}**: Erlaubt das Lesen künftig ohne Nachfrage (die Einstellung wechselt zu **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: Erlaubt das Lesen nicht. Der Assistent arbeitet ohne Lesen weiter oder sagt, was er braucht.

Ist der Comic-Bildschirm geöffnet, sieht sich der Assistent mitunter die Bilder fertig gezeichneter Seiten an (auf Ihre Bitte, um das Aussehen der Figuren oder die Sprechblasen zu prüfen). Auch dann erscheint dieselbe Nachfrage, und das Bild der Seite wird nur gesendet, wenn Sie es erlauben. In anderen Bildschirmen sieht er sie nicht.

Ob nachgefragt wird, ändern Sie unter **{{ui:settings.tab.generation}}** in den Einstellungen im Bereich **{{ui:settings.section.assistant}}** mit **{{ui:settings.assistantRead.label}}** (siehe unten „Einstellungen“). Den Inhalt von Bildschirmen, die der Assistent für Sie korrigiert, etwa Comic, Text, Workflow, Video, Musik und Stimme sowie die Pose auf der Leinwand, liest er ohne Nachfrage.

### Recherche bei Wikipedia

Beim Erfinden einer Geschichte (Zeit, Kleidung, Orte, Berufe, Begriffe usw.) kann der Assistent Fakten in der japanischen oder englischen Wikipedia nachschlagen und bis zu 3 Artikelanfänge lesen. Den Computer verlässt nur ein kurzer Suchbegriff, und das Ziel ist nur Wikipedia. Gesendet wird von der App selbst, der Bildschirm verbindet sich nie direkt. Weil der Suchbegriff ins Internet gelangt, erscheint vor der Recherche im Chat die Nachfrage „{{ui:agent.permission.webTitle}}“, die auch den zu sendenden Suchbegriff zeigt.

- **{{ui:agent.permission.once}}**: Erlaubt die Recherche nur dieses eine Mal. Beim nächsten Versuch wird wieder nachgefragt.
- **{{ui:agent.permission.always}}**: Erlaubt die Recherche künftig ohne Nachfrage (die Einstellung wechselt zu **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: Erlaubt die Recherche nicht. Der Assistent macht mit dem weiter, was er weiß, und fragt innerhalb dieser Bitte nicht noch einmal.

Das ist eine eigene Einstellung: **{{ui:settings.assistantWeb.label}}** unter **{{ui:settings.tab.generation}}** im Bereich **{{ui:settings.section.assistant}}**. Auch wenn das Lesen von Bildern erlaubt ist, ist damit die Recherche nicht erlaubt (und umgekehrt). Die Texte von Wikipedia stehen unter der Lizenz CC BY-SA 4.0, daher nennt der Assistent, wenn er Fakten verwendet, den Namen des ursprünglichen Artikels. Antworten können falsch sein; prüfen Sie Wichtiges nach.

### Modell und Denkaufwand wählen

Mit der kleinen Schaltfläche in Form eines Gehirns rechts neben dem Namen des Chats wählen Sie **{{ui:agent.model.label}}** und **{{ui:agent.effort.label}}**, die der Assistent verwendet. Die Auswahl gilt ab der nächsten gesendeten Nachricht. Claude und Codex merken sich ihre Auswahl getrennt.

- Bei Claude wählen Sie das Modell aus Fable 5.1, Opus 5.5, Sonnet 5.5 und Haiku 5.5. Verwendet wird genau die Version, die der Name nennt. Der Denkaufwand hat 5 Stufen, von **{{ui:agent.effort.low}}** bis **{{ui:agent.effort.max}}**.
- Bei Codex wählen Sie das Modell aus der Liste der Modelle, die Codex für Ihr Konto als verfügbar angibt (die Liste wird aus der Datei gelesen, die Codex auf dem Computer speichert). Beim Denkaufwand erscheinen nur die Stufen, die das gewählte Modell annimmt (manche Modelle nehmen bis **{{ui:agent.effort.ultra}}** an).
- Bei einem Server erscheinen die Modelle, die der Server auflistet. Sie können auch einen Namen eingeben. Einen Denkaufwand gibt es nicht. Das Modell gehört zur Einstellung des Servers, daher wird die Wahl eines anderen Modells dort gespeichert.

Solange noch nichts gewählt wurde, ist bei Claude Sonnet 5.5 gewählt und bei Codex das erste Modell der Liste; die Schaltfläche zeigt diesen Namen. Es antwortet immer das Modell, dessen Name auf der Schaltfläche steht (nur wenn Codex keine Liste gespeichert hat, steht **{{ui:agent.model.default}}**, und Codex entscheidet über das Modell). Vom Denkaufwand ist immer eine Stufe gewählt. Anfangs ist die Standardstufe des Modells gewählt, und wechseln Sie zu einem Modell, das die aktuelle Stufe nicht annimmt, kehrt es zur Standardstufe dieses Modells zurück.

### Die Höhe des Eingabefelds ändern

Ziehen Sie den länglichen Griff am oberen Rand des Eingabefelds nach oben, wird das Eingabefeld höher, ziehen Sie ihn nach unten, wird es niedriger. Auch wenn Sie den Griff auswählen und die Pfeiltasten nach oben und unten drücken, ändert sich die Höhe. Die Höhe bleibt beim nächsten Öffnen dieselbe.

### Vorlagen aufrufen

Wenn Sie am Anfang des Eingabefelds „/“ tippen, öffnet sich eine Liste mit Vorlagen für häufige Anfragen. Wenn Sie nach dem „/“ weitertippen, bleiben nur die Vorlagen, deren Name, Befehl oder Text diese Zeichen enthält (zum Beispiel „/Comic“ oder „/comic“).

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

Eine Antwort, die Einstellungen oder Bearbeitungen geändert hat, erhält eine Schaltfläche **{{ui:agent.undo}}**. Ein Druck darauf setzt alle Einstellungen und Bearbeitungen, die diese Bitte geändert hat, auf den Stand vor der Bitte zurück. Was in die Warteschlange der Generierung gestellt wurde, wird nicht zurückgenommen (brechen Sie es in der Warteschlange ab).

Nach einem Neustart der App lassen sich frühere Änderungen jedoch nicht mehr rückgängig machen (die Schaltfläche lässt sich nicht mehr drücken).

### Wiederholt zeichnen lassen, bis es ähnlich ist

Bitten Sie „Mach es diesem Bild ähnlich“ oder „Nähere dich an, während du ein paar Bilder erzeugst“, zeichnet der Assistent wiederholt Probebilder. Nach jedem Bild vergleicht er es mit dem Zielbild, korrigiert nur das, was abweicht, und zeichnet das nächste.

- Auch wenn eine Antwort zu Ende ist, bittet die App automatisch um das nächste Bild. Der Assistent hört nur auf, wenn er das Ziel für erreicht hält oder zwei Bilder hintereinander nicht näher gekommen sind.
- Es sind höchstens 30 Bilder.
- Im Chat steht „Annäherung: Bild x / y“.
- Zum Stoppen drücken Sie **{{ui:agent.stop}}** oder senden eine neue Nachricht. Die gesendete Nachricht wird anstelle des nächsten Bildes gesendet.
- Ist {{ui:settings.assistantTrial.label}} ausgeschaltet, beginnt diese Wiederholung nicht.

### Die Länge des Gesprächs prüfen

Innerhalb desselben Chats antwortet der Assistent mit Erinnerung an das bisherige Gespräch. Auch angehängte Bilder und Bilder, die der Assistent gezeigt hat, werden über ihren Namen weitergegeben und bei Bedarf noch einmal angesehen.

- Über dem Eingabefeld steht, wie groß das Gespräch beim nächsten Senden ist, als „ca. x / y Token“. Die Zahl ist ein Richtwert.
- Solange in derselben Zeile der Schalter „{{ui:agent.context.limit}}“ an ist (anfangs ist er an), werden bei einem Gespräch, das 30000 Token zu überschreiten droht, alte Nachrichten zu kurzen Zusammenfassungen von je einer Zeile verkürzt gesendet. Neue Nachrichten werden unverändert gesendet, und die Zahl der zusammengefassten Nachrichten steht in der Zeile. Die Zusammenfassung enthält nur etwa die ersten 140 Zeichen, genaue Formulierungen bleiben daher nicht erhalten. Vergisst der Assistent dadurch frühere Gespräche, schalten Sie den Schalter aus, dann wird das ganze Gespräch gesendet (ist es lang, kann es die Grenze des verwendeten Modells überschreiten).
- Solange dieser Schalter an ist, werden auch die Prompts, die der Assistent ins Prompt-Feld von {{ui:app.tabs.generate}} schreibt, je Feld auf 77 Token begrenzt (die Zahl unter dem Feld). Längere Prompts nimmt die App nicht an, und der Assistent kürzt und schreibt sie neu. Wenn er lange Prompts schreiben soll, schalten Sie den Schalter aus.
- Wenn Sie das Thema wechseln, beginnen Sie mit {{ui:agent.session.new}} einen neuen Chat, damit das alte Gespräch nicht nachwirkt.

### Chatverlauf

Der Austausch mit dem Assistenten bleibt als „Chat“ erhalten. Beim Drücken auf den Namen des Chats oben im Fenster öffnet sich die Liste **{{ui:agent.session.history}}**.

- Wird ein Eintrag aus der Liste gewählt, lässt sich das Gespräch an der Stelle fortsetzen, an der dieser Chat aufgehört hat.
- Mit **{{ui:agent.session.rename}}** lässt sich ein Name vergeben.
- Mit **{{ui:agent.session.delete}}** lässt er sich entfernen.
- Mit **{{ui:agent.session.new}}** daneben lässt sich ein neuer Chat beginnen.

Den Text im Chat können Sie durch Ziehen markieren und kopieren. Die Schaltfläche unten rechts bei jeder Nachricht (**{{ui:agent.copy}}**) kopiert den ganzen Text dieser Nachricht.

> Eine Nachricht, die Sie schreiben und senden, während auf eine Antwort gewartet wird, kommt in eine Warteschlange und wird automatisch gesendet, sobald die aktuelle Antwort fertig ist. Wartende Nachrichten werden blass dargestellt und lassen sich mit dem × entfernen. Schlägt die Antwort fehl, kehren die wartenden Nachrichten ins Eingabefeld zurück. Zum Abbrechen verwenden Sie die Schaltfläche **{{ui:agent.stop}}**. Was bis zum Abbruch geändert wurde, bleibt bestehen und lässt sich mit **{{ui:agent.undo}}** auf einmal zurücksetzen.

Die Breite des rechten Bedienfelds ändern Sie, indem Sie die Kante des Bedienfelds ziehen. Das über dem Bildschirm geöffnete Fenster lässt sich an einer beliebigen der vier Kanten oder vier Ecken ziehen, um die Größe zu ändern. Die rechte untere Ecke zeigt dafür eine Markierung. Die Größe wird gemerkt. Wenn eine Antwort den Gedankengang der KI mitbringt, erscheint er als eine Zeile über der Antwort. Ein Druck darauf öffnet die ganze Darstellung (**{{ui:agent.thoughts.label}}**). Es ist eine kurze Zusammenfassung der KI darüber, wie sie die Anfrage gelesen hat und warum sie so entschieden hat, nicht ihr unverändertes internes Denken.

## Einstellungen

![Der Einstellungsbildschirm. Links stehen die Tabs, rechts die Einträge des gewählten Tabs](shot:settings)

Wird **{{ui:app.nav.settings}}** über das **{{ui:app.nav.settingsMenu}}** unten links gewählt, öffnet sich der Einstellungsbildschirm. Wählen Sie links einen Tab, erscheinen rechts seine Einträge. Änderungen werden sofort verwendet und bleiben auch nach dem Schließen der App erhalten. Beim erneuten Öffnen erscheint der zuletzt angesehene Tab.

> Dieses Bild zeigt einen Beispielbildschirm, der im Browser läuft. **{{ui:settings.uiZoom.label}}**, das es nur in der Desktop-Version gibt, ist darauf nicht zu sehen.

### {{ui:settings.tab.general}}

| Eintrag | Bedeutung |
|---|---|
| {{ui:settings.language.label}} | Auswahl aus {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} und {{ui:settings.language.de}}. Die Sprache des Bildschirms wechselt sofort |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (Standard) oder **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | Nur Desktop-Version. Die Größe des gesamten Bildschirms. Zur Auswahl stehen 50 % bis 300 %. Sie lässt sich auch mit `Ctrl` und `+` / `-` ändern |
| {{ui:settings.startTab.label}} | Der Tab, der beim Öffnen der App zuerst erscheint. Anfangs ist es **{{ui:app.tabs.generate}}**. Wählen Sie **{{ui:settings.startTab.last}}**, öffnet sich der Tab, der beim letzten Schließen offen war |
| {{ui:settings.waitForEngine.label}} | Anfangs an: Der Startbildschirm wartet, bis die Bild-Engine fertig geladen ist. Ist der Schalter aus, öffnet sich die App schon während des Ladens. Der Zustand der Engine steht im Banner |
| {{ui:settings.toastSeconds.label}} | Die Zahl der Sekunden, bis eine Benachrichtigung von selbst verschwindet. Zur Auswahl stehen 2 bis 15 Sekunden (anfangs 3,5) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**: Zeigt Bilder während der Erzeugung im Rahmen „{{ui:gallery.generating.title}}“ der Galerie weich an. Ist der Schalter aus, erscheinen sie als grobe Punkte.
- **{{ui:settings.draftCount.label}}**: Der Anfangswert für die Anzahl, wenn der Entwurfsbildschirm geöffnet wird (1 bis 24 Bilder, anfangs 4). Im Bildschirm lässt er sich auch jedes Mal ändern.
- **{{ui:settings.draftPosition.label}}**: Der Anfangswert für die Position, wenn der Entwurfsbildschirm geöffnet wird (25 bis 60 %, anfangs 35 %).
- **{{ui:settings.lowMemory.label}}**: Für Computer, deren GPU wenig Speicher hat. Ist der Schalter an, bleiben Modelle nicht im GPU-Speicher, sodass weniger Speicher genügt, die Erzeugung aber langsamer ist. Beim Umschalten wird die Engine neu gestartet. Ist gerade ein Eintrag in Arbeit, gilt die Einstellung ab dem nächsten Start der Engine. Sie lässt sich nicht verwenden, solange die App mit einer anderswo gestarteten Engine verbunden ist.
- **{{ui:settings.assistantRead.label}}** (**{{ui:settings.section.assistant}}**): Ob der Assistent die Informationen zu Bildern in der Galerie und die Prompts im Tab „Generieren“ lesen darf. Zur Auswahl stehen **{{ui:settings.assistantRead.ask}}** (Standard), **{{ui:settings.assistantRead.always}}** und **{{ui:settings.assistantRead.never}}**.
- **{{ui:settings.assistantWeb.label}}** (**{{ui:settings.section.assistant}}**): Ob der Assistent Fakten in Wikipedia nachschlagen darf. Die Auswahl ist dieselbe, und es ist eine andere Einstellung als das Lesen von Bildern.
- **{{ui:settings.assistantTrial.label}}** (**{{ui:settings.section.assistant}}**): Ob der Assistent, wenn die Absicht einer Bitte schwer zu erkennen ist, von sich aus ein einzelnes Probebild erzeugen darf. Anfangs an.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}**: Dieselben Einträge wie unter **{{ui:gallery.settings.title}}**, das sich mit der Zahnrad-Schaltfläche der Galerie öffnet. Die Änderung wirkt gleich, egal wo sie vorgenommen wird.
- **{{ui:settings.confirmOnDelete}}**: Zeigt vor dem Löschen eines Bildes eine Bestätigung. Auch wenn im Bestätigungsbildschirm „{{ui:common.dontAskAgain}}“ gewählt wird, wird dieser Schalter ausgeschaltet.
- **{{ui:settings.clearIntermediates}}**: Löscht Bilder, die nicht in der Galerie erscheinen, etwa Zwischenergebnisse der Leinwand. Die Anzahl der zu löschenden Bilder steht auf der Schaltfläche.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**: Die Anzahl der Schritte, die sich beim Bearbeiten von Leinwand, Comic, Text und Workflow rückgängig machen lassen. Zur Auswahl stehen 10 bis 200 (anfangs 60). Je mehr, desto mehr Speicher wird verwendet.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**: Die Schriftart für den Text in Sprechblasen, für die keine Schriftart gewählt wurde. Zur Auswahl stehen die Schriftarten der App und die auf diesem Computer installierten Schriftarten. **{{ui:common.font.standard}}** ist die Standardschrift der App.
- **{{ui:settings.textFont.label}}**: Die Schriftart für Text, der im Textbildschirm neu hinzugefügt wird. Die Auswahl funktioniert wie bei der Schriftart der Sprechblasen.
- **{{ui:settings.section.comicPage}}**: Legt für neu erstellte Comics und später hinzugefügte Seiten **{{ui:comic.page.size}}**, **{{ui:comic.page.direction}}**, **{{ui:settings.comicPage.panels}}** (1 bis 6), **{{ui:comic.page.frameWidth}}** und **{{ui:comic.page.margin}}** fest. Bereits vorhandene Seiten ändern sich nicht.

### {{ui:settings.tab.engine}}

Hier stehen der Speicherort der Daten der App und die Art, wie die Bild-Engine (ComfyUI) gestartet wird. Was hier geändert wird, gilt ab dem nächsten Start der App (das steht oben im Bildschirm).

| Eintrag | Bedeutung |
|---|---|
| {{ui:settings.engine.dataDir.label}} | Der Ordner für erzeugte Bilder, Modelle, die Bild-Engine usw. Anfangs ist es `novira-data` im Benutzerordner. Mit **{{ui:settings.engine.dataDir.change}}** wählen Sie zuerst, was mit den aktuellen Daten geschieht. **{{ui:settings.engine.dataDir.dialog.move}}** verschiebt die aktuellen Daten in den gewählten Ordner. Auch wenn der Ordner anderes enthält, lässt sich verschieben, solange nichts denselben Namen hat (das geschieht zu Beginn des nächsten Starts und dauert bei großen Datenmengen entsprechend). **{{ui:settings.engine.dataDir.dialog.use}}** verschiebt keine Daten und öffnet den gewählten Ordner (vorhandene Daten werden verwendet, ein leerer Ordner beginnt neu). Danach öffnet sich ein Fenster zur Ordnerwahl, und der gewählte Ort gilt ab dem nächsten Start. Mit **{{ui:settings.engine.dataDir.cancel}}** brechen Sie ab. Misslingt das Verschieben, erscheint der Grund, und die App startet mit dem bisherigen Ordner. Ist der Ordner mit der Umgebungsvariable `NOVIRA_DATA_DIR` festgelegt, lässt er sich hier nicht ändern |
| {{ui:settings.engine.comfyui.label}} | Das verwendete ComfyUI. Normalerweise liegt es in `comfyui` im Datenordner, und dieser Ort wird angezeigt. Hat eine Konfigurationsdatei ein anderes ComfyUI festgelegt, wird dessen Ort angezeigt. Mit **{{ui:settings.engine.comfyui.change}}** ändern Sie den Ort, an dem die App ComfyUI installiert. Ist der gewählte Ordner leer, wird beim nächsten Start neu installiert (ein großer Download). Ist darin bereits ComfyUI installiert, wird es unverändert verwendet. Dateien am alten Ort werden nicht automatisch gelöscht. Um in den Datenordner zurückzukehren, wählen Sie darin `comfyui` |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** oder **{{ui:settings.engine.package.amd}}**. Wird beim nächsten Download von ComfyUI verwendet (bei der ersten Installation oder einem Versionswechsel). Wählen Sie bei installiertem ComfyUI eine andere Art, erscheint eine Nachfrage. Bestätigen Sie, wird ComfyUI beim nächsten Start von novira mit der gewählten Art neu installiert (ein großer Download, der dauert) |
| {{ui:settings.engine.timeout.label}} | Die Zahl der Sekunden, die nach dem Start von ComfyUI auf eine Antwort gewartet wird. Zur Auswahl stehen 30 bis 1800 Sekunden. Auf langsamen Computern stellen Sie sie höher ein |
| {{ui:settings.engine.modelRoots.label}} | Ordner, in denen zusätzlich zu models im Datenordner nach Modellen gesucht wird. Mit **{{ui:settings.engine.modelRoots.add}}** öffnet sich ein Fenster zur Ordnerwahl. Die Ordnerstruktur von ComfyUI und Stability Matrix wird erkannt. Auch zusätzliche Modelle für Video, Musik, Stimme und Entfernen werden von hier gefunden (sie werden nur gelesen, neue Installationen landen immer im Datenordner). Bis zu 16 Ordner lassen sich hinzufügen. Ordner im Datenordner und bereits vorhandene Ordner lassen sich nicht hinzufügen. Mit der ×-Schaltfläche entfernen Sie einen Ordner. Im Browser lässt sich nichts hinzufügen, nur entfernen |

### {{ui:settings.tab.accounts}}

Diese Felder sind für den Fall gedacht, dass eine Seite, die Modelle bereitstellt, eine Anmeldung verlangt. Das Eingegebene wird verschlüsselt auf diesem Computer gespeichert und nicht auf dem Bildschirm angezeigt.

| Eintrag | Bedeutung |
|---|---|
| {{ui:settings.civitaiKey.label}} | Wird zum Herunterladen von Modellen verwendet, für die eine Anmeldung nötig ist |
| {{ui:settings.hfToken.label}} | Wird zum Herunterladen von Modellen verwendet, für die eine Zugriffsanfrage nötig ist |

Einfügen und **{{ui:settings.civitaiKey.save}}** drücken. Später sind auch **{{ui:settings.civitaiKey.change}}** und **{{ui:settings.civitaiKey.remove}}** möglich.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

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

> Ersetzte Daten lassen sich nicht zurückholen. Bei Bedarf vor der Wiederherstellung eine Sicherung des aktuellen Stands erstellen. API-Schlüssel und Tokens sind nur für diesen Computer verschlüsselt und müssen daher nach der Wiederherstellung unter **{{ui:settings.tab.accounts}}** erneut eingegeben werden. Im Browser lassen sich Sicherungen weder erstellen noch wiederherstellen. Verwenden Sie dafür die Desktop-App.

#### {{ui:settings.section.unfinished}}

Bricht ein Download ab, bleibt eine angefangene Datei im Datenordner zurück. In diesem Bereich sehen Sie Namen, Ordner und Größe der verbliebenen Dateien. Mit **{{ui:settings.unfinished.delete}}** löschen Sie eine einzeln, mit **{{ui:settings.unfinished.deleteAll}}** alle (zuvor erscheint eine Nachfrage). Eine verbliebene Datei wird beim nächsten Start desselben Downloads an der Stelle fortgesetzt. Löschen Sie sie, beginnt dieser Download von vorn. Dateien, die gerade verwendet werden, werden nicht gelöscht und bleiben erhalten.

#### {{ui:settings.section.reset}}

Wählen Sie mit **{{ui:settings.reset.scope.label}}** den Umfang des Zurücksetzens, drücken Sie **{{ui:settings.resetWebUi}}** und bestätigen Sie dann noch einmal mit **{{ui:settings.resetConfirm}}**. Bilder, Modelle, Comics und Leinwand werden nicht gelöscht.

Der Zustand der Bildschirme wie Einstellungen, Vorgaben, Entwürfe und Verlauf wird im Datenordner gespeichert. Solange derselbe Datenordner verwendet wird, ist er in der Desktop-App und im Browser gleich. Beide lassen sich nicht gleichzeitig öffnen, daher wird er beim nacheinander Verwenden übernommen. Auch das Zurücksetzen wirkt auf beide.

| Umfang | Was auf den Anfangswert zurückgeht |
|---|---|
| {{ui:settings.reset.scope.settings}} | Die Einträge des Einstellungsbildschirms. Wirkt sofort |
| {{ui:settings.reset.scope.generation}} | Prompt, Modell und Parameter des Generierungsbildschirms |
| {{ui:settings.reset.scope.gallery}} | Die Darstellung der Galerie (Größe der Vorschaubilder, Reihenfolge usw.) |
| {{ui:settings.reset.scope.assistant}} | Die Gespräche mit dem Assistenten. Alles wird gelöscht |
| {{ui:settings.reset.scope.all}} | Alle im Browser gespeicherten Einstellungen und Bildschirmzustände. Auch Vorgaben, Charaktere, die Prompt-Liste und die Gespräche mit dem Assistenten werden gelöscht |

Außer bei „{{ui:settings.reset.scope.settings}}“ wirkt es erst, nachdem Sie nach der Bestätigung **{{ui:settings.reload}}** drücken und neu laden.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**: Zeigt in der Navigation links eine Schaltfläche „{{ui:app.devlog.short}}“ an (siehe unten „Entwicklerprotokoll“).

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
| `G` | Rechtes Bedienfeld (Galerie und Assistent) öffnen und schließen |
| `F` | Beide Bedienfelder gemeinsam öffnen und schließen |
| `1` bis `9` | Zum Tab mit dieser Nummer wechseln |
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
