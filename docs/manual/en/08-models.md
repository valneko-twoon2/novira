# Managing and Finding Models

To make images, you need a "model" that is the source of the pictures. novira has the **{{ui:app.tabs.models}}** tab, for organizing the models you have, and the **{{ui:app.tabs.browse}}** tab, for finding and installing models on the internet.

This chapter explains how to use the two tabs, the kinds of models, and how to read licenses.

## Kinds of models

A model has a "{{ui:models.sort.base}}" (which family it belongs to) and a "{{ui:models.sort.type}}" (what role it plays).

### Base (family)

Models are made family by family, and models of different families cannot be combined. For example, a LoRA made for SD1.5 cannot be used with an SDXL model.

| Shown as | What it is |
|---|---|
| SD1.X | Stable Diffusion 1.5 and the like. Runs with a light load |
| SD2.X | The Stable Diffusion 2 family |
| SDXL | The Stable Diffusion XL family. Many illustration models (Illustrious, NoobAI, Pony and so on) are in here too |
| SD3.X | The Stable Diffusion 3 family |
| FLUX | The FLUX family |
| Any | Things that do not depend on a family (upscalers and the like) |

> Besides SD1.X, SD2.X and SDXL, the models of the newer families (Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow, HunyuanImage and Hunyuan-DiT) can generate pictures, and Wan, HunyuanVideo and LTX-Video models make video on the Video screen. Models of other families appear in the list, but generating with them fails and names the family. How the app handles them is in the Generate chapter.

If the bases of the model and the LoRA do not match, the Generate button on the **{{ui:app.tabs.generate}}** screen cannot be pressed and the reason is shown.

### Types

| Type | Role |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | The main body that draws the picture |
| {{ui:models.type.lora}} | A small model added to the main one to add an art style or a character |
| {{ui:models.type.vae}} | A part used to finish the colors and details of a picture |
| {{ui:models.type.controlnet}}, {{ui:models.type.modelPatch}} | Specifies the shape of a picture, such as a pose or line art (model patches are for Anima, Qwen-Image and Z-Image) |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Carry the mood of a reference image into the generation |
| {{ui:models.rail.upscale}} | Enlarge images |
| {{ui:models.rail.encoders}} | Parts that understand text (T5, Qwen, CLIP and so on; what Anima or Flux need besides the model itself) |
| {{ui:models.rail.diffusion}} | Models handed out as the model body alone, such as Flux, Wan, Anima and Qwen-Image. When you install one, novira reads the file to tell its kind and family |

Models for video, music, voice and logos do not appear in this list. You download them from each of their own screens ([Video, Music, Voice, Logos and Text](07-media.md)).

## The Models tab

![The Models tab. Categories on the left and model cards lined up in the middle](shot:models)

The **{{ui:app.tabs.models}}** tab is a list of the models you have.

### Finding

With **{{ui:models.rail.title}}** on the left, you can narrow the list by type. The count appears at the right.

- **{{ui:models.rail.all}}**: Everything
- **{{ui:models.rail.favorites}}**: Those you gave a star
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

In the bar at the top, you can narrow by name (**{{ui:models.searchPlaceholder}}**), narrow by base, **{{ui:models.sort.label}}** ({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), switch between **{{ui:models.view.grid}}** and **{{ui:models.view.list}}**, and adjust the size of the thumbnails.

At the lower left of a card there are tags for the base (SDXL and so on) and the format. A model whose license is known also has a license tag at the upper left ([License tags](#license-tags)); pressing it opens what the license allows right there, without choosing the card. When the cards are small, the tag shows only its mark. When you hover the mouse over a card, a star (favorite) and a menu appear.

At the lower right of the screen, the number of models and their total size are shown.

### Adding models

There are two buttons at the upper right.

- **{{ui:models.find}}**: Moves to the **{{ui:app.tabs.browse}}** tab (see the chapter section below).
- **{{ui:models.import}}**: Brings in files you have, or a model whose address you know.

When you press **{{ui:models.import}}**, the **{{ui:models.import.title}}** screen opens, and you can choose from four methods.

| Tab | How to use it |
|---|---|
| {{ui:models.install.tab.source}} | Enter the address of a model and press **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | Press **{{ui:models.install.scan}}** and choose a folder in the dialog that opens, and the models inside are listed. **{{ui:models.install.installAll}}** brings them all in at once. Files on your computer are installed from here. Not available in a browser |
| {{ui:models.install.tab.starter}} | The app has chosen and lined up models that are handy to have at first. Models they depend on (such as a VAE) are installed too. The model packs for video, music, voice, logos and erasing are listed as well. Narrow the list with **{{ui:models.starter.purposes}}** (making pictures, video, upscaling and so on) and **{{ui:models.starter.families}}** (Anima, SDXL and so on) on the left. Picking a family also lists the VAEs and encoders it needs |
| {{ui:models.install.tab.huggingface}} | A field for searching by Hugging Face repository name (`author/name`) |

What you can enter in the **{{ui:models.install.tab.source}}** field is the following.

- The address of a model's page on Civitai
- A direct address to a model file (one that starts with `https://`)
- A Hugging Face file (in the form `author/name::filename`)

If you enter the location of a file on your computer (in a form like `C:\models\model.safetensors`), you are pointed to **{{ui:models.install.tab.scan}}**. A file chosen there is brought into the app's model folder (on the same drive, the disk space hardly increases. On a different drive, it is copied).

> The **{{ui:models.install.tab.huggingface}}** tab lists the single model files (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) of a repository after you enter it (`author/name`) and press **{{ui:models.install.hfLookup}}**. Files in the folders of a diffusers pipeline, such as `unet` and `vae`, are not listed. If a Hugging Face token is saved, the list is fetched with it.

Installing proceeds in order. You can see the progress in the **{{ui:models.queue.title}}** that appears when you press **{{ui:models.dock.queue}}** at the lower left of the screen (while working it shows "N installing"). Here you can also **{{ui:models.queue.cancel}}** one at a time, and tidy up the finished ones with **{{ui:models.queue.prune}}**.

A file that is partway through downloading goes into the model folder only after it completes. Even if you stop partway, no half-finished file is left.

### Model details

![When you choose a model, its details appear on the right. Size, location, license, source and so on are lined up](shot:models-detail)

When you press a card, the details open on the right. To close them, press **{{ui:models.detail.close}}** at the upper right.

The details show the name, the tags for base and type, the description, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (you can copy it), **{{ui:models.details.license}}** and **{{ui:models.details.source}}** and **{{ui:models.details.page}}** (the address of the original model; press it to open it in your browser).

When a model has several pictures, the arrows on either side of the picture switch between them, and the number of the current one shows at the lower right (a model installed from Civitai gets the pictures of its original page).

With the buttons at the top, you can do the following.

- **{{ui:models.detail.openSource}}**: Opens the original page of the model in your browser (only for models whose page is known).
- **{{ui:common.edit}}**: Fixes the name, description, base and type. Use it when the base or type was not judged correctly automatically.
- **{{ui:common.delete}}**: Deletes the model (see below).

### Trigger phrases

LoRAs and the like have words (trigger phrases) that take effect when you put them in the prompt. If you register them in **{{ui:models.triggers.title}}**, then when you choose that LoRA on the **{{ui:app.tabs.generate}}** screen, the words appear as buttons. Pressing one adds it to the prompt.

Type a word into the input field and press **{{ui:common.add}}** to register it. You can remove it with the ×. Changes are saved right away. For models installed from Civitai, the words that the distributor gives may already be entered from the start.

### Default settings

A main model has **{{ui:models.defaults.title}}**. These are values that are filled in automatically when you choose that model on the generation screen.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Width and height

You can also save **{{ui:models.defaults.vae}}** and **{{ui:models.defaults.vaePrecision}}**. Only the items whose switch you turned on are saved. Press **{{ui:common.save}}** to confirm.

The "recommended values" differ from model to model, so if you set up the models you use often once, you do not have to fix them every time.

### Deleting

When you press **{{ui:common.delete}}**, a confirmation appears. **{{ui:models.deleteWarning}}**

However, a model that novira installed (one inside the app's data folder) is deleted along with its file, while a model in a folder you prepared yourself is only removed from the list and the file stays.

## License tags

Models have terms of use (a license) decided by their distributor. novira shows the key points of it with tags.

| Tag | Meaning |
|---|---|
| {{ui:browse.commercial.allowed}} | Selling the generated images, use on generation services and selling the model itself are all permitted |
| {{ui:browse.commercial.limited}} | Only some of the commercial uses are permitted (a tag with some uses not stated is this one too) |
| {{ui:browse.commercial.denied}} | None of selling the generated images, use on generation services and selling the model itself is permitted |

When you press a tag, the list **{{ui:browse.permission.title}}** appears. You can see, for things such as "{{ui:browse.permission.sellImages}}", "{{ui:browse.permission.sellModel}}" and "{{ui:browse.permission.shareMerges}}", whether each is allowed, not allowed or not stated.

The tag is decided from the usage permissions the author set on Civitai, and from the license shown on Hugging Face. It is a guide based on what the sites show, and in the end please check the text of the distributor's license. **{{ui:browse.permission.disclaimer}}**

When the license of an installed model is not known, **{{ui:models.details.licenseUnknown}}** is shown.

> There are also models with non-commercial licenses. For example, the video **{{ui:video.model.fast}}** has a non-commercial license. When you use the images or videos you make for work or for sale, be sure to check the license of the model you used.

## The Browse tab

![The Browse tab. Where to search, type, the search field and filters at the top, and model cards lined up below](shot:browse)

The **{{ui:app.tabs.browse}}** tab is a screen for searching for models on the internet and installing them right away.

### Where to search

With the switch at the upper left, you choose where to search.

- **{{ui:browse.source.civitai}}**: A site where many illustrations and LoRAs are gathered.
- **{{ui:browse.source.huggingface}}**: A site with many models from research institutions and companies. Models there cannot be found by name, so paste the URL of the model page (a folder or file page is fine) or `owner/name` into the large box in the middle of the screen and press **{{ui:models.install.hfLookup}}**. Tick the files shown, then press the install button at the top right to start downloading. If you pasted the URL of a folder, only the files in that folder are shown first.

Next to it, choose the **{{ui:browse.kind.label}}**. They are **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** and **{{ui:browse.kind.all}}**.

### Filtering

In the search field, enter a model name, an author or a tag. After you enter it and wait a moment, the results are replaced.

You can narrow the results with the menus on the right.

| Item | What it is |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}} and so on |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | All time, Year, Month, Week, Day (Civitai only). A paid version shows "{{ui:browse.paid.badge}}" on its card, and an early access also shows the day it becomes free. A paid version cannot be installed (its button cannot be pressed), because the app cannot tell whether you bought it; get it on Civitai's page |
| {{ui:browse.nsfw.label}} | Off by default. When you turn it on, adult-oriented models appear too |
| **{{ui:browse.filter.button}}** | Opens a box where you can narrow by what the license allows (selling generated images, use on generation services and so on; only models that allow everything you tick appear), the type of checkpoint, the price ({{ui:browse.filter.free}} or {{ui:browse.filter.paid}}), only models that have a safetensors file, and the author (the exact same name). The button shows how many filters are set, and **{{ui:browse.filter.reset}}** clears them (Civitai only) |

When you scroll to the bottom, more is loaded. You can also load more with **{{ui:browse.status.loadMore}}**. If it could not be fetched, press **{{ui:browse.status.retry}}**.

### Reading a card and installing

A card shows a sample image, the model's name, the author, the number of downloads, the number of likes and the license tag. For LoRAs, trigger words are shown too.

- **{{ui:browse.card.download}}**: Installs the representative file of that model.
- The icon at the right (**{{ui:browse.card.openCivitai}}**): Opens the distributor's site in your browser.

When you press a card, the details open from the right. You can see the versions, the list of files (size and format), trigger words, tags, the description and the license. Choose a version and press **{{ui:browse.card.download}}** for the file you want to install. Pressing a trigger word copies it. Close it by pressing outside it or with `Esc`.

When installing starts, a small box labeled **{{ui:browse.dock.title}}** appears at the lower left of the screen and you can see the progress. You can stop with **{{ui:browse.dock.cancel}}**, and clear the finished ones with **{{ui:browse.dock.clear}}**. A card that has finished installing changes to **{{ui:browse.card.installed}}** and is also added to the list on the **{{ui:app.tabs.models}}** tab.

> When you download a model that requires logging in, register your Civitai API key in **{{ui:settings.title}}**. When you use a model on Hugging Face that requires an access request, register your Hugging Face token. Both are encrypted and saved on this computer, and are not shown on the screen. For details, go to [The Agent and Settings](09-assistant-settings.md).

> To get the picture and the license of your local models from Civitai, turn on **{{ui:settings.engine.civitai.label}}** in **{{ui:settings.tab.engine}}** in **{{ui:settings.title}}**. novira sends the hash of each model file to Civitai, so it is off by default. The change applies at the next start. While it is off and a model has no picture, a note above the **{{ui:app.tabs.models}}** tab list says so, and **{{ui:models.coverHint.open}}** opens the settings.

To go on to generating images, go to [Making Images](02-generate.md).
