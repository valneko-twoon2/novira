# Vom Smartphone aus nutzen

Mit dem Browser eines Smartphones, das im WLAN zu Hause angemeldet ist, können Sie novira auf Ihrem Computer verwenden. Die Bilder zeichnet der Computer; das Smartphone zeigt nur den Bildschirm und nimmt Ihre Eingaben entgegen. Einstellungen, Entwürfe, Verlauf und alles Weitere sind dieselben wie beim Öffnen auf dem Computer. Sind Smartphone und Computer gleichzeitig geöffnet, werden Prompt, Modell, LoRA, Generierungseinstellungen, Vorgaben, Prompt-Sammlung und Entwürfe, die Sie auf der einen Seite ändern, nach etwa 1 bis 2 Sekunden auch in den anderen geöffneten Bildschirmen übernommen. Anzeigeeinstellungen wie Sprache, Design und Bildschirmgröße, der Bearbeitungsstand von Leinwand und Workflow sowie die Gespräche mit dem Assistenten gehören jeweils zum einzelnen Bildschirm und werden beim nächsten Öffnen angeglichen. Die Verbindung ist verschlüsselt, und das Smartphone verbindet sich erst, nachdem Sie es am Computer erlaubt haben.

## So verbinden Sie sich

1. Klicken Sie in der linken Leiste der novira-App auf **{{ui:app.tabs.short.homeLink}}**. Das Netzwerk, auf das Sie klicken, wird als Ihr Heimnetzwerk gemerkt, und der Zugang öffnet sich.
2. Ein QR-Code erscheint. Scannen Sie ihn mit der Kamera eines Smartphones, das im selben WLAN wie der Computer angemeldet ist, und öffnen Sie die Adresse, die erscheint. Haben Sie ihn mit einer QR-Code-App geöffnet, können Sie ihn vor dem Verbinden in Safari oder Chrome neu öffnen. Der Code läuft nach 2 Minuten ab und lässt sich nur mit einem Smartphone einmal verwenden. Ist er abgelaufen, klicken Sie auf **{{ui:app.lan.newCode}}**.
3. Bei einem Smartphone, das zum ersten Mal verbunden wird, zeigt der Browser eine Zertifikatswarnung. Installieren Sie das Zertifikat nach der Anleitung unter „Das Zertifikat installieren“ weiter unten.
4. Prüfen Sie auf dem Smartphone den Namen des Geräts und tippen Sie auf „Verbinden“. Auf dem Smartphone erscheint eine 6-stellige Bestätigungsnummer. Dieselbe Nummer erscheint auch im Bildschirm **{{ui:app.tabs.short.homeLink}}** am Computer (ist er nicht geöffnet, als Benachrichtigung am Bildschirmrand). Stimmen sie überein, klicken Sie auf **{{ui:app.lan.allow}}**. Auf dem Smartphone öffnet sich novira.

Schließen Sie die App, schließt sich auch der Zugang, und das bisher verbundene Smartphone muss sich beim nächsten Öffnen erneut verbinden.

### Aus der Browser-Version verbinden

Sie können sich auch aus der Browser-Version auf dieselbe Weise verbinden, ohne die App zu öffnen. Schließen Sie die App (den Datenordner kann immer nur ein Programm gleichzeitig verwenden), öffnen Sie im Explorer den Ordner der App (den mit `server.bat`), tippen Sie oben in die Adressleiste `cmd` und drücken Sie Enter. Tippen Sie in der geöffneten Eingabeaufforderung `server.bat` und drücken Sie Enter. Im Browser des Computers öffnet sich derselbe Bildschirm; klicken Sie dort in der linken Leiste auf **{{ui:app.tabs.short.homeLink}}**. Zum Beenden drücken Sie in der Eingabeaufforderung Strg+C oder schließen das Fenster.

### Das Zertifikat installieren

novira verschlüsselt die Verbindung zum Smartphone mit einem Zertifikat, das auf diesem Computer erstellt wurde (novira local CA). Solange das Smartphone dieses Zertifikat nicht kennt, warnt der Browser „Nicht sicher“. Das Zertifikat installieren Sie nur einmal am Anfang auf dem Smartphone. Öffnen Sie unten im Bildschirm des Smartphones „Zertifikat installieren“ und laden Sie das Zertifikat über den Link herunter.

- iPhone: Tippen Sie auf den Link und dann auf „Erlauben“, und installieren Sie das Profil über „Profil geladen“ ganz oben in der Einstellungen-App. Schalten Sie danach unter „Allgemein“, „Info“, „Zertifikatsvertrauenseinstellungen“ novira local CA ein. Vergessen Sie diesen letzten Schritt, verschwindet die Warnung auch mit installiertem Zertifikat nicht.
- Android (Chrome): Wählen Sie in den Einstellungen unter „Sicherheit“, „Zertifikat installieren“, „CA-Zertifikat“ das heruntergeladene Zertifikat. Firefox verwendet später installierte Zertifikate nicht. Öffnen Sie novira in Chrome.

### Beim Schließen

Eine Schaltfläche, die den Zugang zum Heimnetzwerk schließt, gibt es nicht. Auch wenn Sie das Popup schließen, lassen sich bereits verbundene Smartphones weiter verwenden.

- Wird 30 Minuten lang von niemandem genutzt und gibt es weder einen wartenden Code noch eine wartende Freigabe, schließt er sich automatisch.
- Er schließt sich auch automatisch, wenn das Netzwerk nicht mehr als vertrauenswürdig gilt, etwa beim Wechsel in ein anderes WLAN.
- Verbundene Smartphones lassen sich in der Liste mit dem × einzeln trennen. Nach 30 Minuten ohne Nutzung oder 4 Stunden nach dem Verbinden wird die Verbindung des Smartphones getrennt.

### Wenn Windows nachfragt

Beim ersten Öffnen des Zugangs fragt Windows, ob die Kommunikation von novira (in der Browser-Version novira-server) erlaubt werden soll. Erlauben Sie die Kommunikation in privaten Netzwerken.

Behandelt Windows das verwendete Netzwerk als „Öffentlich“, erscheint ein Hinweis im Bildschirm. Öffnen Sie den Zugang nur in Ihrem eigenen Netzwerk. Wenn sich das Smartphone nicht verbinden kann, öffnen Sie in den Windows-Einstellungen unter „Netzwerk und Internet“ die Eigenschaften des verwendeten WLANs (oder der Kabelverbindung) und stellen Sie den Netzwerkprofiltyp auf „Privates Netzwerk“.

### Welche Geräte sich verbinden können, und Hinweise

- Antwort gibt es nur für Geräte im selben Netzwerk wie dieser Computer (derselbe Bereich desselben Routers). Von unterwegs oder von einem Smartphone über ein VPN gibt es keine Verbindung. Von unterwegs verwenden Sie die Methode unter „Von unterwegs nutzen“.
- Auch ein Gerät im selben WLAN lässt sich nur verwenden, wenn Sie es am Computer erlauben. Zeigen Sie den QR-Code niemandem. Stimmt die Bestätigungsnummer nicht überein oder kennen Sie das Smartphone nicht, klicken Sie auf **{{ui:app.lan.deny}}**.
- Die Verbindung wird mit https verschlüsselt.
- Klicken Sie in einem unbekannten Netzwerk (etwa in einem Café) nicht auf **{{ui:app.tabs.short.homeLink}}**. Das Netzwerk, auf das Sie klicken, wird als vertrauenswürdig eingestuft, und der Zugang öffnet sich.

## Von unterwegs nutzen

Mit [Tailscale](https://tailscale.com/) können Sie novira auf Ihrem Computer auch von einem Smartphone unterwegs verwenden. Am Router müssen keine Ports geöffnet werden. Das Smartphone meldet sich mit einem Passkey (Gesicht, Fingerabdruck, Code) an, den Sie einmal zu Hause registriert haben.

### Vorbereiten

1. Installieren Sie Tailscale auf Computer und Smartphone und melden Sie sich mit demselben Konto an. Schützen Sie das Tailscale-Konto mit einer Zwei-Faktor-Authentifizierung.
2. Schalten Sie in der Verwaltungsoberfläche von Tailscale (DNS-Einstellungen) MagicDNS und HTTPS-Zertifikate ein.
3. Verwenden Sie im Tailscale-Namen des Computers keine Wörter wie Ihren echten Namen, die nicht bekannt werden sollen. Wird ein Zertifikat erstellt, erscheinen der Name des Computers und der Name des Tailnets im öffentlichen Zertifikatsprotokoll (Certificate Transparency). Allein mit dem Namen kommt niemand hinein.

### Einschalten und das Smartphone registrieren

1. Klicken Sie in der linken Leiste auf **{{ui:app.tabs.short.homeLink}}** und öffnen Sie den Tab **{{ui:app.lan.menuAway}}**.
2. Schalten Sie **{{ui:app.remote.switch}}** ein. Erscheint der Tailscale-Name des Computers (ein Name wie `pc.tail1234.ts.net`), ist alles bereit. Lässt er sich nicht öffnen, erscheint der Grund. Die eingeschaltete Einstellung bleibt auch beim nächsten Öffnen von novira erhalten.
3. Schalten Sie Tailscale auf dem Smartphone ein, klicken Sie auf **{{ui:app.remote.enrol}}** und scannen Sie den erscheinenden QR-Code. Die Registrierung ist nur zu Hause möglich (weil Sie sie am Computer erlauben).
4. Prüfen Sie auf dem Smartphone den Namen und tippen Sie auf „Registrierung starten“. Stimmt die am Computer erscheinende Bestätigungsnummer überein, klicken Sie auf **{{ui:app.lan.allow}}**.
5. Tippen Sie auf dem Smartphone auf „Passkey erstellen“ und bestätigen Sie mit Gesicht, Fingerabdruck oder Code. Das registrierte Gerät erscheint unter **{{ui:app.remote.passkeys}}**.

### Von unterwegs öffnen

Schalten Sie Tailscale auf dem Smartphone ein, öffnen Sie die Adresse, mit der Sie sich registriert haben (`https://pc.tail1234.ts.net:Portnummer/`), und tippen Sie auf „Mit Passkey anmelden“. Ein Lesezeichen ist praktisch. novira (oder die Browser-Version) muss auf dem Computer geöffnet und Tailscale auf dem Computer verbunden sein.

- Sie können dasselbe tun wie bei einer Verbindung aus dem WLAN zu Hause. Das Installieren von Modellen und Erweiterungen, die Einstellungen der Engine, die Schlüssel und die Einstellungen des Assistenten sind nur am Computer möglich.
- Die Anmeldung endet nach 30 Minuten ohne Nutzung oder 4 Stunden nach der Anmeldung. Melden Sie sich dann erneut mit dem Passkey an.
- Unter **{{ui:app.remote.log}}** stehen Datum, Uhrzeit und Gerät von Registrierung, Anmeldung und Ablehnung. Gibt es etwas, das Sie nicht kennen, löschen Sie die Registrierung dieses Geräts und ändern Sie auch das Tailscale-Passwort.
- Wenn Sie das Smartphone verloren haben, löschen Sie die Registrierung, indem Sie unter **{{ui:app.remote.passkeys}}** zweimal die Papierkorb-Schaltfläche drücken. Auch die Anmeldung dieses Geräts endet sofort. Entfernen Sie das Gerät außerdem in der Verwaltungsoberfläche von Tailscale.
- {{ui:app.remote.switch}} schaltet sich von selbst aus, wenn 14 Tage lang weder eine Registrierung noch eine Anmeldung stattgefunden hat.

## Der Smartphone-Bildschirm

Auf dem Smartphone öffnet sich ein Bildschirm für Smartphones. Er wechselt auf schmalen Bildschirmen automatisch und bleibt auch im Querformat gleich. Oben liegt eine Leiste mit dem Zeichen der App (und dem Bild, das gerade gezeichnet wird) und der Schaltfläche für den Assistenten, unten sind 6 Tabs aufgereiht.

![Der Tab Generieren auf dem Smartphone. Vorgabe, Seed und Schaltfläche zum Erzeugen, Modell und Prompt stehen untereinander](shot:phone-generate)

| Tab | Was sich tun lässt |
|---|---|
| **{{ui:app.tabs.generate}}** | Dieselben Bausteine wie im linken Bedienfeld am Computer stehen in derselben Reihenfolge untereinander ([Bilder erzeugen](02-generate.md)). Vorgabe, {{ui:params.seed.label}} und die Schaltfläche **{{ui:params.invoke.invoke}}**, Modell, Prompt, Referenzbilder bis hin zu Hochauflösungskorrektur und erweiterten Einstellungen lassen sich wie am Computer verwenden. Die Zeile mit {{ui:params.seed.label}} und der Schaltfläche **{{ui:params.invoke.invoke}}** bleibt beim Scrollen oben stehen |
| **{{ui:phone.gallery}}** | Wählen Sie ein **{{ui:phone.board}}**, werden dessen Bilder in 3 Spalten angezeigt. Bilder, die gerade gezeichnet werden, stehen vorn. Ein Tippen öffnet das Bild im Vollbild |
| **{{ui:app.views.drafts}}** | Dasselbe wie die Entwürfe am Computer ([Aus Entwürfen auswählen](04-improve.md)). Mit der Schaltfläche **{{ui:drafts.open}}** eines Kandidaten sehen Sie das Bild im Vollbild |
| **{{ui:app.tabs.queue}}** | Die wartenden Einträge, die neuesten zuerst. Auf dem Symbol des Tabs steht die Zahl der wartenden und der gerade gezeichneten Einträge |
| **{{ui:app.tabs.models}}** | Dasselbe wie der Tab {{ui:app.tabs.models}} am Computer ([Modelle verwalten und finden](08-models.md)). Weil der Bildschirm klein ist, beginnen die Karten in der kleinsten Größe |
| **{{ui:app.tabs.browse}}** | Dasselbe wie der Tab {{ui:app.tabs.browse}} am Computer. Sie können auf Civitai und Hugging Face nach Modellen suchen und sie installieren. Suche und Filter liegen in der Schaltfläche **{{ui:browse.menu}}** oben links; dort ändern Sie mit **{{ui:browse.cardSize}}** die Größe der Karten in der Liste (sie beginnt in der kleinsten Größe) |

Während ein Bild gezeichnet wird, zeigt die Kopfleiste das Zwischenbild und den Fortschritt. Ein Tippen darauf zeigt im Vollbild, wie es gezeichnet wird. Ist es fertig, wechselt die Anzeige zum fertigen Bild.

Tippen Sie im Tab **{{ui:app.tabs.models}}** auf ein Modell, öffnen sich die Details wie im Tab **{{ui:app.tabs.browse}}** über den ganzen Bildschirm. Mit **{{ui:models.detail.close}}** oben kehren Sie zur Liste zurück. Auch die Liste der Schaltfläche **{{ui:params.promptBook.open}}** unter dem Prompt öffnet sich im Vollbild, und mit dem Pfeil oben links kehren Sie zurück.

Auch wenn Sie eine Liste von Modellen, LoRAs, Vorgaben und Ähnlichem öffnen, erscheint die Tastatur nicht. Tippen Sie auf das Suchfeld, wenn Sie etwas eingeben möchten.

### Im Vollbild ansehen

![Ein im Vollbild geöffnetes Bild mit Informationen zu Prompt und Modell](shot:phone-picture)

- Mit zwei Fingern auseinanderziehen vergrößert, zusammenziehen verkleinert. Ein vergrößertes Bild verschieben Sie mit einem Finger.
- Wenn nicht vergrößert ist, wechselt das seitliche Wischen zum benachbarten Bild des Boards. Auch die Schaltflächen links und rechts tun das.
- Zweimal tippen wechselt zwischen vergrößert und ursprünglicher Größe.
- Die Schaltfläche **{{ui:gallery.viewer.toggleMetadata}}** zeigt Prompt, Modell, Seed und Größe an.
- Die Schaltfläche mit den drei Strichen oben rechts (**{{ui:phone.pictureMenu}}**) öffnet dasselbe Menü wie ein Rechtsklick auf das Bild am Computer. Es öffnet sich auch, wenn Sie lange auf das Bild drücken. Einträge, die zu Orten schicken, die es auf dem Smartphone nicht gibt, etwa Leinwand oder Workflow, erscheinen nicht.
- Mit den Schaltflächen unten lassen sich **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (übernimmt die Einstellungen dieses Bildes in den Tab „Generieren“) und **{{ui:common.delete}}** ausführen. Ob vor dem Löschen nachgefragt wird, richtet sich nach **{{ui:settings.confirmOnDelete}}** in den Einstellungen.

### Die Warteschlange bedienen

![Der Tab Warteschlange auf dem Smartphone. Ein Eintrag in Arbeit und ein wartender](shot:phone-queue)

- Mit **{{ui:queue.action.pause}}** oben (bei angehaltener Warteschlange **{{ui:queue.action.resume}}**) halten Sie die Verarbeitung der Warteschlange an oder setzen sie fort.
- Mit **{{ui:queue.action.prune}}** entfernen Sie fertige Einträge (abgeschlossen, fehlgeschlagen, abgebrochen) aus der Liste.
- Wartende und gerade gezeichnete Einträge lassen sich mit dem × rechts abbrechen. Fehlgeschlagene und abgebrochene Einträge lassen sich mit der Schaltfläche **{{ui:queue.action.retry}}** rechts erneut ausführen.
- Ein Tippen auf einen Eintrag in Arbeit oder einen fertigen Eintrag öffnet sein Bild im Vollbild.

### Mit dem Assistenten sprechen

![Der Assistent auf dem Smartphone. Eine Bitte und die Einstellungen, die der Assistent vorgenommen hat](shot:phone-chat)

Tippen Sie in der Kopfleiste auf die Funkel-Schaltfläche (**{{ui:agent.open}}**), öffnet sich der Assistent über den ganzen Bildschirm. Er kann dasselbe wie am Computer ([KI-Assistent](09-assistant-settings.md#ki-assistent)).

- Schreiben Sie unten ins Feld, was Sie zeichnen lassen oder fragen möchten, und senden Sie mit der Schaltfläche rechts. Enter macht einen Zeilenumbruch. Mit der Büroklammer-Schaltfläche links lassen sich Fotos vom Smartphone anhängen.
- Die Einstellungen, die der Assistent ändert, landen im Tab **{{ui:app.tabs.generate}}** des Smartphones. Mit **{{ui:agent.generate}}** unter der Antwort erzeugen Sie sofort, und mit **{{ui:agent.undo}}** machen Sie es rückgängig.
- Mit den Schaltflächen rechts in der oberen Leiste öffnen Sie **{{ui:agent.session.history}}** oder beginnen **{{ui:agent.session.new}}**. Mit dem Pfeil links kehren Sie zum vorherigen Bildschirm zurück.
- Die KI wählen und sich anmelden müssen Sie am Computer. Ist das noch nicht geschehen, wird das auf dem Smartphone angezeigt.

Was nicht in den 6 Tabs ist, etwa Leinwand, Workflow, Comic und Einstellungen, verwenden Sie am Computer.
