# Making Images

This chapter explains how to make pictures on the **{{ui:app.tabs.generate}}** tab.
For how to read the screen, see [Getting Started](01-start.md). For how to view and organize the pictures you make, see [The Gallery and the Viewer](03-gallery.md).

The flow is always the same.

1. Choose a model
2. Write a prompt
3. If needed, adjust settings such as the size and the seed
4. Press **{{ui:params.invoke.invoke}}**

The picture does not start being drawn the moment you press the button. First it goes into the "{{ui:app.tabs.queue}}" (the waiting line). When its turn comes, pictures are drawn one at a time.

The model, the prompts and the settings you choose stay when you close the app, and are there as they were the next time you start it.

## Writing a prompt

![The Generate tab with a sentence written in the prompt and the seed fixed](shot:generate-prompt)

The "{{ui:params.prompt.title}}" in the left panel has two fields.

- **{{ui:params.prompt.positive}}**: Write what you want drawn.
- **{{ui:params.prompt.negative}}**: Write what you do not want to appear. For example, `blurry, watermark`. You can also generate with the field left empty.

Here are some rules of thumb for writing.

- Line up words or short phrases, separated by commas (`,`).
- With many models, English makes it easier to get the result you want. If the model's description says how to write for it, follow that.
- Put the important words toward the front.

The small buttons above the fields do the following.

| Button | What it does |
|---|---|
| **{{ui:params.prompt.recommended}}** | Adds the quality words widely used with the selected model's family to "{{ui:params.prompt.positive}}", and the words to avoid to the end of "{{ui:params.prompt.negative}}". Models written in tags (Illustrious, NoobAI, Pony, Anima and so on) get tags such as `masterpiece, best quality` at the start; models written in sentences (FLUX, Qwen-Image and so on) get quality words at the end. Models that do not use a negative prompt (FLUX.1) get no negative words. Words that are already there are not added twice |
| **{{ui:params.prompt.expand}}** | Edits positive and negative side by side in a large window |
| **{{ui:params.prompt.tagView}}** | Switches the field to a row of tags, one per word. Press a tag to open a strength popover: change the strength with the slider, reset it to 1, or remove the tag. A tag whose strength changed is written into the prompt as `(smile:1.3)`. Type a word in the box below and press Enter to add a tag. Press the button again to return to the text |
| **{{ui:params.promptBook.open}}** | Opens the presets, words gathered together with their meanings (described below) |
| **{{ui:caption.fromPrompt}}** | Looks at a picture and writes out words you can use as a prompt. You can also drop a gallery picture or an image file from your computer on this button (explained in [Fixing and Reusing Pictures](04-improve.md)) |

### Token count

The "0 / 77 tokens" above the field is a rough measure of how much you have written.
A token is a unit the model uses when it reads words. If you go over the limit, the number turns a warning color. With some models, the part past the limit may have less effect.
The number is approximate. It is not an exact count.

### Making combinations all at once with `{red|blue}`

If you write curly brackets with choices separated by vertical bars (`|`) in the positive field, such as `{red|blue}`, a separate picture is made for each choice.

- Writing `a {red|blue} flower` gives two versions: `a red flower` and `a blue flower`.
- If you write two or more sets of curly brackets, you get every combination. `a {red|blue} {cat|dog}` gives four.
- You can also put curly brackets inside curly brackets.
- To use a curly bracket as an ordinary character, put `\` in front of it (`\{`).
- The number of combinations is capped at 100.

When "{{ui:params.invoke.iterations}}" (described below) is 2 or more, the number of pictures made is the number of combinations times Iterations. For example, 2 combinations with Iterations set to 3 gives 6 pictures.
This syntax works only in the positive field. In the negative field, curly brackets are treated as plain characters.

You can check what text it expands to with the **{{ui:params.prompt.dynamicPreview}}** button (the `{ }` icon) above the positive field. Pressing it shows a list of the combinations.

### Wildcards `__name__`

![The wildcards window: the lists on the left, the chosen list's name and entries on the right](shot:wildcards)

Write `__name__` (two underscores before and after the name) in the positive field, and entries from the "{{ui:params.wildcards.title}}" list of that name go there one at a time. Keep choices you use often in a list and you no longer have to write `{red|blue}` every time.

- `1girl, __hair-color__` makes one prompt for each entry of the list hair-color.
- Entries may use `{a|b}` and other wildcards. Wildcards inside wildcards go at most 6 levels deep.
- The limit on the number of combinations (100) is the same as for `{ }`.
- A name with no list, a list with no entries, or a list that uses itself keeps **{{ui:params.invoke.invoke}}** from being pressed, and the reason shows under the button.

Open the lists with **{{ui:params.wildcards.open}}** at the bottom of the window of the **{{ui:params.prompt.dynamicPreview}}** button. Three lists come with the app: hair-color, expression and time-of-day.

| Control | What it does |
|---|---|
| **{{ui:params.wildcards.new}}** | Adds an empty list |
| The "{{ui:params.wildcards.name}}" field | Renames the list. Use letters, digits, `-` and `_`, starting and ending with a letter or digit |
| The "{{ui:params.wildcards.entries}}" field | One entry per line. Empty lines and lines starting with `#` are not entries |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Reads or writes one list as a .txt file with one entry per line. An imported file becomes a new list named after the file |
| **{{ui:common.delete}}** | Deletes the chosen list |

The lists are kept inside the app (on the computer you are using).

### Picking at random

When there are too many combinations, switch "{{ui:params.prompt.dynamicMode}}" in the window of the **{{ui:params.prompt.dynamicPreview}}** button.

- **{{ui:params.prompt.modeCombinatorial}}** (the default): makes the number of images set in Iterations for each combination.
- **{{ui:params.prompt.modeRandom}}**: makes the number of images set in Iterations, picking one combination for each image. The pick follows the image's seed, so drawing again with the same seed gives the same prompt.

Either way, each finished image keeps the prompt that was actually used.

## Seed

A picture is made from a number called the "{{ui:params.seed.label}}". The same seed with the same settings gives the same picture.

In the "{{ui:params.seed.label}}" row near the top of the left panel there are two buttons.

- **{{ui:params.seed.random}}** (the dice): A new seed is used every time you generate. You get a different picture each time. This is the default.
- **{{ui:params.seed.fixed}}** (the lock): It draws with the current seed. However many times you make it with the same settings, you get the same picture. This is handy when you want to see the difference made by changing a single word in the prompt.

When it is fixed, the seed number field and the "{{ui:params.seed.shuffle}}" button are locked (this prevents you from changing it by accident).
If you want to use a specific number, type it into the number field while "{{ui:params.seed.random}}" is selected, and then switch to "{{ui:params.seed.fixed}}".
If you want to use the seed of a picture you like, open that picture in the gallery and press "{{ui:gallery.menu.useSeed}}". It loads the seed and fixes it (see [The Gallery and the Viewer](03-gallery.md)).

If you raise Iterations while the seed is fixed, the second and later pictures use seeds that go up by one each time.

## Choosing a model

![The model list open, divided by family such as FLUX, SDXL and SD1.X](shot:model-picker)

With the model card near the top of the left panel, you choose the model that draws the picture.

1. Click the model name field.
2. Choose from the list. The list is divided by model family (FLUX, SDXL, SD1.X and so on). When there are many, type part of a name into the search field at the top to narrow it down.

Models of Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow and HunyuanImage can be chosen here too. When the model, the text encoder and the VAE are handed out as separate files, the app finds the text encoder and the VAE by name among the installed models. When you install a model that lacks one of them, the app at once asks "{{ui:params.parts.title}}" and shows the names and sizes, so you can install just the missing files. If you close it with "Not now", the Generate panel keeps a note of what the model lacks and a button that installs those files without leaving the screen; a download above 5 GB asks again after you press it. The starter models on the Models screen (**{{ui:models.install.tab.starter}}**) install them too. Masks, control layers and the high-resolution fix work with these models too. Reference images work with SD1.X and SDXL models only. The scheduler cannot be chosen: each family draws with its own sampler and scheduler (`euler / simple` for Anima), and the "{{ui:params.generation.scheduler}}" field shows the pair that will run.

- **Edit models.** FLUX Kontext and Qwen-Image-Edit change a picture you give them: put the picture in the source (image to image) and write what to change in the prompt. FLUX Fill redraws the masked part (use inpaint or outpaint with a mask). These models do not take the high-resolution fix, drafts or control layers. The app tells them from plain models by what is inside the file or, for Kontext and the Qwen edit models, by the word `kontext` or `edit` in the file name; do not rename them.
- **FLUX.2.** The klein models run in a few steps (use CFG 1 for the distilled ones); dev uses the CFG value as its guidance. Put a picture in the source (image to image) and FLUX.2 edits it by the prompt. Masks, control layers and the high-resolution fix are not available with FLUX.2 (drafts are).
- **Quantised (GGUF) models.** A model or text encoder file that ends in `.gguf` is read by the ComfyUI-GGUF extension. Install it once from the Extensions screen (https://github.com/city96/ComfyUI-GGUF) and restart the engine; until then, generation fails and says so.
- **Models made for other inputs.** Models that need a control video, audio, a camera path or a pose video (for example Wan Fun Control, Wan Animate, Flux Canny) cannot be run here yet. Generation fails and names what the model needs.
3. The model you chose gets a ✓, and the card's picture (the cover image) changes too.

Under the list, the **{{ui:app.tabs.short.models}}** button takes you to the {{ui:app.tabs.models}} tab (managing the models you have), and the **{{ui:app.tabs.short.browse}}** button takes you to the {{ui:app.tabs.browse}} tab (searching the internet). How to add more models is explained in [Getting Models Ready](08-models.md).

If recommended settings (steps, CFG, scheduler, size) are registered for the model, they are filled in automatically when you choose it.
When you switch to a model of a different family, LoRAs and the like that do not fit the new model are removed (you are told how many were removed).

Press the **{{ui:params.profile.title}}** button below the model field to see the recommended values for that model in a list. If your current settings differ from the recommended ones, the button takes on a more noticeable color, and **{{ui:params.profile.apply}}** sets everything to the recommended values. Steps are checked against a range from a little below to a little above the recommended number. Anima models break up easily with too few steps (the picture can come out as one flat color), so their lower bound is higher (24 or more when 30 is recommended).

> When no model is installed, the field says "{{ui:params.model.noModels}}" and you cannot generate. First finish [Getting Models Ready](08-models.md).

## Other settings

Under the prompt there are sections that group the settings. You can open and close them by clicking.

| Section | What it contains |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (right under the prompt) | Images used to steer the mood or the characters of a picture (described below) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, width and height. There are also the "{{ui:params.image.swap}}", "{{ui:params.image.lock}}" and "{{ui:params.image.optimal}}" buttons |
| **{{ui:params.generation.title}}** | LoRA (a small add-on model that adds an art style or a character), {{ui:params.generation.scheduler}}, {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | A second pass that enlarges the drawn picture and draws it again (see below) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (pictures that show no seam when tiled together; SD1.X and SDXL models, and the ComfyUI-seamless-tiling extension installed from the Extensions screen) and so on |

If you are unsure, everything except the size can stay as it was filled in when you chose the model.
Hover over an item name ("{{ui:params.generation.steps}}", "{{ui:params.generation.cfg}}" and so on) to see a short explanation. The heading of each section shows a small summary of its current values.

The larger the size, the longer it takes and the heavier the load on your computer. It is recommended to try a smaller size first and, if it looks good, enlarge it with [Upscaling](06-upscaling-workflows.md).

## High-resolution fix

![The high-resolution fix section opened and turned on](shot:hires-fix)

Drawing at a large size from the start often gives two people instead of one, or broken shapes. **{{ui:params.hires.title}}** first draws at the size you set, enlarges the picture, and then draws it again with the same seed and settings. One generation gives a large picture with detail throughout. This section is on the {{ui:app.tabs.generate}} tab and the {{ui:app.tabs.comic}} tab.

- **{{ui:params.hires.enable}}**: turn it on to use it.
- **{{ui:params.hires.scale}}**: 1.25 to 2 times. The final size shows in the section heading and on the bottom line.
- **{{ui:params.hires.strength}}**: 0.2 to 0.75. Low keeps the first picture almost as it is; high redraws more. The default is 0.45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** enlarges without a model. If upscale models (the ones the {{ui:app.tabs.upscaling}} tab uses) are installed, you can pick one of them too.
- **{{ui:params.hires.steps}}**: the steps of the second pass. 0 uses as many as the first pass.

It takes about as long as drawing twice. The progress counts both passes together. LoRAs and reference images are used in the second pass too.

When the result is much larger than the model draws well (about 2048 px on the long side for SDXL, 1536 px for SD1.X), a note shows under the generate button. You can still generate; if the picture breaks up, lower the scale.

The image keeps the first-pass size and the {{ui:params.hires.title}} settings. Loading it with "{{ui:gallery.menu.useAll}}" in the gallery sets the {{ui:params.hires.title}} as it was.

## Iterations and the Generate button

![The menu opened with the arrow next to the Generate button](shot:invoke-menu)

The controls for generating are gathered near the top of the left panel.

- **{{ui:params.invoke.invoke}}** (the blue button): Adds to the end of the queue and generates. You can also press `Ctrl+Enter`.
- **The number next to ×** (Iterations): How many pictures are made in one operation. Set it to "3" and three pictures are made.
- **The red × button**: Cancels what is being drawn right now.
- **The ∨ to the right of each button**: A menu of other operations.

When it cannot be pressed, the button turns gray and the reason (for example, no model is selected) appears on the line below it. Hover over the button to see the list of reasons.
While drawing, the button changes to "{{ui:params.invoke.generating}}" and shows the progress (%) and the number waiting in the queue.

### The ∨ menu of the Generate button

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): Draws in the order you pressed. This is the same as a normal generation.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): Cuts in at the front of the waiting line. Use it when you are in a hurry and want to try just one picture.
- **{{ui:xyplot.menu}}**: Based on the current settings, it lines up pictures with one or two settings changed in a single table. They are drawn with the same seed, so the only difference is the setting you changed. Choose CFG scale, steps, the model or the like for the horizontal and vertical axes, enter the values, and press **{{ui:xyplot.run}}**.

### The cancel menu

Press the ∨ to the right of the red × button to show the following menu.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): Removes everything, both what is waiting and what is being drawn. No confirmation appears.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: Stops and resumes the processing of the queue.
- **{{ui:params.invoke.openQueue}}**

## Looking at the finished picture

![The screen after generation finishes. The picture is shown in the viewer in the center and also lined up in the gallery on the right](shot:generate-result)

As soon as you press the button, the center switches to the viewer.
While drawing, a "{{ui:gallery.generating.title}}" band appears above the gallery on the right, and you can see the picture in progress, the step count and how far along it is. The thin line at the top edge of the center also shows the progress. The same picture also appears as a small cell at the start of the gallery. Press the cell to see the picture in progress large in the viewer in the center. When the drawing ends, the finished picture takes its place.

When it is done, the picture is added to the gallery and shown in the viewer.
The picture is saved to the board that is currently selected (the one marked "{{ui:gallery.boards.autoBadge}}" in the right panel). Boards, and organizing, comparing and redoing pictures, are explained in [The Gallery and the Viewer](03-gallery.md).

> If the viewer switching to each new picture by itself gets in the way, turn off "{{ui:gallery.settings.autoSwitch}}" in {{ui:gallery.settings.title}} (the gear button).

## Presets

![The list of presets, with built-in presets and saved presets](shot:presets)

You can save a combination of settings you use often as a preset. Press the "{{ui:presets.label}}" card at the very top of the left panel to open the list.

A preset holds the following together.

- The prompts (positive and negative)
- The model and each setting (size, steps, CFG, scheduler, VAE and so on)
- LoRAs and reference images
- {{ui:params.hires.title}}, the settings of the **{{ui:app.tabs.upscaling}}** tab, the inpaint settings (mask blur, infill and so on) and how dynamic prompts are made

The seed, Iterations and the picture to upscale are not included.

Here is how to use them.

- Click an item in the list and its settings are applied (**{{ui:presets.apply}}**).
- With **{{ui:presets.saveNew}}** at the bottom of the list (or the save button next to the card), you save the current settings under a name.
- The "…" at the right of an item lets you **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** and **{{ui:presets.delete}}**.
- The list is divided into "{{ui:presets.group.mine}}" and "{{ui:presets.group.builtin}}". The built-in presets are samples that come with the app.

## Prompt presets

![The prompt presets. Words and meanings are lined up by category, with Positive and Negative add buttons](shot:prompt-book)

So that you can build prompts even if you do not remember English words, there is the **{{ui:params.promptBook.open}}**. Open it from the button above the positive and negative fields.

- When you choose a category on the left (hairstyles, expressions, clothing, composition and so on), only the words in that category are listed. The search field at the top searches words, meanings, categories and notes all at once.
- Press "{{ui:params.prompt.positive}}" or "{{ui:params.prompt.negative}}" to the right of a word and the word is added to the prompt. An added word gets a check mark, and pressing it again removes it.
- Type a word and its meaning into the input field at the very top and press **{{ui:params.promptBook.register}}** to add your own word. The pencil to the right of a word edits it, and the trash can deletes it.

## Reference images

**{{ui:params.refImage.sectionLabel}}** is a feature for steering a new picture toward the "mood" or "style" of an existing one. It does not copy it exactly. It uses the color palette, the art style and the overall impression as clues.

1. Press the **＋** button under the prompt to add one frame.
2. Drag and drop a picture from the gallery onto that frame. You can also drop an image file from your computer.
3. Click the frame and a small settings window opens.

In the small window you can decide the following.

- **{{ui:params.refImage.model}}**: The dedicated model for reference images (IP-Adapter). You need one that fits the family of the model you have selected.
- **{{ui:params.refImage.methodLabel}}**: What to use as the clue, such as the whole picture, style only or composition only (it does not appear for some model families).
- **{{ui:params.refImage.weight}}**: How strongly to steer.
- **{{ui:params.refImage.begin}}** and **{{ui:params.refImage.end}}**: The part of the drawing process where it takes effect, from start to finish.

When a required model or extension is not installed, a warning mark appears on the frame, and guidance appears in the small window and under the Generate button. You can install it from the button in the guidance.

> A reference image is for "steering the mood". When you want to "redraw based on this picture", use the canvas. See [Drawing More on the Canvas](05-canvas.md).

### Characters

In the "{{ui:character.row.label}}" field above the reference images, you can call up registered characters (any number of pictures of the same character, with words describing their looks).
When you choose one, that character's reference images and appearance words are set. How to register a character is explained in [Fixing and Reusing Pictures](04-improve.md).

## Queue

![The Queue tab. The item being processed and the waiting items are listed](shot:queue)

On the **{{ui:app.tabs.queue}}** tab you can see and manage the waiting line for generation. When items are waiting, a number badge appears on {{ui:app.tabs.queue}} in the side navigation.

At the top of the screen there are the following.

- The processing state ("{{ui:queue.processor.running}}" or "{{ui:queue.processor.paused}}") and the control buttons.
- The breakdown of the item counts ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- At the upper right, the progress of the item being drawn now.

The buttons do the following.

| Button | What it does |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Stops or resumes processing of the waiting line. What is being drawn now is finished as it is |
| **{{ui:queue.action.cancelCurrent}}** | Stops what is being drawn right now |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Cancels everything that is waiting |
| **{{ui:queue.action.prune}}** | Removes finished items (completed, failed, canceled) from the list |
| **{{ui:queue.action.clear}}** | Removes all items. A confirmation window appears |

Click a row in the list below to open the detailed information for that item (the times, the pictures made, the reason if it failed, and the contents of the settings).
The × at the right of a row cancels just that item. Items that failed or were canceled get a retry button.

## Keyboard shortcuts

For shortcuts that do not work while you are typing, leave the input field before pressing them.

| Action | Key |
|---|---|
| Generate (add to the end of the queue) | `Ctrl+Enter` (works even while typing the prompt) |
| Add to the front of the queue and generate | `Ctrl+Shift+Enter` |
| Cancel what is being drawn | `Shift+X` |
| Clear the whole queue (no confirmation) | `Ctrl+Shift+X` |
| Move to the prompt field | `Alt+A` |
| Show or hide the left and right panels | `T`, `G` |
| Open and close both panels together | `F` |
| Switch tabs (in the order of the side navigation, from {{ui:app.tabs.generate}} to {{ui:app.nav.extensions}}) | `1` to `9` |
| Open the list of shortcuts | `Shift+?` |

You can also check the shortcuts under "{{ui:app.nav.hotkeys}}" in the **{{ui:app.nav.settings}}** menu of the side navigation.
