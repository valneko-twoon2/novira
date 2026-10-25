# Troubleshooting

This chapter gathers the causes of things going wrong and what to try. Look for the words that appear on your screen.

First, looking at the following two often gives you a clue to the cause.

- The **{{ui:app.tabs.queue}}** tab: A failed item shows its reason (see [below](#generation-fails)).
- {{ui:app.devlog.title}}: A record of the app's internals (see [The Agent and Settings](09-assistant-settings.md)).

## Startup and the engine

To make images and so on, novira uses an "image generation engine" (ComfyUI and the Python that runs it). The app installs the engine by itself and starts it by itself.

### Startup takes a long time

The first time you start it, it takes a while because the engine has to be downloaded and unpacked. **{{ui:engine.firstRunNote}}**

On the first screen, three stages appear: **{{ui:splash.step.downloading}}**, **{{ui:splash.step.extracting}}** and **{{ui:splash.step.starting}}**. During the download, the size, the speed and the time left are also shown. Please wait until it finishes.

When the engine is ready, the screen switches. From the second time on, it is only the short time from starting until the engine answers.

### Messages at the top of the screen

While the engine is being prepared, or when something has gone wrong, a message appears at the top of the screen.

| Message | Meaning |
|---|---|
| {{ui:engine.title.downloading}} | The engine is being downloaded. It is several GB. On a slow connection it takes time |
| {{ui:engine.title.extracting}} | The downloaded files are being unpacked |
| {{ui:engine.title.starting}} | The engine is being started and novira is waiting for it to connect |
| {{ui:engine.title.error}} | Preparation failed. The reason appears below |

### The message "{{ui:engine.title.error}}" appeared

If it appeared on the first screen at startup, pressing **{{ui:splash.open}}** opens the app without the engine. In that case you cannot make images and so on, but you can look at images and organize models.

What to try:

1. Read the text of the reason. Check whether you are connected to the internet and whether there is free disk space.
2. Try again. Even after the engine could not be prepared, the app tries to prepare it again the next time you start generating. If that still does not fix it, close the app and open it again.
3. If the download is done and only unpacking failed, the downloaded files remain, so trying again continues from unpacking.
4. Security software may be inspecting the new files and stop the unpacking. The app automatically retries several times, but if it keeps happening, try excluding the data folder (see below) from scanning, or turn the software off temporarily.
5. If the reason says "see logs/comfyui.log", the engine's log has a detailed reason ([How to read the logs](#how-to-read-the-logs)).

> The engine is ComfyUI for Windows, and by default the one for NVIDIA GPUs is installed. There are also settings for using an AMD GPU or a ComfyUI you installed yourself, but these are for advanced users ([Advanced settings](#advanced-settings)).

### The engine seems to have stopped partway

The time to wait between the engine starting and its answering is 3 minutes by default. After that, you get an error meaning "ComfyUI did not answer in time". If the engine quit partway through starting, "ComfyUI exited while starting" appears. In both cases, the reason is left in the engine's log (`comfyui.log`).

## Cannot generate

### The Generate button cannot be pressed

When you hover the mouse over the Generate button on the **{{ui:app.tabs.generate}}** screen, a list of reasons appears under **{{ui:params.invoke.cannotInvoke}}**. On the video, music, voice and logo screens, the reasons are lined up under the button. When you fix the reasons shown one by one, the button can be pressed.

| Reason shown | How to fix it |
|---|---|
| {{ui:params.readiness.noModel}} | Choose a model. If none is installed, go to "No model is installed" below |
| {{ui:params.readiness.loraMissing}} | The LoRA you had chosen cannot be found. It may have been deleted or moved. Choose the LoRA again, or remove it |
| LoRA "…" is incompatible with the model | The base (SDXL, SD1.X and so on) is different. Use a LoRA with the same base, or remove it |
| Reference image …: no image selected, or no model selected | Put an image and a model in the reference image field |
| Reference images need the extension … | Install the extension from the guidance in the reference image field ([An extension is missing](#an-extension-is-missing)) |
| {{ui:params.readiness.upscaleNoImage}} | Choose an image to upscale |
| {{ui:params.readiness.upscaleNoModel}} | Choose a model for upscaling. If none is installed, you can install one from **{{ui:models.install.tab.starter}}** on the {{ui:app.tabs.models}} tab |
| {{ui:video.problem.prompt}}, {{ui:music.problem.tags}}, {{ui:voice.problem.text}}, {{ui:logo.problem.text}} | A required field is empty. Fill it in |
| {{ui:video.problem.image}} | In "From image (i2i)" mode, no image to animate has been chosen |
| {{ui:voice.problem.description}} | In "Describe a voice" mode, the description of the voice is empty |
| {{ui:video.problem.pack}}, {{ui:music.problem.pack}}, {{ui:voice.problem.pack}}, {{ui:logo.problem.pack}} | The dedicated models are not installed. Go to the next item |

### The models for video, music, voice or logos are not installed

A card appears in the left panel of each screen, so press **{{ui:pack.install}}**. You cannot make anything until the installation is done.

- If the download fails partway, the button on the card changes to **{{ui:pack.retry}}**. Press it to try again.
- For voice, the engine for reading aloud is installed too. The image generation engine must have finished getting ready first.
- The fast video model is a separate download from the standard video model.

For details, please see [Video, Music, Voice, Logos and Text](07-media.md).

### No model is installed

When the **{{ui:app.tabs.models}}** tab shows **{{ui:models.empty.title}}**, there is not a single model.

- From **{{ui:models.install.tab.starter}}** in **{{ui:models.import}}**, you can install your first model.
- You can also search for a model you like on the **{{ui:app.tabs.browse}}** tab and install it.
- If you already have model files, you can bring in a whole folder with **{{ui:models.install.tab.scan}}** in **{{ui:models.import}}**.

For details, please see [Models](08-models.md).

### An extension is missing

Some features say "needs the extension XXX". Fixing faces, selecting a region, removing a background, filling in video frames and using reference images are among them.

1. Press **{{ui:params.refImage.installPack}}** next to the message.
2. When installation is done, press **{{ui:params.refImage.restartEngine}}** to restart the engine.
3. After the restart, try again.

You can also install and remove extensions as a list from **{{ui:workflows.panel.packs}}** on the **{{ui:app.tabs.workflows}}** tab.

> When you are connected to an engine you prepared yourself rather than the one the app installed, the app cannot install extensions. Install them on that engine.

### The GPU is out of memory, or competing with other apps

Images, video and music use your computer's GPU. If other apps (games, video editing, videos in a browser and so on) are using the GPU, memory can run short and cause failures.

When memory is short, the error may include the letters "OOM" (meaning out of memory).

When a job fails for lack of memory, the app recognizes it and shows the notice **{{ui:queue.oom.title}}**. It appears above the gallery, under the failed item in the **{{ui:app.tabs.queue}}** tab, on the video, music, voice and logo screens, and as a notification at the bottom right.

![The notice for running out of GPU memory, with the buttons Retry smaller and Turn on low-memory mode and restart](shot:out-of-memory)

The buttons of the notice let you try one of these:

- **{{ui:queue.oom.retrySmaller}}**: makes it again with the same settings and seed, at about 75% of the area with the same aspect ratio. It appears only for images made at a chosen size (not for video, music, voice, logos or upscaling).
- **{{ui:queue.oom.lowMemory}}**: turns on **{{ui:settings.lowMemory.label}}** (see [The Agent and Settings](09-assistant-settings.md)) and restarts the engine. While an item is being made, it applies the next time the engine starts. It does not appear when the mode is already on.

After a job fails for lack of memory, the app asks the engine to unload its models and free the memory. The next job therefore starts by loading its model again and takes a little longer.

What to try:

- Close other apps that use the GPU, such as games or video editing, and make it again.
- Make the image size smaller.
- Reduce the LoRAs and reference images you use.
- For video, make it at a smaller size and enlarge it afterward with **{{ui:video.finish}}**. You can also try **{{ui:video.light.fp8}}** and **{{ui:video.light.tiled}}** under **{{ui:video.light.title}}**.
- Open the app again to release the memory that is in use.

The voice model is removed from the GPU when you have not used it for a while. Making proceeds one at a time in order.

### Generation fails

When making an image, video, music or the like fails, the item on the **{{ui:app.tabs.queue}}** tab becomes **{{ui:queue.status.failed}}**. Press the item to open it, and the reason appears in **{{ui:queue.detail.error}}**. On the video, music, voice and logo screens, a failure display and its reason also appear near the top of the center (up to the latest 3).

Once you know the reason, you can try again with the same settings using the **{{ui:queue.action.retry}}** button of the item.

The text of the reason comes from inside the engine or the app, so it may be in English. Here are the common ones.

| Text of the reason (the gist) | Meaning and what to try |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | The engine cannot find that model. You moved the model file, or the setting for the folders to search does not match. Install it again from the Models tab, or check the location |
| ComfyUI is not reachable at ... | It cannot connect to the engine you prepared separately. Check that engine is running |
| ComfyUI exited while starting / did not answer in time | The engine cannot start. Look at the engine's log |
| ... OOM | The GPU is out of memory. See the previous item |
| ... models are not supported by the ComfyUI backend yet | FLUX and SD3.X models cannot be used for generating images yet. Choose an SDXL or SD1.X model |
| Reference images need the ... custom node pack | The extension needed for reference images is not installed |
| This ComfyUI is too old for video / music | The engine you are using lacks features needed for video or music. This does not happen with the engine the app installed. If you prepared the engine yourself, update it |
| The video / music / logo models are not installed yet | The dedicated models are not installed. Download them from each screen |
| ComfyUI has no ... node; install the custom node pack | The extension for a node used in the workflow is not installed |
| Interrupted because novira was closed | The app was closed partway through making it. Make it again |

### The picture was made but I cannot see it

If making shows **{{ui:queue.status.completed}}** but nothing appears in the gallery, check the following.

- **A different board**: New images go to the board marked **{{ui:gallery.boards.autoBadge}}** (by default, **{{ui:gallery.boards.uncategorized}}**). If you have a different board open, they do not appear there. Switch boards, or choose again the board that new images go to with **{{ui:gallery.boards.setAutoAdd}}**.
- **Logos go into "Assets"**: Logos go into **{{ui:gallery.view.assets}}**, not **{{ui:gallery.view.images}}**.
- **How video and audio look**: Video lines up as a thumbnail with a ▶, and audio with a ♪. They are hidden if a search or filter is left on.

If you still cannot find it, check the **{{ui:queue.col.destination}}** of the item on the **{{ui:app.tabs.queue}}** tab. An item whose output destination is **{{ui:queue.destination.canvas}}** appears on the canvas, not in the gallery.

## Where data is kept, and backups

### Where the data is

Images, models and records all go into a folder named **`novira-data`**. The location is as follows.

- Distributed version: `novira-data` inside your user folder (`C:\Users\<your name>`). If a `novira-data` already sits in the same folder as the app's executable (`novira.exe`), as it did before, that one keeps being used.
- Version under development: `novira-data` inside the top folder of the repository.

You can change it to another location with the environment variable `NOVIRA_DATA_DIR`.

| Folder or file | What it holds |
|---|---|
| `outputs` | The images, video and audio you made |
| `novira.sqlite` | Records such as image information, boards, the queue, the list of models and workflows |
| `thumbnails` | Reduced images |
| `models` | The models you installed |
| `comfyui` | The image generation engine the app installed |
| `cache` | Temporary data the engine uses |
| `voice` | The library for reading voice aloud |
| `logs` | Logs (see below) |
| `settings.json` | Settings for advanced users (it is fine if it is not there) |
| `secrets` | API keys and tokens (encrypted) |
| `agent.json` | The kind of AI chosen for the agent |

The engine the app installed (ComfyUI and Python) and its working data also go inside the data folder.

The app's screen settings (language, theme, presets, the history of AI chats and so on) are not kept in `novira-data`. They are stored on the screen side of the app instead.

### Backups

novira has a feature that makes a backup and a feature that restores from one. To protect pictures that matter to you, use the **{{ui:share.backup.section}}** section of the settings screen (see [The Agent and Settings](09-assistant-settings.md)). A backup holds the pictures you made and what you set or registered in the app, but not the models or the image generation engine. If you want to keep those too, copy the folder yourself.

1. Close the app (also check that nothing is being made).
2. Copy the whole `novira-data` folder to another drive or the like.

The large ones are `models` and `comfyui`. If you only want to keep the pictures and records, `outputs` and `novira.sqlite` are the main parts. Models in `models` can often be downloaded again from where you got them, but ones whose distribution has ended may not be recoverable.

> API keys and tokens are encrypted with a Windows feature. They may not be readable if copied to another computer or another user, so in that case enter them again in the settings.

The app's screen settings, presets and the history of AI chats are not included in this copy, but they are included in a backup.

## How to read the logs

You can see logs in three places.

| Place | What it holds |
|---|---|
| {{ui:app.devlog.title}} (inside the app) | The app's internal records, and warnings and errors on the screen. You turn on showing it in the settings ([The Agent and Settings](09-assistant-settings.md)) |
| `novira-data\logs\novira.log` | The app's own record. When it gets large (over 2 MB), it moves to `novira.log.1` |
| `novira-data\logs\comfyui.log` | The image generation engine's record. The reason appears here when it cannot start or when generation fails |

In a log, new lines are added at the bottom. When something has happened, look near the very bottom. Lines containing "error" or "failed" are the clues.

## When reporting a problem

If you have the following together, the cause can be found sooner.

1. **What you did and what happened**: The order of your actions, what you expected and what actually happened.
2. **The words on the screen**: Copy the text of the error exactly (the **{{ui:queue.detail.error}}** on the **{{ui:app.tabs.queue}}** tab, or the message that appeared at the top of the screen).
3. **The app's version**: It is shown at the very bottom of the settings screen, or in **{{ui:app.nav.about}}**.
4. **The developer log**: The text copied with **{{ui:app.devlog.copy}}**.
5. **The log files**: `novira.log` and `comfyui.log`, around the time the problem happened.
6. **Information about your computer**: The kind of GPU and its memory, and the Windows version.

> Logs may contain prompts and file locations. Before handing them to someone, check whether there is anything you do not want to show.

## Advanced settings

If you put a `settings.json` in the data folder, you can change how things such as the engine behave. Usually you do not need it.

| Setting name | What it is |
|---|---|
| `comfyuiPackage` | The kind of engine to install. `nvidia` (default) or `amd` |
| `comfyuiUrl` | Connect to a ComfyUI that is already running (the app does not install or start an engine) |
| `comfyuiDir` | Use the folder of a ComfyUI you installed yourself |
| `modelRoots` | Add folders to search for models |
| `comfyuiStartTimeoutSecs` | The number of seconds to wait for the engine to start (default 180) |
| `lowMemoryMode` | Low-memory mode (`true` or `false`). Switching **{{ui:settings.lowMemory.label}}** in the settings writes it here |

If the file is written incorrectly, the app does not start and shows the reason. After making a change, open the app again.
