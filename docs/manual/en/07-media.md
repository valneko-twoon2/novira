# Video, Music, Voice, Logos and Text

Besides images, novira can make video, music, voice and logos, and you can also add text and speech bubbles to images.

All of them are used from the left panel of the **{{ui:app.tabs.generate}}** tab. Please read [Making Images](02-generate.md) first for how to use images.

## Switching what you make

At the very top of the left panel there is a row of icons only. From the left, they are **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}**, and **{{ui:app.tabs.comic}}**. Comic pages are made with the last one ([Drawing Comics](12-comic.md)).

Hover the mouse over an icon to see its name. When you switch, the left panel and the display in the middle change to ones for that kind.

## Common features

The screens for video, music, voice and logos have the same layout.

- At the very top of the left panel, there is a **{{ui:presets.label}}** that lets you call up a whole set of settings at once.
- Below it is the button that starts making. If something is missing, the button cannot be pressed and the reason appears right below it.
- When the reason says something like "Download the music model first", install it from the **model card** that appears next.
- Instead of the start button, you can also make with `Ctrl+Enter`.
- While it is being made, its status (waiting in line, being made, the reason if it failed) appears at the very top of the center screen. You can stop it with **{{ui:media.job.cancel}}**.

> Only one thing is made at a time. While video or music is being made, other generation, such as images, waits in line. You can also check the waiting items on the **{{ui:app.tabs.queue}}** tab.

### Downloading the models you need first

Video, music, voice and logos each need their own models. If they are not installed, a "model card" appears in the left panel. Press **{{ui:pack.install}}** and the app brings them in automatically.

| What you make | Card name | Approximate size |
|---|---|---|
| Video | {{ui:pack.title.video}} | About 18 GB |
| Video (fast version) | {{ui:pack.title.turbo}} | Files shared with the standard version are not fetched twice |
| Music | {{ui:pack.title.music}} | About 10 GB |
| Voice | {{ui:pack.title.voice}} | About 9 GB |
| Logo | {{ui:pack.title.logo}} | About 12 GB |

The sizes are approximate. For the exact size, look at the number shown on the card.

For video you can choose between two models, the standard one and the fast one. The card shows the name and memory of this PC's GPU and how well each model fits it (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}** or **{{ui:media.choice.fit.short}}**). The model that suits this PC is marked **{{ui:media.choice.recommended}}**. When the GPU memory cannot be read, the fit is shown as **{{ui:media.choice.fit.unknown}}**. These are rough guides: even a model marked **{{ui:media.choice.fit.short}}** may still run, only more slowly.

The download happens only once, at the start. The progress is shown on the card and, on any screen, in the "{{ui:media.downloads.title}}" box at the bottom left, where you can also press **{{ui:common.cancel}}** partway through. If it fails, the reason appears on the card and the button changes to **{{ui:pack.retry}}**.

When the size of a download is known, the time left is shown as well ("about 2 min left"; it is worked out from the download speed, so it does not appear for the first moments). When the size is not known, or while an extension is being set up, the time since it started is shown instead. For an extension download, **{{ui:media.downloads.manage}}** in the box opens the list of installed extensions.

When installation is done, the card goes away. Only for voice, the engine for reading aloud is installed together, so it takes a little longer.

> Before downloading, the engine that makes images (ComfyUI) must have finished getting ready. If things do not go well, see [Troubleshooting](10-troubleshooting.md).

## Making video

![The video screen. Settings such as the method, prompt and size on the left, and the list of videos made in the center](shot:media-video)

For video, there is a way to make it from text and a way to animate a single image.

### How to make it

1. Choose **{{ui:media.tab.video}}** in the left panel.
2. If it is your first time, press **{{ui:pack.install}}** on the **{{ui:pack.title.video}}** card.
3. With **{{ui:video.mode.label}}**, choose **{{ui:video.mode.text}}** or **{{ui:video.mode.image}}**.
4. In **{{ui:video.prompt}}**, write what kind of video you want. When making from an image, write how you want it to move.
5. Press **{{ui:params.invoke.invoke}}**.

When you choose **{{ui:video.mode.image}}**, a field for specifying the image to animate appears. Drop an image in, or choose an image in the gallery and then press **{{ui:video.pickFromGallery}}**.

There is also a way to right-click an image in the gallery and choose **{{ui:gallery.menu.sendToVideo}}**.

### Settings

| Item | What it is |
|---|---|
| {{ui:video.negative}} | Elements you do not want in it. Words that avoid blur, text and the like are already entered from the start |
| {{ui:video.model}} | **{{ui:video.model.standard}}** makes it carefully. **{{ui:video.model.fast}}** can make it in a short time, but details may come out rough |
| {{ui:video.size}} | The size of the video. At first it is 832×480. You can also choose vertical and square |
| {{ui:video.fps}} | The number of frames per second (8 to 30) |
| {{ui:video.lengthLabel}} | 1 to 10 seconds. The number of frames is decided automatically from the length and the frame rate |
| {{ui:video.steps}}, {{ui:video.cfg}} | Fine adjustments of the result. When you choose a model, they switch to values that suit that model |
| {{ui:params.seed.label}} | In the row near the top, the dice ({{ui:params.seed.random}}) uses a new seed every time, and the lock ({{ui:params.seed.fixed}}) keeps the seed so you can recreate the same motion |

To use **{{ui:video.model.fast}}**, you need to download **{{ui:pack.title.turbo}}** separately. This model has a non-commercial license.

The **{{ui:video.model}}** list also holds the video models you have installed: Wan 2.1 and Wan 2.2 (including VACE), HunyuanVideo and HunyuanVideo 1.5, LTX-Video and LTX-2 models are supported. Picking one sets the steps, CFG, frame rate and size that suit it, and needs no download of the video models. The text encoder and the VAE are found by name among the installed models; when one is missing, generation fails and shows which file is needed (the starter models on the Models screen, **{{ui:models.install.tab.starter}}**, install them together).

- A Wan text-to-video model cannot animate a picture; to animate one, pick a Wan image-to-video model.
- Wan 2.2 14B comes as a pair of files, high noise and low noise. Pick the high-noise file and its low-noise partner is used with it.
- HunyuanVideo (1.0 and 1.5) and LTX-Video work from text and from a picture (HunyuanVideo 1.0 needs its image-to-video model and the vision file `llava_llama3_vision`). LTX-2 also makes sound, which goes into the clip.
- A Wan VACE model takes a picture as a reference for the clip; a Wan 2.1 image-to-video model also needs its CLIP-vision file (`clip_vision_h`), which the starter models install.
- Wan models that need a control video, audio, a camera path or a pose video (Fun Control, S2V, Animate and the like) cannot be run here; generation fails and names what they need.

### When the GPU has little memory

There are two switches under **{{ui:video.light.title}}**.

- **{{ui:video.light.fp8}}**: The memory the model uses is cut to nearly half. Details may become slightly rougher.
- **{{ui:video.light.tiled}}**: Prevents memory from suddenly increasing in the final finishing step. The quality does not change, and it is a little slower.

If that is still not enough, there is also a way to make it at a smaller size and then enlarge the finished video with **{{ui:video.finish}}**.

### Results

A video takes from a few minutes to over ten minutes. When it is done, it is lined up as a list of videos in the center, and you can play it right there. It also goes into the gallery on the right as a thumbnail with a ▶.

Under each video, the prompt, size, length and seed are shown. You can delete it with the trash can button.

When you press **{{ui:video.finish}}**, the **{{ui:finish.title}}** screen opens.

- **{{ui:finish.smooth.title}}**: Fills in between frames to make the motion smoother.
- **{{ui:finish.enlarge.title}}**: Enlarges the video with an upscaling model. It uses a lot of time and memory.

The original video stays as it is, and the finished video is added as a new one. To fill in frames, an extension may be needed (follow the guidance on the screen and press **{{ui:finish.install}}**).

## Making music

![The music screen. Settings such as style, lyrics, length and tempo are lined up on the left](shot:media-music)

It makes a song from text (the style) and lyrics.

### How to make it

1. Choose **{{ui:media.tab.music}}** in the left panel.
2. If it is your first time, press **{{ui:pack.install}}** on the **{{ui:pack.title.music}}** card.
3. In **{{ui:music.tags}}**, write the genre, mood and instruments separated by commas. For example, something like `upbeat J-pop, female vocal, piano, bright`.
4. If you want a song with vocals, write the **{{ui:music.lyrics}}**. If you want no vocals, check **{{ui:music.instrumental}}**.
5. Press **{{ui:params.invoke.invoke}}**.

The style is required. If it is left empty, you cannot make one.

You can write lyrics with section markers in square brackets, such as `[verse]` and `[chorus]`. You can write them in English, Japanese, Chinese and more. Choose the language of the lyrics with **{{ui:music.language}}**. If you are not sure, choose **{{ui:music.lang.unknown}}**.

### Settings

| Item | What it is |
|---|---|
| {{ui:music.lengthLabel}} | 10 to 240 seconds |
| {{ui:music.bpm}} | The speed of the song (40 to 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | From `C major` to `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Fine adjustments of the result |

### Results

A song takes from several tens of seconds to a few minutes, and is lined up in the list in the center. Each one has a player and can be played right there. The length, tempo, key and seed are shown, and when there are lyrics, you can open **{{ui:audio.lyrics}}** to check them.

It also goes into the gallery with a musical note thumbnail.

## Making voice

![The voice screen. The text to read aloud, the language and how to choose a voice are lined up on the left](shot:media-voice)

It reads the text you enter aloud as a voice.

### How to make it

1. Choose **{{ui:media.tab.voice}}** in the left panel.
2. If it is your first time, press **{{ui:pack.install}}** on the **{{ui:pack.title.voice}}** card. The engine and models for reading aloud go only into the app's folder.
3. In **{{ui:voice.text}}**, enter the text you want read aloud.
4. Choose the **{{ui:voice.language}}**. With **{{ui:voice.lang.Auto}}**, it is determined from the text.
5. Decide the voice (see below).
6. Press **{{ui:params.invoke.invoke}}**.

### How to decide the voice

Under **{{ui:voice.mode.label}}**, you can choose from two methods.

- **{{ui:voice.mode.preset}}**: Choose from the prepared voices. There are voices such as a Japanese female, Chinese, an English male and a Korean female, and the language and gender are shown after the name. If you write something like "cheerful and lively" or "slow and calm" in **{{ui:voice.style}}**, you can also specify how it speaks.
- **{{ui:voice.mode.design}}**: In **{{ui:voice.description}}**, write the characteristics of the voice in words. For example, something like "A calm, low male voice. Speaks slowly and gently." The description is required.

The languages it can read aloud are Japanese, English, Chinese, Korean, German, French, Russian, Portuguese, Spanish and Italian.

### Results

The finished voice is lined up in the center list with a player. The voice used (for a voice made from words, "{{ui:audio.voice.designed}}") and the language are also shown. It goes into the gallery too.

The first generation takes a little time to load the model. If you do not use it for a while, the model is removed from the GPU and the memory returns to other work.

## Making logos

![The logo screen. The logo text, style, shape and the number of candidates are lined up on the left](shot:media-logo)

It makes candidates for a logo with text in it.

### How to make it

1. Choose **{{ui:media.tab.logo}}** in the left panel.
2. If it is your first time, press **{{ui:pack.install}}** on the **{{ui:pack.title.logo}}** card.
3. In **{{ui:logo.text}}**, enter the text to put in the logo (up to 60 characters).
4. In **{{ui:logo.style}}**, write the mood, colors and shape. Japanese or English is fine. For example, something like "minimal, blue and white, geometric".
5. With **{{ui:logo.size}}**, choose the shape from **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** and **{{ui:logo.size.tall}}**.
6. Choose the **{{ui:logo.countLabel}}** from 1 to 4 and press **{{ui:params.invoke.invoke}}**.

### Results and layering text

The logos made are lined up in the center as candidates. In the gallery, they go into **{{ui:gallery.view.assets}}** rather than **{{ui:gallery.view.images}}**. When you open the logo screen, the gallery on the right automatically switches to the assets view.

English text comes out accurately, but Japanese can come out distorted. In that case, press **{{ui:logo.layText}}** on a candidate you like. It switches to **{{ui:media.tab.text}}**, and that logo becomes the background, so you can layer any text you like on it.

## Text (words and speech bubbles)

![The text screen. On the left, the buttons for adding text, the background, layers and text styles; in the center, the image being edited](shot:media-text)

**{{ui:media.tab.text}}** is an editing screen where you add text and speech bubbles to an image and save it as an image. You do not need to download a model. It does not use the processing that makes images either, so you can use it right away.

### Deciding the background

With **{{ui:text.bg.title}}**, you choose what the text is placed on.

- **{{ui:text.bg.image}}**: Uses an image as the background. Show an image in the gallery and press **{{ui:text.bg.useViewer}}**, or drop an image onto this screen. It is saved at the same size as the image.
- **{{ui:text.bg.color}}**: A single-color background. For the size, choose from the list, such as 1024×1024 or 1920×1080, or enter the width and height as numbers.
- **{{ui:text.bg.transparent}}**: No background. You can make just the text as a transparent image.

There is also a way to right-click an image in the gallery and choose **{{ui:gallery.menu.sendToText}}**.

### Adding text and speech bubbles

- **{{ui:text.add.text}}**: Adds a text layer.
- **{{ui:text.add.bubble}}**: Adds a speech bubble. Choose the shape from **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** and **{{ui:text.shape.narration}}**.

What you add can be moved by dragging it on the screen. When you select it, round handles appear at the four corners, and you can change its size by dragging them. A speech bubble has a "{{ui:text.bubble.tail}}" (its tail), and you change its direction by dragging the handle at its tip.

`Delete` removes the selected item, `Ctrl+D` duplicates it, the arrow keys move it a little at a time, `Ctrl+Z` undoes, and `Ctrl+Shift+Z` (or `Ctrl+Y`) redoes. The **{{ui:text.undo}}** and **{{ui:text.redo}}** buttons on the screen do the same. You can change the display size with **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** and **{{ui:text.zoom.fit}}**.

### Layers

The text and speech bubbles you add are lined up in **{{ui:text.layers.title}}** in order of stacking. The higher in the list, the closer to the front.

For each one, you can **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, change the order with **{{ui:text.layer.up}}** and **{{ui:text.layer.down}}**, **{{ui:text.layer.duplicate}}** and **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** removes them all at once.

### Adjusting the text

When you select a layer, its settings appear below.

| Item | What it is |
|---|---|
| {{ui:text.content}} | Enter the text (you can break lines) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | Typeface, weight and size. The typefaces come with the app, so it looks the same on any PC |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** or **{{ui:text.fill.gradient}}** (the color changes from top to bottom) |
| {{ui:text.stroke}}, {{ui:text.outline}} | The edge of the text, and an edge outside of that |
| {{ui:text.shadow}} | Shadow. You can choose color, blur and offset |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | The spacing between characters and between lines, and the alignment |
| {{ui:text.vertical}} | Makes it vertical writing. For vertical writing, the alignment changes to "{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}" |
| {{ui:text.bend}} | Curves the text (cannot be used with vertical writing) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | Rotation and opacity |

For speech bubbles, you can also adjust the size, fill color, outline and pointer. With the **{{ui:text.shape.burst}}** shape, **{{ui:text.bubble.shuffle}}** changes the jagged points. If you turn on **{{ui:text.bubble.autoFit}}**, the text shrinks so that it fits inside the bubble.

### Style presets

The preset at the very top of the left panel holds logo-like styles: **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** and **{{ui:text.preset.soft}}**. If you select a text layer and then use one, that style is applied.

You can also save your own styles (font, fill, stroke, shadow, letter spacing).

### Saving

When it is done, press **{{ui:text.save}}**. It goes into the gallery as a PNG image at the size of the background. Even after saving, what you edited on the screen stays, so you can keep fixing it.

## Presets

The screens for video, music, voice, logos and text also have presets of the same form as for images. When you choose from **{{ui:presets.label}}** at the upper left of the screen, the settings you saved go in all at once.

To save your own settings, press the save button next to the preset (**{{ui:presets.saveNew}}**) and give it a name. What you saved is lined up under **{{ui:presets.group.mine}}**. From the "…" menu of each item in the list, you can also **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** and **{{ui:presets.delete}}**. The ones prepared from the start are under **{{ui:presets.group.builtin}}**.

What is saved differs slightly by screen.

| Screen | What is saved | What is not saved |
|---|---|---|
| Video | The prompt, model, size, length and quality settings | The seed and the source image |
| Music | The style tags and the song settings | The lyrics and the seed |
| Voice | The language and the voice (voice and speaking style, or the voice description) | The text to read aloud |
| Logo | The style words, the shape and the number of candidates | The text to put in the logo |
| Text | The style of the text | The contents of the text |

The presets that come with the app are three for video, "Quick preview", "Standard 832x480" and "Vertical, low VRAM"; two for music, "Lo-fi instrumental" and "J-pop song"; two for voice, "Calm narrator" and "Energetic announcer"; and five for logos.

For how to find and install models, go to [Models](08-models.md).
