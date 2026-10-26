# The Agent, Settings and Shortcuts

This chapter explains the agent that sets things up for you when you tell it in words, the settings screen, the list of keyboard shortcuts, the screen with information about the app, and the developer log.

The settings screen, the keyboard shortcuts and the information about the app are opened from the **{{ui:app.nav.settingsMenu}}** at the lower left of the screen.

## The agent

![The agent window. The first screen, where you choose which AI to use and sign in](shot:agent)

When you press the **AI** button (**{{ui:agent.open}}**) in the navigation on the left, the **{{ui:agent.title}}** window opens. You can move the window by dragging its heading.

Instead of choosing models and LoRAs or setting the prompt and size yourself, you tell it what you want to make in words, such as "an anime-style girl standing on a beach at sunset", and the agent chooses the settings and fills them in for you.

### Getting started (signing in)

novira does not run an AI by itself for the agent. It calls an AI command that is on your computer (Claude or Codex) to produce the answers. To use it, you need the following preparation.

1. Install one of the commands on your computer: **Claude** from Anthropic or **Codex** from OpenAI.
2. Open the agent and press the one you want to use (**{{ui:agent.setup.claude}}** or **{{ui:agent.setup.codex}}**).
3. A browser opens, and you sign in there.

If that command cannot be found on your computer, a message appears that says "The … command was not found on this PC. Install it first."

The service you use, and your contract with it, are those of whichever one you chose. For Claude and Codex, novira does not save API keys. What is exchanged (the text you sent, and what the agent read in the app for its work, such as the list of models, the settings and the comic or text that is open) is sent to the service you chose. The information of the gallery's pictures and the prompts of the Generate tab are read only when you allow it (see "Permission to read pictures and prompts" below).

The AI you chose is shown in the heading at the top of the window. If you want to change it, press the **{{ui:agent.changeProvider}}** button at the top.

### Connecting to Ollama or another server

![The form for connecting to a server. The Ollama button, the address, the model and the result of the connection test](shot:agent-server)

Besides Claude and Codex, the agent can use a server on your computer or your network that offers an OpenAI-compatible API, such as Ollama or LM Studio. novira asks the server for the answers and runs the agent's tools (changing settings, editors and so on) itself, so the model has to be one that can call tools.

To connect it:

1. Open the agent and press **{{ui:agent.setup.openai}}**.
2. Press the button of the server you use (for Ollama, the **Ollama** button). It fills in the address and reads the list of models the server has. Otherwise type the address, which usually ends in /v1, under **{{ui:agent.endpoint.address}}**.
3. Choose the model under **{{ui:agent.endpoint.model}}** from the list, or type its name when the server gives no list.
4. If the server asks for a key, type it under **{{ui:agent.endpoint.key}}**. It is saved encrypted on this PC and sent only to this server. A server on your own PC usually needs none.
5. Press **{{ui:agent.endpoint.test}}**. It checks that the server answers, that the model is there, and that the model can call the app's tools.
6. Press **{{ui:agent.endpoint.use}}**.

If the model cannot call tools, the test says so and gives the server's reason, a warning stays above the input, and sending a message is refused. Choose another model with the button next to the chat's name; that also lets you check again. The test fails in the same way when the server's context window is too small for the agent's request, which is the case with Ollama's standard setting: set the context length of the server to 32768 or more (in Ollama's settings, or with the OLLAMA_CONTEXT_LENGTH environment variable) and press **{{ui:agent.endpoint.test}}** again. novira does not pretend that a model can use the tools.

The chat's heading shows OpenAI API when a server is in use. Press **{{ui:agent.changeProvider}}** to go back to the choice. The server you entered stays in the form.

A server that is not on this PC gets what you send and what the agent reads, when you allow it, over the network. A warning shows under the address for such a server, and for one that does not use https because everything, the key included, then travels unencrypted. The question "{{ui:agent.permission.title}}" says where what it reads is sent. What a server answers is treated as plain text and as requests that pass the same checks as those of Claude and Codex.

### What it does for you

From your text, the agent decides the following and fills it into the settings. What it filled in is shown as a list in its reply.

| What | Example |
|---|---|
| Choosing a model | Chooses a suitable one from the models you have |
| Adding a LoRA | Adds a LoRA that fits the art style |
| Prompt | Writes the prompt and the negative prompt |
| Changing settings | Size, steps, CFG, scheduler, seed |
| Workflow | Builds a graph, or fixes the graph that is open (music, video and speech graphs made of ComfyUI's own nodes too; you run it yourself with the **{{ui:params.invoke.invoke}}** button) |
| Text | Fixes the text and speech bubbles open in **{{ui:media.tab.text}}** |
| Video, music, voice | Changes the settings of each of those screens |
| Comic | On **{{ui:app.tabs.comic}}**, changes the panel layout, adds and cuts panels, and changes each panel's prompt and pose, and the balloons (see "Getting help with a comic" below) |
| Pose | Places a figure for a pose you ask for in words, on **{{ui:app.tabs.canvas}}** (see [Drawing more on the canvas](05-canvas.md#making-a-pose-on-the-canvas)) |
| Generating | Only when you ask, queues the current settings or the comic's panels for generation |
| Extension recommendations | Points you to extensions that suit what you want to do, which you can install from a button |
| Questions about the app | Answers with the names of the screens and where to press |
| Explaining extensions | Says what an extension does and how to use it (see "Asking about the app and extensions" below) |

The agent looks at which screen you have open. For example, if you open **{{ui:media.tab.text}}** and say "make the text vertical", that text changes.

The agent puts what it changes on the screen at once, while it works. While it works, what it has changed is listed under "{{ui:agent.thinking}}". It makes pictures or videos only when you ask (it queues them). Otherwise it only changes settings, so if the result looks good, press **{{ui:agent.generate}}** in its reply and it starts making right away. While a comic is open, a "Generate all pages" button also shows next to it. Pressing it queues every panel that has a prompt, on all pages (nothing is queued unless you press it). It does not delete pictures or install models or extensions (for extensions it only gives recommendations).

### Getting help with a comic

If you ask with **{{ui:app.tabs.comic}}** open, the agent reads the page that is open (the shapes of the panels, each panel's prompt, the poses and the balloons) and rewrites it directly. For example, you can ask like this.

- Ask "Make it 5 panels with a big moment. Make the first panel large and cut it at a slant" and it makes the panel layout. When you do not say how, it cuts the page as real manga pages are cut: tiers of unequal height and panels of unequal width, a large panel for the key moment, and, to suit the scene, slanted cuts or a panel that runs to the edge of the paper. The space between tiers is wider than the space between panels side by side, and the cut changes from page to page. It may also use a built-in template, or decide the shapes of the panels itself.
- Ask "Write a prompt for each panel for this story" and it writes a prompt for each panel, with a composition that suits the flow of the story (close-up, long shot, low angle and so on).
- Ask "Write a stage direction for each panel for this story" and it writes the scene of each panel in words (the place, the time, who does what).
- Ask "Put dialogue in each panel" and it places balloons and puts the lines in them. When a line runs out of its balloon, the words are made smaller to fit.
- Ask "Make the girl in panel 2 pose as if she is running" and it gives that panel a pose. It also writes the cast (the look of each character) so faces and clothes stay the same in every panel, and keeps each balloon small, beside the person who speaks and away from the others.
- Ask "Make a new comic and lay out 30 pages" and it makes a new comic, adds the pages, and goes through the layouts, prompts and dialogue to the end. Asked from another screen, it switches to the comic screen to work. Even a long job goes on until it is done, within one request. Press **{{ui:agent.stop}}** to stop it.

It draws the pictures only when you ask (it queues them). Otherwise, once the prompts are in, press **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}** or **{{ui:comic.comic.drawAll}}**. Ask "draw all the pages" and it queues every panel of every page at once; the "Generate all pages" button under its reply does the same. Pressing **{{ui:agent.undo}}** puts back, all at once, the comic pages that reply changed.

### Attaching pictures

You can send pictures with a message and ask, for example, "write a prompt based on this picture".

- Press the paperclip button left of the message box (**{{ui:agent.attach.add}}**) and choose pictures on your PC.
- You can also drag pictures from the gallery, or picture files from your PC, and drop them on the message box.
- You can also paste a copied picture into the message box.

The attached pictures line up above the message box; the × at the top right of each takes it off. A message can carry up to four pictures. If you send pictures without any text, it is the same as asking "{{ui:agent.attach.defaultAsk}}". Pictures from your PC also go into the gallery. The pictures are sent with that message to the AI you chose (Claude, Codex or the server you connected). They do not go with later messages, so attach a picture again to ask about it again. A model that cannot read pictures cannot answer well.

### Permission to read pictures and prompts

The information of the gallery's pictures (their prompts, models and so on) and the prompt boxes of the Generate tab may hold things you do not want to show. So when the agent wants to read them, at first a question "{{ui:agent.permission.title}}" appears in the chat, with what it wants to read.

- **{{ui:agent.permission.once}}**: lets it read this once. The next time it wants to read, you are asked again.
- **{{ui:agent.permission.always}}**: lets it read from now on without asking (the setting changes to **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: does not let it read. The agent goes on without it, or tells you what it would need.

While the comic screen is open, the agent may look at a page it has drawn (when you ask, to check how the characters look and where the balloons are). The same question appears, and the picture of the page is sent only when you allow it. It does not look on other screens.

Whether you are asked can be changed with **{{ui:settings.assistantRead.label}}** under **{{ui:settings.section.assistant}}** on the **{{ui:settings.tab.generation}}** tab of the settings (see "Settings" below). The screens you ask the agent to work on, such as the comic, the text, the workflow, the video, music and voice screens and the poses on the canvas, are read without asking.

### Looking things up on Wikipedia

While it works on a story (a historical period, clothing, a place, a trade, a term), the agent can look a fact up on Wikipedia, in Japanese or English, and read the opening of up to three articles. Only a short search phrase leaves your PC, and it goes to Wikipedia only; the app itself sends it, never the screen. Because the phrase goes out over the internet, you are asked first, in the chat: "{{ui:agent.permission.webTitle}}", with the words it would send.

- **{{ui:agent.permission.once}}**: lets it look up this once. The next time it wants to look something up, you are asked again.
- **{{ui:agent.permission.always}}**: lets it look things up from now on without asking (the setting changes to **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: does not let it. The agent goes on with what it knows and does not ask again in that request.

This is its own setting, **{{ui:settings.assistantWeb.label}}**, under **{{ui:settings.section.assistant}}** on the **{{ui:settings.tab.generation}}** tab of the settings. Allowing it to read your pictures does not allow lookups, and the other way round. The text of Wikipedia is licensed CC BY-SA 4.0, so when the agent uses a fact it names the article it came from. Its answers can still be wrong: check anything that matters.

### Choosing the model and the thinking effort

Press the small brain-shaped button to the right of the chat's name to choose the **{{ui:agent.model.label}}** and the **{{ui:agent.effort.label}}** the agent uses. What you choose is used from the next message you send. Claude and Codex each remember their own choice.

- For Claude, the model is chosen from **{{ui:agent.model.default}}**, Fable, Opus, Sonnet and Haiku. Press **{{ui:agent.model.custom}}** to type a model name directly. The thinking effort has 5 levels, from **{{ui:agent.effort.low}}** to **{{ui:agent.effort.max}}**.
- For Codex, the model is chosen from **{{ui:agent.model.default}}** and the list of models Codex says your account can use (the list is read from what Codex saved on your PC; a name cannot be typed). Only the thinking efforts the chosen model takes are shown (some models take up to **{{ui:agent.effort.ultra}}**).
- For a server, the models the server lists are shown, and you can type a name. There is no thinking effort. The model is part of the server's settings, so choosing another one saves it.

With **{{ui:agent.model.default}}**, the command decides the model. One thinking effort is always chosen. At first it is the model's standard effort, and when you switch to a model that does not take the current effort, it goes back to that model's standard effort.

### Changing the height of the message box

Drag the wide bar on the top edge of the message box up to make the box taller, or down to make it shorter. You can also select the bar and press the up and down arrow keys. The height stays the same the next time you open the window.

### Calling up a template

Type "/" at the start of the input box and a list of templates for requests you often make opens. Type letters after the "/" and the list narrows to those whose name, command or text contains them (for example "/comic").

Choose with the up and down arrow keys, and confirm with Enter or Tab. Pressing a row in the list also confirms it. The text of the chosen template goes into the input box, so add the rest and then send it (choosing it does not send it). The Esc key closes the list.

### Asking about the app and extensions

Besides asking it to set things, you can ask it questions. For example, "How do I remove a background?" or "Where do I add a model?" It answers with the names of the screens as they appear, and says where to press. It answers in the language you are using.

You can also ask about extensions. It explains in plain words what an extension does, when to use it and how. There are three ways to ask:

- Press a card in **{{ui:app.nav.extensions}}** to open its details, then press **{{ui:agent.ask.button}}**. A question about that extension is sent in a new chat.
- Type a word in the search box at the top of **{{ui:app.nav.extensions}}**, then press **{{ui:agent.ask.resultsButton}}**, which appears. It explains how the extensions it found (up to the first 8) differ, and which to try first.
- Write the name of an extension (in Latin letters) in the chat and ask. It looks through the published extensions for ones whose name or description matches (and loads the list first if it is not loaded yet).

For an extension you have installed, it also names the nodes the extension adds and what to connect them to. For one you have not installed yet, a card comes with the reply, and you can install it right there with **{{ui:workflows.packs.install}}**.

> The explanation is based on the extension's published description and its node information. The agent should say so when it does not know, but it can still be wrong. Check the extension's page before you install it.

### Undoing

A reply that changed settings or edits gets an **{{ui:agent.undo}}** button. Pressing it puts back, all at once, the settings and edits that request changed, to what they were before it. What it queued for generation is not canceled (cancel it in the queue).

However, after you reopen the app, changes made before that cannot be undone (the button can no longer be pressed).

### Chat history

Your exchanges with the agent are kept as a "chat". When you press the chat's name at the top of the window, the **{{ui:agent.session.history}}** list opens.

- Choose from the list and you can continue from where that chat left off.
- With **{{ui:agent.session.rename}}**, you can give it a name.
- With **{{ui:agent.session.delete}}**, you can remove it.
- With **{{ui:agent.session.new}}** at the side, you can start a new chat.

You can select the text of the chat by dragging and copy it. The button at the bottom right of each message (**{{ui:agent.copy}}**) copies the whole text of that message.

> While you are waiting for a reply, you cannot send another message. Wait until the "{{ui:agent.thinking}}" display goes away, or cancel with the **{{ui:agent.stop}}** button that takes the place of the send button. What changed before you canceled stays, and **{{ui:agent.undo}}** puts it all back.

Drag any of the four edges or four corners of the window to change its size. The bottom-right corner shows a mark for this. The size is remembered. When a reply comes with how the AI read your request, it shows as one line above the reply. Press it to open the whole account (**{{ui:agent.thoughts.label}}**). It is the AI's own short summary of how it read the request and why it chose what it did, not its raw internal thinking.

## Settings

![The settings screen. The tabs are listed on the left, and the chosen tab's items on the right](shot:settings)

When you choose **{{ui:app.nav.settings}}** from the **{{ui:app.nav.settingsMenu}}** at the lower left, the settings screen opens. Choose a tab on the left, and its items are shown on the right. What you change is used right away and stays even after you close the app. When you open the screen again, the tab you looked at last opens. The version of the app is shown below the list of tabs.

> This picture is a sample screen running in a browser. It does not show **{{ui:settings.uiZoom.label}}**, which exists only in the desktop version.

### {{ui:settings.tab.general}}

| Item | What it is |
|---|---|
| {{ui:settings.language.label}} | Choose from {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} and {{ui:settings.language.de}}. The words on the screen switch right away |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (the default) or **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | Desktop version only. The size of the whole screen. You can choose from 50% to 300%. You can also change it with `Ctrl` and `+` / `-` |
| {{ui:settings.startTab.label}} | The tab shown first when the app opens. At first it is **{{ui:app.tabs.generate}}**. Choose **{{ui:settings.startTab.last}}** to open the tab that was open when you closed the app |
| {{ui:settings.waitForEngine.label}} | On at first: the start-up screen waits until the image engine has finished loading. Turn it off to open the app while the engine is still loading; its state shows in a banner |
| {{ui:settings.toastSeconds.label}} | How many seconds a notification stays before it closes by itself, from 2 to 15 (3.5 at first) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**: Shows pictures in progress smoothly in the "{{ui:gallery.generating.title}}" frame of the gallery. If it is off, they look like rough dots.
- **{{ui:settings.draftCount.label}}**: the starting value of the count when you open the Drafts screen (1 to 24 pictures; 4 at first). You can still change it there each time.
- **{{ui:settings.draftPosition.label}}**: the starting value of the position when you open the Drafts screen (25 to 60 %; 35 % at first).
- **{{ui:settings.lowMemory.label}}**: for computers whose GPU has little memory. When it is on, models are not kept in GPU memory, so less memory is needed but making is slower. Switching it restarts the engine. While an item is being made, it applies the next time the engine starts. It cannot be used while the app is connected to an engine started elsewhere.
- **{{ui:settings.assistantRead.label}}** (**{{ui:settings.section.assistant}}**): whether the agent may read the information of the gallery's pictures and the prompts of the Generate tab. Choose from **{{ui:settings.assistantRead.ask}}** (the default), **{{ui:settings.assistantRead.always}}** and **{{ui:settings.assistantRead.never}}**.
- **{{ui:settings.assistantWeb.label}}** (**{{ui:settings.section.assistant}}**): whether the agent may look facts up on Wikipedia. It is asked and chosen the same way, apart from reading pictures.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}**: the same items as the **{{ui:gallery.settings.title}}** that the gallery's gear button opens. Changing them in either place changes them in both.
- **{{ui:settings.confirmOnDelete}}**: Shows a confirmation before deleting an image. This also becomes off when you choose "{{ui:common.dontAskAgain}}" on the confirmation screen.
- **{{ui:settings.clearIntermediates}}**: Deletes images that do not appear in the gallery, such as intermediate results from the canvas. The number to be deleted is shown on the button.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**: How many edits can be undone in the canvas, comic, text and workflow editors, from 10 to 200 (60 at first). More steps use more memory.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**: The font for the words of balloons that have no font of their own. Choose from the app's fonts or the fonts installed on this computer. **{{ui:common.font.standard}}** is the app's standard lettering.
- **{{ui:settings.textFont.label}}**: The font for the text you add on the text screen. It is chosen the same way as the balloon font.
- **{{ui:settings.section.comicPage}}**: Sets the **{{ui:comic.page.size}}**, **{{ui:comic.page.direction}}**, **{{ui:settings.comicPage.panels}}** (1 to 6), **{{ui:comic.page.frameWidth}}** and **{{ui:comic.page.margin}}** of new comics and of the pages you add later. Pages you already have do not change.

### {{ui:settings.tab.engine}}

Where the app keeps its data and how the image engine (ComfyUI) starts. What you change here is used from the next time the app starts (a note at the top says so).

| Item | What it is |
|---|---|
| {{ui:settings.engine.dataDir.label}} | The folder that holds your pictures, models, the image engine and so on. At first it is `novira-data` in your user folder. **{{ui:settings.engine.dataDir.change}}** first asks what happens to the current data. **{{ui:settings.engine.dataDir.dialog.move}}** moves it into the folder you choose, which may hold other things as long as none has the name of a part of the data (done first thing at the next start, so a large library takes a while). **{{ui:settings.engine.dataDir.dialog.use}}** leaves it and opens the folder you choose (its data if it has any, a new library if it is empty). Then a folder dialog opens, and the place you pick is used from the next start. **{{ui:settings.engine.dataDir.cancel}}** withdraws the change. If a move cannot be done, the reason is shown and the app starts with the current folder. When the environment variable `NOVIRA_DATA_DIR` fixes it, it cannot be changed here |
| {{ui:settings.engine.comfyui.label}} | The ComfyUI in use. Usually it is in `comfyui` inside the data folder, and that place is shown. When another ComfyUI is named in the settings file, its place is shown. **{{ui:settings.engine.comfyui.change}}** changes where the ComfyUI that the app installs goes. An empty folder gets a new install at the next start (a large download); a folder that already holds an install is used as it is. Files at the old place are not removed by themselves. To put it back inside the data folder, choose `comfyui` there |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** or **{{ui:settings.engine.package.amd}}**. Used the next time ComfyUI is downloaded (the first install or a change of version). When ComfyUI is installed, choosing the other kind asks you to confirm first. Once you confirm, ComfyUI is installed again with the chosen kind the next time novira starts (the download is large and takes a while) |
| {{ui:settings.engine.timeout.label}} | How many seconds to wait for ComfyUI to answer after starting it, from 30 to 1800. Make it longer on a slow computer |
| {{ui:settings.engine.modelRoots.label}} | Folders searched for models besides models in the data folder. Press **{{ui:settings.engine.modelRoots.add}}** to open a window to choose a folder. The folder layouts of ComfyUI and Stability Matrix are understood. The model packs of the video, music, voice, logo and erase features are found there too (only read; new ones are always installed in the data folder). Up to 16 can be added. A folder inside the data folder, or one already listed, cannot be added. Remove one with its × button. In a browser, folders can only be removed, not added |

### {{ui:settings.tab.accounts}}

These are fields for when a site that distributes models requires you to sign in. What you enter is encrypted and saved on this computer, and is not shown on the screen.

| Item | What it is |
|---|---|
| {{ui:settings.civitaiKey.label}} | Used to download models that require signing in |
| {{ui:settings.hfToken.label}} | Used to download models that require an access request |

Paste it in and press **{{ui:settings.civitaiKey.save}}**. Afterward you can also **{{ui:settings.civitaiKey.change}}** or **{{ui:settings.civitaiKey.remove}}** it.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![The Backup part of the settings: the buttons to create a backup and to restore from one](shot:settings-backup)

You can save your pictures and what you set up and registered in the app into one zip file, to move to another computer or just in case.

- **{{ui:share.backup.createLabel}}**: A window opens to choose where to save it. The file name starts as "novira-backup-date-time.zip". With many pictures it takes a while, and the progress shows in this part.
- **{{ui:share.backup.restoreLabel}}**: Choose a backup zip file. Its contents are checked, then a confirmation window opens.

What a backup contains and what it does not:

| Included | Not included |
|---|---|
| The gallery's pictures, videos and sounds, with their thumbnails | Models |
| Boards, workflows, comics and the queue's records | The image engine (ComfyUI) and extensions |
| Characters, presets, the prompt list, drafts, the agent's chats and the screen settings | API keys and tokens, and settings that belong to this computer (such as where ComfyUI is) |

![The restore confirmation: when the backup was made, what it holds, and the warning that everything is replaced](shot:restore-confirm)

The confirmation window shows when the backup was made and how many images, boards and workflows it holds. Press **{{ui:share.backup.confirm}}**: the app closes and starts again, and your current data is replaced with the backup's. If that fails, the previous data is put back and you are told so.

> Replaced data cannot be brought back; create a backup of the current state first if you may need it. API keys and tokens are encrypted for this computer only, so enter them again under **{{ui:settings.tab.accounts}}** after a restore. In a browser, backups can be neither created nor restored; use the desktop app.

#### {{ui:settings.section.unfinished}}

When a download stops halfway, the part already received stays in the data folder. This part shows the name, the folder and the size of each leftover file. **{{ui:settings.unfinished.delete}}** deletes one, and **{{ui:settings.unfinished.deleteAll}}** deletes all of them (you are asked to confirm first). The next time the same download starts, it continues from its leftover file; if you delete the file, that download starts again from the beginning. A file in use is not deleted and stays.

#### {{ui:settings.section.reset}}

Choose what to put back with **{{ui:settings.reset.scope.label}}**, press **{{ui:settings.resetWebUi}}**, then press **{{ui:settings.resetConfirm}}** again to confirm. Pictures, models, comics and the canvas are kept.

The state of the screens (settings, presets, drafts, history and so on) is kept in the data folder. As long as both use the same data folder, the desktop app and the browser show the same content. The two cannot be open at once; what you did in one is there when you open the other. A reset applies to both.

| Part | What goes back to how it was at first |
|---|---|
| {{ui:settings.reset.scope.settings}} | The items of the settings screen, at once |
| {{ui:settings.reset.scope.generation}} | The prompts, the model and the parameters of the generation screen |
| {{ui:settings.reset.scope.gallery}} | The gallery display (thumbnail size, order and so on) |
| {{ui:settings.reset.scope.assistant}} | The chats with the agent, which are all deleted |
| {{ui:settings.reset.scope.all}} | Every setting and screen state saved in the browser. Presets, characters, prompt lists and the agent chats are deleted too |

Except for "{{ui:settings.reset.scope.settings}}", the change applies when you press the **{{ui:settings.reload}}** button that appears after confirming, and the screen loads again.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**: Shows a "{{ui:app.devlog.short}}" button in the navigation on the left (see "Developer log" below).

## Keyboard shortcuts

![The list of keyboard shortcuts. Actions and keys are lined up by category, such as App and Canvas](shot:hotkeys)

Choose **{{ui:app.nav.hotkeys}}** from the **{{ui:app.nav.settingsMenu}}** at the lower left, or press `Shift+?`, and the list opens. With the search field at the top, you can search by action name or key.

Here are the commonly used ones. For all of them, check the list on the screen.

### The whole app

| Key | Action |
|---|---|
| `Ctrl+Enter` | Generate (add to the queue) |
| `Ctrl+Shift+Enter` | Add to the front of the queue and generate |
| `Shift+X` | Cancel the item being processed |
| `Ctrl+Shift+X` | Clear the whole queue |
| `Alt+A` | Move to the prompt field |
| `T` | Open and close the left panel |
| `G` | Open and close the gallery (the right panel) |
| `F` | Open and close both panels together |
| `1` to `9` | Go to the numbered tab |
| `Shift+?` | Open the list of shortcuts |
| `Ctrl` + `+` / `-` | Zoom the whole screen in and out |

### Canvas

| Key | Action |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Move the view |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Make the brush smaller and larger |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Switch with the previously used tool |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### The gallery and the viewer

| Key | Action |
|---|---|
| Arrow keys | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (load everything except the seed) |
| `P`, `S`, `A` | Load the prompt, the seed, everything |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Workflows

| Key | Action |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Delete the chosen nodes and connections |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

While you are typing in a field, single-letter keys such as `T` and `G` do not work.

## About this app

![The screen with information about the app. The logo, the version, the license and the list of open source software in use](shot:about)

When you choose **{{ui:app.nav.about}}** from the **{{ui:app.nav.settingsMenu}}** at the lower left, the name of the app, its version, its license and its copyright appear at the top. Below them are two tabs.

- **{{ui:settings.about.license.title}}**: the full text of novira's license (Apache License 2.0). The install folder holds the same file (`LICENSE`).
- **{{ui:settings.about.oss.title}}**: the open source software the app uses. Each row shows a name and a version. Pressing **{{ui:settings.about.oss.showLicense}}** shows its full license text under the row (press it again to close it). Pressing **{{ui:settings.about.oss.homepage}}** opens its page in your browser. The generation engine and extensions are not bundled with the app, so read their full license on their homepage.

The buttons above the list narrow it to **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** or **{{ui:settings.about.oss.short.packs}}** (the extensions installed right now). The search box finds software by name. The full license texts of the bundled software are also collected in `THIRD_PARTY_NOTICES.txt` in the install folder.

Extensions (ComfyUI custom nodes) and models follow the license of their own distributors when you install them.

## Developer log

This is a log for tracking down the cause when something does not go well. You do not need to use it in everyday use.

When you turn on **{{ui:settings.showDevLog}}** in **{{ui:settings.title}}**, a "{{ui:app.devlog.short}}" button appears in the navigation on the left. Press it and the **{{ui:app.devlog.title}}** panel opens on the right side.

Here, the app's internal records (the backend log), warnings on the screen and errors that were not caught are lined up with their times.

- With the selector at the top, you can narrow to **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** or **{{ui:app.devlog.level.error}}**.
- If you enter words in the filter field, only the lines containing those words are shown.
- With **{{ui:app.devlog.copy}}**, you can copy the lines shown as text. You can paste it when you report a problem.
- You can clear it with **{{ui:app.devlog.clear}}**.

> The log is a record of the time the app has been open. When you close it, the log on the screen is gone. For more detailed ways of investigating, go to [Troubleshooting](10-troubleshooting.md).
