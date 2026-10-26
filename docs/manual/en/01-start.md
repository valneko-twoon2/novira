# Getting Started

## What novira can do

novira is a Windows desktop app that makes images, video, music and voice.
You write a prompt (a description of what you want to make) and press the **{{ui:params.invoke.invoke}}** button. The picture is drawn on your own computer and appears in the gallery on the right.
The layout and controls are based on the image-generation tool InvokeAI. If you have used it before, you will feel right at home.

In broad terms, you can do the following:

- Make images from text (this is the focus of this guide)
- Rework an existing image, repaint just one part of it, or enlarge it
- Make video, music, voice, logos and images with text in them
- Ask the agent for help with settings and prompts

> Drawing happens on your own computer. Features that use the internet, such as searching for and downloading models or the agent, only connect when you choose to use them.

## How images are made

novira is made of four parts.

| Part | Role |
|---|---|
| novira (this app) | The screens, the gallery, the waiting line (queue) and model management |
| Image generation engine (ComfyUI) | The part that actually draws. novira installs it and starts it by itself |
| Models | The training data used to draw. Each one is a file of several GB, and you get them separately from the engine |
| Data folder | The place where your images, models, the engine itself and so on are kept |

You do not need to install the engine yourself. novira installs it automatically the first time it starts.
The engine and its components (such as Python) go only into novira's data folder. Nothing is changed elsewhere on your computer, and any Python you already have is left alone.

The first time you start the app, a screen asks where the data folder and the engine (ComfyUI) are installed. Press "{{ui:firstrun.start}}" to keep the standard places, or press "{{ui:firstrun.choose}}" on a row to pick another folder. Both can be changed later under Engine in the settings. Use the data folder when you want to move or back up your images and models.

> Image generation uses the GPU (graphics card). By default, novira installs the engine for NVIDIA GPUs.

A model decides "what kind of art style to draw in". You need one to begin with. How to add one is explained in [Getting Models Ready](08-models.md).

## When you first start it

When you open the app, the splash screen appears first, showing the logo.
Below it, a card shows what the app is doing right now.

The first time you start it, installation of the image generation engine begins. The card shows three stages in order.

1. **{{ui:splash.step.downloading}}**: ComfyUI and Python are downloaded. The size, the speed and an estimate of the time left are also shown.
2. **{{ui:splash.step.extracting}}**: The downloaded files are unpacked.
3. **{{ui:splash.step.starting}}**: The engine is started and novira waits for it to connect.

> {{ui:engine.firstRunNote}}

Installation happens only once. From the second time on, the splash screen finishes in a few seconds and the engine starts right away.

While the download is running, the **{{ui:splash.open}}** button under the card opens the app before the download finishes. The download goes on in the background, and the banner at the top shows its progress. Pictures cannot be made until the engine is ready.

When the engine is ready, the splash screen goes away and the main screen opens.
While data is being loaded you will see "{{ui:splash.wait.heading.loading}}", and while the engine and the information needed for editing are being loaded you will see "{{ui:splash.wait.heading.preparing}}".

### Messages at the top of the screen

If the engine restarts or is reinstalled after the app has opened, a banner appears at the top center of the screen to tell you what is going on.

- "{{ui:engine.title.downloading}}", "{{ui:engine.title.extracting}}" and "{{ui:engine.title.starting}}": Work is in progress. Generation will not start until it finishes. When it finishes, the banner goes away by itself.
- "{{ui:engine.title.error}}": The engine could not be prepared. The reason is shown on the line below the banner.

If an error appears on the splash screen, an **{{ui:splash.open}}** button appears under the reason. Pressing it opens the app without the engine. You can check your models and change settings, but you cannot make pictures.
If the error keeps happening, see [Troubleshooting](10-troubleshooting.md).

## Getting to know the screen

![The whole Generate tab: the parameters panel on the left, the start screen in the center, and the board and gallery on the right](shot:generate)

From left to right, the screen is laid out as follows.

- The thin vertical strip at the far left: the **side navigation**. It switches between tabs.
- The left panel: the **parameters panel**. It holds the settings for making a picture, such as the prompt and the model.
- The center: the **main view**. It is the work area that changes with the tab, such as the start screen, the image viewer and the canvas.
- The right panel: the **gallery**. It shows boards (something like folders) and thumbnails of the images you have made.

### Side navigation (tabs)

| Tab | What it is for | Number key |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Make images. The icons at the top also let you switch to video, music, voice, logos and text. The last icon in that row, **{{ui:app.tabs.comic}}**, switches to making comic pages (the key `1` opens whichever of the two you used last) | `1` |
| **{{ui:app.tabs.canvas}}** | Place images, draw more onto them, or repaint just one part | `2` |
| **{{ui:app.tabs.upscaling}}** | Enlarge an image while adding fine detail | `3` |
| **{{ui:app.tabs.workflows}}** | Connect parts (nodes) to build your own generation procedure | `4` |
| **{{ui:app.tabs.models}}** | List, install and delete the models you have | `5` |
| **{{ui:app.tabs.browse}}** | Search for models on the internet and bring them in | `6` |
| **{{ui:app.tabs.queue}}** | See and stop the waiting line for generation. A badge shows how many are waiting | `7` |
| **{{ui:app.nav.extensions}}** | Find ComfyUI extensions, then install or remove them | `8` |

Near the bottom of the side navigation there are also the following.

- **{{ui:app.tabs.short.agent}}**: Opens the agent window on top of the current screen.
- **{{ui:app.nav.settings}}**: From its menu you open {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} and {{ui:app.nav.about}}.
- The "n" logo at the very top: Opens {{ui:app.nav.about}}.

How to use each of them is explained in the following chapters.

- {{ui:app.tabs.generate}}, {{ui:app.tabs.queue}}: [Making Images](02-generate.md)
- The gallery and the viewer: [The Gallery and the Viewer](03-gallery.md)
- {{ui:app.tabs.canvas}}: [Drawing More on the Canvas](05-canvas.md)
- {{ui:app.tabs.comic}}: [Drawing Comics](12-comic.md)
- {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}}: [Upscaling and Workflows](06-upscaling-workflows.md)
- Video, music, voice and so on: [Video, Music, Voice, Logos and Text](07-media.md)
- {{ui:app.tabs.models}}, {{ui:app.tabs.browse}}: [Getting Models Ready](08-models.md)
- {{ui:app.tabs.short.agent}}, {{ui:app.nav.settings}}: [The Agent and Settings](09-assistant-settings.md)

### The tabs in the center (Start, Viewer, Drafts)

At the top of the center of the {{ui:app.tabs.generate}} tab there are three small tabs.

- **{{ui:app.views.launchpad}}**: A guide to getting started. It shows cards such as "{{ui:params.launchpad.generate.textTitle}}" and "{{ui:params.launchpad.generate.refTitle}}", along with shortcut hints.
- **{{ui:app.views.viewer}}**: The place to look at an image large. When you pick an image in the gallery, it is shown here.
- **{{ui:app.views.drafts}}**: A screen that lines up many half-drawn candidates made with the same settings but different seeds, so you can finish drawing only the ones you like.

Other tabs have small tabs of their own too (for example, the {{ui:app.tabs.canvas}} tab has {{ui:app.views.canvas}}).

### Hiding the panels

When you want to see an image larger, you can hide the left and right panels.

- The small arrow buttons at the top edge of the center open and close the left panel and the gallery (the right panel).
- On the keyboard, `T` toggles the left panel, `G` the gallery, and `F` both at once.
- Drag the boundary between panels to change their width. The widths are remembered only while the app is open; when you start it again, they return to the original widths.

> Single-letter shortcuts such as `T`, `G` and `F` do not work while you are typing in a field. Leave the field first, then press the key.

## Making your first image (3 steps)

This is the flow for making a picture for the first time. It assumes you already have a model installed.

1. **Choose a model.** Pick the model you want to use from the model field near the top of the left panel. If the field says "{{ui:params.model.noModels}}", first finish [Getting Models Ready](08-models.md).
2. **Write a prompt.** In the "{{ui:params.prompt.positive}}" field, describe the picture you want in words. For example, join words or short phrases with commas, like `a lighthouse on a cliff at dusk, calm sea, warm light`. With many models, English prompts give results closer to what you expect.
3. **Press {{ui:params.invoke.invoke}}.** Click the button or press `Ctrl+Enter`. A "{{ui:gallery.generating.title}}" display appears above the gallery on the right, and you can see the picture in progress and how far along it is. When it is done, the picture appears in the viewer in the center and is lined up in the gallery too.

If the button is gray and cannot be pressed, the reason is shown on the line below it (for example, "{{ui:params.readiness.noModel}}"). Fix the reason and the button can be pressed.

The finished picture is saved to the gallery automatically. If you do not like it, just change the prompt or the settings a little and press the button again.
For details, go on to [Making Images](02-generate.md).
