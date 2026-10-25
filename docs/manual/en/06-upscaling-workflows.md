# Upscaling and Workflows

This chapter explains **{{ui:app.tabs.upscaling}}**, which enlarges pictures, and the **{{ui:app.tabs.workflows}}** tab, where you connect processing steps yourself to build your own.

## Upscaling

![The Upscaling screen. A drop target for a picture and cards showing the steps are lined up in the center](shot:upscaling)

Open **{{ui:app.tabs.upscaling}}** with the frame icon in the side bar on the left (the key 3 also opens it). It enlarges a picture while adding fine detail. It does not simply stretch it. First it enlarges the picture with an upscaling model, and then it uses the prompt and a tile ControlNet to redraw the fine parts.

### What you use

The upscale uses the following two models. If they are not installed, a notice appears in the left panel. From the "{{ui:params.upscale.openModels}}" button, you can go to the models screen. For how to install them, see the [Models](08-models.md) chapter.

- {{ui:params.upscale.model}} (a model for enlarging pictures, such as Real-ESRGAN)
- A {{ui:params.upscale.tileControlnet}} that fits the selected main model (one is chosen for you when it is installed. Families with none, such as Anima and Qwen-Image, redraw without a tile ControlNet; **{{ui:params.upscale.structure}}** then has no effect, so lower **{{ui:params.upscale.creativity}}** to keep the shapes)

When no upscaling model is installed, the left panel lists the candidates; pick one of those marked **{{ui:media.choice.recommended}}** and install it with **{{ui:models.install.install}}**.

### Steps

1. Drag the picture you want to enlarge from the gallery onto the card in the center or onto the **{{ui:params.upscale.title}}** frame in the left panel. You can also right-click a picture in the gallery (use the toolbar in the viewer) and choose **{{ui:gallery.menu.upscale}}**, or open a picture in the viewer and press `Shift+U`; the tab switches and the picture goes in.
2. Choose the **{{ui:params.upscale.model}}**.
3. Choose the **{{ui:params.upscale.scale}}** from 2x, 4x and 8x. The size of the result is shown, like "Output: 2048×2048".
4. Adjust the result with the following two sliders.
   - **{{ui:params.upscale.creativity}}**: The higher it is, the further it departs from the original picture and the more new detail it adds.
   - **{{ui:params.upscale.structure}}**: The higher it is, the more it keeps the shapes and layout of the original picture.
5. Check the **{{ui:params.upscale.tileControlnet}}** (a fitting one is already chosen). If needed, also choose the **{{ui:params.upscale.postProcessing}}** (it finishes the drawn picture, which is then fitted to the output size).
6. Press **{{ui:params.invoke.invoke}}**.

The finished picture goes into the gallery.

- The output size is up to 8192 pixels on a side. If you go over that, a warning appears, so lower the scale.
- The prompt affects the detail that is added. If you put in the original picture's prompt, the direction of the picture is more likely to match.
- If the picture after enlarging differs too much from the original, lower **{{ui:params.upscale.creativity}}** and raise **{{ui:params.upscale.structure}}**.

> To enlarge several pictures at once, choose several in the gallery and use **{{ui:gallery.menu.batch}}** from the right-click menu ([Fixing and Reusing Pictures](04-improve.md)). That enlarges using only the upscaling model.

## Workflows

![The Workflows tab. On the right, the screen where you draw the connections between steps; on the left, the form](shot:workflows)

A workflow is a feature for assembling a procedure of processing, such as "load a model → enter a prompt → make a picture → save it", by connecting parts (nodes). You can build detailed procedures, or flows that combine several kinds of processing, which the everyday Generate tab cannot reach.

To begin with, it is recommended to open a template from **{{ui:workflows.panel.templates}}** (see the section below) and use that.

The screen is made of two parts.

- Center: the **{{ui:app.views.editor}}**. You lay out nodes and connect them with lines.
- Left panel: six tabs, **{{ui:workflows.panel.workflow}}** (the form), **{{ui:workflows.panel.nodes}}**, **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** and **{{ui:workflows.panel.data}}**.

To run a workflow, press the **{{ui:params.invoke.invoke}}** button at the top of the left panel. If there is a problem, such as no output node (for example, "{{ui:workflows.nodes.save_image.title}}") or no model selected, the reason it cannot generate is shown.

Every node you connect takes part in the run. **{{ui:workflows.nodes.controlnet.title}}**, **{{ui:workflows.nodes.ip_adapter.title}}**, **{{ui:workflows.nodes.img_resize.title}}**, **{{ui:workflows.nodes.canny_edge_detection.title}}** and the rest work as you connected them. **{{ui:workflows.nodes.ip_adapter.title}}** needs an extension and a model (an image encoder). What cannot be run yet is **{{ui:workflows.nodes.collect.title}}**, **{{ui:workflows.nodes.iterate.title}}** and **{{ui:workflows.nodes.range.title}}**, the box blur, and a calculation node fed by a **{{ui:workflows.nodes.rand_int.title}}**. The reason is shown in the list of problems above.

### Adding and connecting nodes

The **{{ui:workflows.panel.nodes}}** tab of the left panel lists every node you can add, sorted the way ComfyUI sorts them. Under the headings **{{ui:workflows.nodeLibrary.section.core}}** and **{{ui:workflows.picker.extensions}}** there are folders by kind (model, image, video and so on), in the same order as in ComfyUI, and the app's own built-in nodes sit in the folder of their kind; open one to see the folders and nodes inside. Under **{{ui:workflows.picker.extensions}}**, each extension has a folder of its name with its categories inside. A search lists the matching nodes together with the folder each one is in. Double-click a node (or select it and press `Enter`) to put it in the middle of the canvas, or drag it onto the canvas to put it where you drop it. You can keep adding without a list covering the screen. The other ways are below.

1. Press `Shift+A` or `Space` on the keyboard to open a list to choose a node from.
2. Choose a node from the list. You can narrow it down by typing words into the search field at the top. The list on the left narrows it down by kind of built-in node, by kind of ComfyUI's own node, or by installed extension.
3. Drag from a circle (output) on the right side of a node to a circle (input) on the left side of another node to connect them. You can connect only things of the same kind.

![The list shown when adding a node](shot:workflows-add-node)

There are some handy features for connecting.

- If you drop a line on an empty spot, only the nodes that can be connected there appear in the list. When you choose one, the node is added and connected right away.
- If you drop a line onto a node, it connects automatically to a matching input.
- A chosen node is removed with `Delete`. `Ctrl+C` and `Ctrl+V` duplicate nodes. `Ctrl+Z` undoes and `Ctrl+Shift+Z` redoes.
- If you drag a picture from the gallery onto the editor, a "{{ui:workflows.nodes.image.title}}" node holding that picture is added.
- The arrow to the left of a node's name collapses the node. Double-click the name to rename it.

You type a node's setting values directly in the node. The value of a connected input comes from what it is connected to.

### Making music and video in a workflow

The **{{ui:workflows.panel.nodes}}** tab of the left panel and the list on the left of the node list have a **{{ui:workflows.picker.core}}** group. It holds the nodes ComfyUI has from the start, sorted by kind (audio, video, sampling and so on), and the nodes that make music and video are among them. You can combine them freely with the built-in nodes.

- Open the templates **{{ui:workflows.templates.musicAceStep.title}}**, **{{ui:workflows.templates.videoWan22.title}}** or **{{ui:workflows.templates.videoWan22Image.title}}** and they run right away. They use the models you downloaded on the Music tab and the Video tab.
- Choose the format on the node that saves the result (Save Audio or Save Video). The settings that format needs, such as the quality of an MP3, appear under it.
- The music or video you make goes into the gallery. The gallery handles MP3, WAV and FLAC for music and MP4 for video. If you choose Opus, WebM or another format, a message says the format cannot be kept, and the run stops.
- You can pick music or video from the gallery with the Load Audio or Load Video node and connect it.
- The **{{ui:workflows.nodes.voice_speak.title}}** node (group **{{ui:workflows.categories.audio}}**) makes a sound of a text read aloud. It uses the engine of the Voice tab (Qwen3-TTS), which has to be installed first. Connect the sound to a node that takes sound: Save Audio keeps it as an MP3 or other format, and the audio of Create Video puts the voice on a video (a sound longer than the video is cut at the video's end). The templates **{{ui:workflows.templates.voiceRead.title}}** and **{{ui:workflows.templates.videoNarration.title}}** work as they are.
- A seed that has no "{{ui:workflows.nodes.rand_int.title}}" connected gives the same result every time. The templates have one connected from the start.
- The names, fields and folders of ComfyUI's own nodes use the same words as ComfyUI's own screens in your language. Words ComfyUI has no translation for (such as the nodes of extensions) stay in English. How many nodes there are depends on the version of ComfyUI.

### The row of buttons

These are the buttons at the upper left of the editor.

| Button | What it does |
|---|---|
| **{{ui:workflows.toolbar.new}}** | Starts an empty workflow. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Saves. The first time you save, you are asked for a name. |
| **{{ui:workflows.toolbar.optimize}}** | Merges duplicate nodes, removes nodes that do not lead to an output and connections that are not needed, and rearranges everything from left to right. You can also undo it. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

With the gear at the upper right, **{{ui:workflows.settings.title}}**, you can switch things such as showing the minimap and snapping to the grid.

**{{ui:workflows.settings.autoTidy}}** is off from the start. When you turn it on and then add or remove nodes or lines, after a moment it automatically rearranges the nodes from left to right and merges duplicate nodes that do the same job. When it merges any, a notification appears, and `Ctrl+Z` brings them back. Nodes that are not connected are not removed automatically. If you want to arrange things yourself, leave it off.

When there are unsaved changes, a dot appears next to the name. When you switch to another workflow, you are asked whether to discard them.

### Using it with the form

When there are many nodes, the editor gets hard to follow. So you can make a "form" that gathers only the items you often change while using it.

1. In the editor, right-click an item (field) and choose **{{ui:workflows.node.addToForm}}**.
2. The item is lined up on the **{{ui:workflows.panel.workflow}}** tab of the left panel.
3. Press **{{ui:workflows.form.editForm}}** to reorder or remove items.

It is handy when you run something many times, changing only the prompt or the size. Items that are connected show "{{ui:workflows.form.connected}}".

On the **{{ui:workflows.panel.details}}** tab you can write the name, author, tags, description and so on. On the **{{ui:workflows.panel.data}}** tab you can look at the contents of the workflow (JSON) and copy them.

### The workflow library

![The workflow library](shot:workflows-library)

Press the **{{ui:workflows.library.button}}** card at the top of the left panel, above the Generate button (it shows the name of the open workflow), to open the list.

- **{{ui:workflows.library.recent}}**: Ones you opened recently.
- **{{ui:workflows.library.yours}}**: Ones you saved yourself.
- **{{ui:workflows.library.defaults}}**: Samples that come with the app. For a sample, copy it for yourself with **{{ui:workflows.library.copyToMine}}** before you change it.

You can search, filter by tag and change the sort order. Open one with **{{ui:workflows.library.open}}**, and delete one with the trash can button. **{{ui:workflows.library.new}}** and **{{ui:workflows.library.upload}}** are here too.

### Exporting and importing

- With **{{ui:workflows.toolbar.download}}**, you can export a workflow as a JSON file.
- With **{{ui:workflows.toolbar.loadFromFile}}** (or **{{ui:workflows.library.upload}}**), you can load a file you exported or a file someone else made.
- When a loaded file uses nodes from an extension that is not installed yet, an "{{ui:workflows.import.title}}" dialog appears. After you install them and restart ComfyUI, that workflow opens automatically.
- You can also pull a workflow out of a picture that was made with one. Right-click a picture in the gallery and choose **{{ui:gallery.menu.loadWorkflow}}** (when the picture is open in the viewer, the `W` key works too). Even for a picture made by ordinary generation, the same flow can be built from its settings. Choose **{{ui:gallery.menu.sendToWorkflow}}** when you want to use that picture as the input image of a workflow.

> A workflow someone else made is a chain of programs that run on your computer. Do not load a file whose source you do not know.

## Templates

The **{{ui:workflows.panel.templates}}** tab lines up templates for commonly used combinations.

- Press **{{ui:workflows.templates.open}}** to open it as a new workflow.
- Press **{{ui:workflows.templates.add}}** to add it to the right of the current editor.
- You choose the models and pictures after opening it.

For a template that needs extensions, a "Needs" field appears. Press **{{ui:workflows.templates.installPacks}}** to install them. Then restart ComfyUI with the **{{ui:workflows.templates.restartFirst}}** button, and the template can be opened. A template built from ComfyUI's own nodes can be opened once ComfyUI is running.

The templates provided are as follows.

| Template | What it does | Extensions needed |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | The basic form that makes one picture from a model and a prompt and saves it. | None |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Enlarges a picture made at 1024 to 2048 and saves it. | None |
| **{{ui:workflows.templates.loraStack.title}}** | Connects LoRAs to the model one after another to add art style and detail. | None |
| **{{ui:workflows.templates.image2image.title}}** | Redraws a picture you have with a different prompt. | None |
| **{{ui:workflows.templates.upscale.title}}** | Enlarges a picture in high definition with an upscaling model. | None |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extracts the outlines of a picture and draws something new while keeping that shape. | None |
| **{{ui:workflows.templates.imageToVideo.title}}** | Adds motion to a single picture to make a short video. | None (a video model is needed) |
| **{{ui:workflows.templates.videoWan22.title}}** | Makes a short video from text with ComfyUI's own nodes. Length, size and sampler are yours to change. | None (a video model is needed) |
| **{{ui:workflows.templates.videoWan22Image.title}}** | The same build, making the video from a picture you choose. | None (a video model is needed) |
| **{{ui:workflows.templates.musicAceStep.title}}** | Makes a song from style tags and lyrics. | None (a music model is needed) |
| **{{ui:workflows.templates.voiceRead.title}}** | Reads a text aloud and saves the sound as an MP3. | None (the voice engine and models are needed) |
| **{{ui:workflows.templates.videoNarration.title}}** | Takes a video from the gallery, puts a text read aloud on it as its sound, and saves it as a new video. | None (the voice engine and models are needed) |
| **{{ui:workflows.templates.filmGrain.title}}** | Adds photographic grain to a picture you made. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Changes the expression, gaze and head direction in a face photo. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Enlarges to 2048, then redraws tile by tile to add detail. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Applies the art style of a reference image to the picture made from the prompt. | ComfyUI_IPAdapter_plus (and its model) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Finds the faces in a picture you made and redraws them at a high resolution. | Impact Pack and Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Keeps only the person or object and makes the background transparent. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Keeps only the person or object and makes the background pure white. It is useful for preparing a reference image, so that its background color does not carry over into the picture. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extracts the pose of the person in a picture you used as a reference and draws a new picture in the same posture. | comfyui_controlnet_aux (and a ControlNet model for OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Turns the contents of a picture you used as a reference into text, uses it as the prompt, and draws something new. | The Florence-2 extension |
| **{{ui:workflows.templates.characterReference.title}}** | Puts a character's picture on a white background to use as a reference image, matches hair, eyes and clothes, and draws a new scene. CFG is set to a lower value that suits reference images. | ComfyUI-RMBG and ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Draws with the character's looks taken from a reference image and the posture taken from a stick figure (OpenPose). | The two above, plus comfyui_controlnet_aux and a ControlNet model for OpenPose |

The templates that use characters are for when you want to fine-tune the feature in [Registering and using a character](04-improve.md#registering-and-using-a-character) with a workflow. Usually, using a character registered on the Generate tab is enough. You can make a stick-figure posture with "{{ui:pose.title}}" in the [Canvas](05-canvas.md).

## Extensions (custom nodes)

On the **{{ui:workflows.panel.packs}}** tab, you add extensions to ComfyUI or remove them. Extensions are add-on parts that increase the number of nodes. The nodes you install appear under **{{ui:workflows.categories.extension}}** in the list for adding nodes.

At first, large tiles labeled "{{ui:workflows.packs.whatToDo}}" are lined up. When you choose what you want to do (fix faces, remove a background, make it larger and sharper, and so on), the extensions that suit it are lined up with explanations.

1. Press **{{ui:workflows.packs.install}}** for the extension you want to use.
2. When installation finishes, "{{ui:workflows.packs.restartNeeded}}" appears. Press **{{ui:workflows.packs.restart}}**.
3. After the restart, that extension's nodes and templates can be used.

Some extensions carry a warning, such as "needs Git", "installing takes time and space" or "no longer updated". Please read it before installing.

For things that are not in the catalog, you can install them with **{{ui:workflows.packs.byAddress}}** by entering a GitHub address (in the form https://github.com/username/name). Other extensions that are installed appear under **{{ui:workflows.packs.others}}**. You can remove an extension you do not need with **{{ui:workflows.packs.remove}}** (press it a second time to confirm).

You can see the extensions at any time, not only on the Workflows screen. Press **{{ui:app.nav.extensions}}** (the puzzle-piece icon) in the side bar on the left to open the **{{ui:workflows.packs.mgr.title}}**. The published extensions appear as cards; narrow them with **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** or a purpose in the list on the left, or search by name, author or description in the box at the top. At first, **{{ui:workflows.packs.mgr.sort.label}}** is set to **{{ui:workflows.packs.mgr.sort.downloads}}**, so the most downloaded come first. A card shows the author, version, update date and download count, and **{{ui:workflows.packs.installed}}** on the ones you have. An extension you do not have can be installed with **{{ui:workflows.packs.install}}** on its card. Press a card to open its details on the right, check the **{{ui:workflows.packs.mgr.license}}** and the source, and use **{{ui:workflows.packs.remove}}** if you want it gone. An extension that is not in the list can be installed by entering its GitHub address under **{{ui:workflows.packs.mgr.addTitle}}** at the top. After adding or removing extensions, press **{{ui:workflows.packs.restart}}** on the same screen to apply the change. The details of each card have an **{{ui:agent.ask.button}}** button, and **{{ui:agent.ask.resultsButton}}** appears when you type a word in the search box. Press it and the agent explains what the extension does and how to use it (see [The Agent and Settings](09-assistant-settings.md)).

The details show the **{{ui:workflows.packs.version.label}}** that is installed now. **{{ui:workflows.packs.version.change}}** appears only when the extension's repository publishes versions; press it to see the versions you can choose, and **{{ui:workflows.packs.version.apply}}** to switch to one. The version you have now is marked **{{ui:workflows.packs.installed}}**. An extension that publishes no versions has no such button. To apply the change, press **{{ui:workflows.packs.restart}}** on the same screen. A version that another extension or ComfyUI is known not to support is marked **{{ui:workflows.packs.version.deprecated}}**, together with the name of what does not support it. An extension you installed yourself cannot have its version changed from here.

You can change the ComfyUI version on the same screen too. Press the **{{ui:workflows.packs.version.comfyTitle}}** card at the top of the list, then **{{ui:workflows.packs.version.change}}** on the right to list the versions you can choose. After you press **{{ui:workflows.packs.version.apply}}**, press **{{ui:workflows.packs.version.confirm}}** once more to start the switch. Every extension you have is installed again, so it takes a few minutes and no pictures can be made until it ends. If the new version does not start, the previous one is put back.

> Extensions are programs that run on your computer. Do not install ones whose source you do not know.

> When you are connected to a ComfyUI that the app does not manage, you cannot install from this screen. Install on that ComfyUI itself.

Features that use extensions, such as "{{ui:cutout.menu}}" and "{{ui:facefix.menu}}" in [Fixing and Reusing Pictures](04-improve.md), guide you through installation in the same way when it becomes necessary.
