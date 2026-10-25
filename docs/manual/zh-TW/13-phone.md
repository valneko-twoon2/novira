# Using it from a phone

You can use novira on your computer from the browser of a phone on your home Wi-Fi. The computer draws the pictures; the phone only shows the screen and takes your taps. Settings, drafts, history and the rest are the same as when you open it on the computer.

## Connecting

1. Close the novira app. Only one program at a time can use the data folder.
2. In File Explorer, open the app's folder (the one with `server.bat`), type `cmd` in the address bar at the top and press Enter. A Command Prompt opens in that folder.
3. Type `server.bat` and press Enter. The same screen also opens in the computer's browser.
4. The Command Prompt shows an address for your home network and a QR code. Scan the QR code with the camera of a phone on the same Wi-Fi as the computer, and open the address it finds.

To stop, press Ctrl+C in the Command Prompt, or close its window.

The address carries a pass code (a token) that changes at every start. After a restart, scan the new QR code.

### When Windows asks

At the first start, Windows asks whether novira-server may communicate. Allow it on private networks.

If the phone still cannot connect, check whether the computer treats the current network as "Public". In Windows Settings, under "Network & internet", open the properties of the Wi-Fi (or cable) connection you use and set the network profile type to "Private network".

### Which devices can connect, and a caution

- Only devices on the same network as this computer (the same range of the same router) are answered. A phone away from home, or one going through a VPN, cannot connect.
- Even a device on the same Wi-Fi cannot use it without the token in the address. Do not show the QR code or the address to others.
- The connection is not encrypted (http). That is why the phone's browser says "Not secure". Use it on a home Wi-Fi with a password, never on a shared one such as a café's.

## The phone screen

On a phone the page takes a layout made for phones. It switches by itself on a narrow screen, and stays so when you turn the phone on its side. A title bar runs along the top, and four tabs along the foot.

![The phone's Generate tab: model, prompts, aspect, seed, iterations and the Generate button at the foot](shot:phone-generate)

| Tab | What you can do |
|---|---|
| **{{ui:app.tabs.generate}}** | Set the {{ui:params.model.label}}, the {{ui:params.prompt.positive}} and {{ui:params.prompt.negative}} prompts, the {{ui:params.image.aspect}}, the {{ui:params.seed.label}} and the {{ui:params.invoke.iterations}}, then make the pictures with the **{{ui:params.invoke.invoke}}** button at the foot. When it cannot make them, the reason shows above the button |
| **{{ui:gallery.view.images}}** | Pick a **{{ui:phone.board}}** and its pictures show three to a row. Pictures being drawn come first. Tap one to open it full screen |
| **{{ui:app.views.drafts}}** | The same as the drafts on the computer ([Choosing from drafts](04-improve.md#choosing-from-drafts)). The **{{ui:drafts.open}}** button of a candidate shows its picture full screen |
| **{{ui:app.tabs.queue}}** | The items waiting in the queue, newest first. The tab's icon shows how many are waiting and being drawn |

LoRAs, reference images and the advanced settings are not on the phone's **{{ui:app.tabs.generate}}** tab. What you set on the computer is used as it is.

While a picture is being drawn, the title bar shows it in progress with its step. Tap it to watch it being drawn full screen. When it is done, it turns into the finished picture.

### Full screen

![A picture open full screen, with its prompts, model and other information](shot:phone-picture)

- Spread two fingers to zoom in, pinch to zoom out. Move a zoomed picture with one finger.
- When it is not zoomed, swipe sideways to go to the next picture of the board. The side buttons do the same.
- Tap twice to switch between zoomed in and the full picture.
- The **{{ui:gallery.viewer.toggleMetadata}}** button shows the prompts, model, seed and size.
- The buttons at the foot are **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (puts the picture's settings in the Generate tab) and **{{ui:common.delete}}**. Whether it asks before deleting follows **{{ui:settings.confirmOnDelete}}** in Settings.

### Working with the queue

![The phone's Queue tab: an item being drawn and one waiting](shot:phone-queue)

- **{{ui:queue.action.pause}}** at the top (**{{ui:queue.action.resume}}** while paused) stops and restarts the queue.
- **{{ui:queue.action.prune}}** removes the finished items (completed, failed, canceled) from the list.
- An item waiting or being drawn can be canceled with the × on its right. A failed or canceled item can be run again with the **{{ui:queue.action.retry}}** button on its right.
- Tap an item being drawn or a finished one to open its picture full screen.

Everything that is not on the four tabs, such as the canvas, workflows, comics, models, settings and the agent, is used on the computer.
