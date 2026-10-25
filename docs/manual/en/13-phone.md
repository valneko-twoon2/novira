# Using it from a phone

You can use novira on your computer from the browser of a phone on your home Wi-Fi. The computer draws the pictures; the phone only shows the screen and takes your taps. Settings, drafts, history and the rest are the same as when you open it on the computer. While phones and the computer have it open at the same time, a change made on one (the prompt, the model, LoRAs, the generation settings, presets, the prompt book and drafts) shows up on the other open screens within a second or two. The display settings (language, theme, size), what is being edited in the canvas or workflows, and the assistant's chat belong to each screen and are matched the next time it opens. The connection is encrypted, and a phone connects only after the computer allows it.

## Connecting

1. Close the novira app. Only one program at a time can use the data folder.
2. In File Explorer, open the app's folder (the one with `server.bat`), type `cmd` in the address bar at the top and press Enter. A Command Prompt opens in that folder.
3. Type `server.bat` and press Enter. The same screen also opens in the computer's browser.
4. In the computer's browser, press **{{ui:app.tabs.short.homeLink}}** in the bar on the left. The network you are on is remembered as your home network, and the door opens.
5. A QR code appears. Scan it with the camera of a phone on the same Wi-Fi as the computer, and open the address it finds. The code expires after 2 minutes and works for one phone only. When it runs out, press **{{ui:app.lan.newCode}}**.
6. On a phone you have not used before, the browser shows a certificate warning. Follow "Installing the certificate" below to install the certificate.
7. On the phone, check the name of the device and press "Connect". The phone shows a 6-digit code. The same number appears on the computer, in the **{{ui:app.tabs.short.homeLink}}** screen (or as a notice in the corner of the screen when it is not open); if they match, press **{{ui:app.lan.allow}}**. novira opens on the phone.

To stop, press Ctrl+C in the Command Prompt, or close its window.

### Installing the certificate

novira encrypts the connection to the phone with a certificate made on this computer (novira local CA). Until the phone knows this certificate, the browser warns that the connection is not secure. Install it on the phone once. Open "Install the certificate" at the bottom of the phone's screen and download the certificate with the link.

- iPhone: tap the link and tap "Allow", then install the profile from "Profile Downloaded" at the top of the Settings app. After that, in Settings open "General", "About", "Certificate Trust Settings" and turn on novira local CA. If you skip this last step, the warning stays even after the certificate is installed.
- Android (Chrome): in Settings, open "Security", "Install certificate", "CA certificate" and choose the downloaded certificate. Firefox does not use certificates added afterwards; open it in Chrome.

### Closing it

There is no button to close the door to the home network. Closing the popup leaves connected phones working.

- It closes by itself after 30 minutes when nobody uses it and no code or request is waiting.
- It also closes by itself when the computer is no longer on the network you trusted, for example after moving to another Wi-Fi.
- A connected phone can be cut off one at a time with the × in the list. A phone's connection ends after 30 minutes unused, or 4 hours after it connected.

### When Windows asks

At the first start, Windows asks whether novira-server may communicate. Allow it on private networks.

When Windows treats the network you are on as "Public", the screen shows a warning. Open it only on a network that is yours. If the phone still cannot connect, in Windows Settings, under "Network & internet", open the properties of the Wi-Fi (or cable) connection you use and set the network profile type to "Private network".

### Which devices can connect, and a caution

- Only devices on the same network as this computer (the same range of the same router) are answered. A phone away from home, or one going through a VPN, cannot connect.
- Even a device on the same Wi-Fi cannot use it unless the computer allows it. Do not show the QR code to others. If the number differs, or you do not know the phone, press **{{ui:app.lan.deny}}**.
- The connection is encrypted with https.
- On a network you do not know (a café, for example), do not press **{{ui:app.tabs.short.homeLink}}**. The network you press it on is trusted, and the door opens.

## The phone screen

On a phone the page takes a layout made for phones. It switches by itself on a narrow screen, and stays so when you turn the phone on its side. A bar with the app's mark (and the picture being drawn) and the agent's button runs along the top, and six tabs along the foot.

![The phone's Generate tab: presets, the seed and Generate row, the model and the prompts in one column](shot:phone-generate)

| Tab | What you can do |
|---|---|
| **{{ui:app.tabs.generate}}** | The same parts as the desktop's left panel, in the same order, in one column ([Making pictures](02-generate.md)). Presets, the {{ui:params.seed.label}} and the **{{ui:params.invoke.invoke}}** button, the model, the prompts, reference images, the high-resolution fix and the advanced settings all work as on the computer. The row with the {{ui:params.seed.label}} and the **{{ui:params.invoke.invoke}}** button stays at the top as you scroll |
| **{{ui:phone.gallery}}** | Pick a **{{ui:phone.board}}** and its pictures show three to a row. Pictures being drawn come first. Tap one to open it full screen |
| **{{ui:app.views.drafts}}** | The same as the drafts on the computer ([Choosing from drafts](04-improve.md#choosing-from-drafts)). The **{{ui:drafts.open}}** button of a candidate shows its picture full screen |
| **{{ui:app.tabs.queue}}** | The items waiting in the queue, newest first. The tab's icon shows how many are waiting and being drawn |
| **{{ui:app.tabs.models}}** | The same as the **{{ui:app.tabs.models}}** tab on the computer ([Getting models](08-models.md)) |
| **{{ui:app.tabs.browse}}** | The same as the **{{ui:app.tabs.browse}}** tab on the computer. Search Civitai and Hugging Face for models and install them. Search and filters are inside the **{{ui:browse.menu}}** button at the top left; its **{{ui:browse.cardSize}}** slider changes how big the cards are |

While a picture is being drawn, the title bar shows it in progress with its step. Tap it to watch it being drawn full screen. When it is done, it turns into the finished picture.

Tap a model on the **{{ui:app.tabs.models}}** tab and its details fill the screen, as they do on the **{{ui:app.tabs.browse}}** tab; **{{ui:models.detail.close}}** at the top goes back to the list. The **{{ui:params.promptBook.open}}** button under a prompt opens its list full screen too, and the arrow at the top left goes back.

Opening a list such as the model, the LoRAs or the presets does not bring up the keyboard. Tap the search box when you want to type.

### Full screen

![A picture open full screen, with its prompts, model and other information](shot:phone-picture)

- Spread two fingers to zoom in, pinch to zoom out. Move a zoomed picture with one finger.
- When it is not zoomed, swipe sideways to go to the next picture of the board. The side buttons do the same.
- Tap twice to switch between zoomed in and the full picture.
- The **{{ui:gallery.viewer.toggleMetadata}}** button shows the prompts, model, seed and size.
- The three-line button at the top right (**{{ui:phone.pictureMenu}}**) opens the same menu as right-clicking a picture on the computer. Pressing and holding the picture opens it too. Items that send the picture to a place the phone does not have, such as the canvas or workflows, are left out.
- The buttons at the foot are **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (puts the picture's settings in the Generate tab) and **{{ui:common.delete}}**. Whether it asks before deleting follows **{{ui:settings.confirmOnDelete}}** in Settings.

### Working with the queue

![The phone's Queue tab: an item being drawn and one waiting](shot:phone-queue)

- **{{ui:queue.action.pause}}** at the top (**{{ui:queue.action.resume}}** while paused) stops and restarts the queue.
- **{{ui:queue.action.prune}}** removes the finished items (completed, failed, canceled) from the list.
- An item waiting or being drawn can be canceled with the × on its right. A failed or canceled item can be run again with the **{{ui:queue.action.retry}}** button on its right.
- Tap an item being drawn or a finished one to open its picture full screen.

### Talking to the agent

![The agent on a phone: a request and what the agent set](shot:phone-chat)

Tap the sparkle button in the title bar (**{{ui:agent.open}}**) and the agent opens over the whole screen. It does the same as on the computer ([The agent](09-assistant-settings.md#the-agent)).

- Write the picture you want or your question in the box at the foot and send it with the button on its right. Enter starts a new line. The paperclip button on the left attaches photos from the phone.
- The settings the agent changes go into the phone's **{{ui:app.tabs.generate}}** tab. **{{ui:agent.generate}}** under its answer draws at once, and **{{ui:agent.undo}}** puts things back.
- The buttons on the right of the top bar open **{{ui:agent.session.history}}** or start a **{{ui:agent.session.new}}**. The arrow on the left goes back to the screen you were on.
- Choosing the AI and signing in is done on the computer's screen. Until then, the phone says so.

Everything that is not on the six tabs, such as the canvas, workflows, comics and settings, is used on the computer.
