# Fixing and Reusing Pictures

This chapter gathers the features for when you think "I'd like to fix this finished picture a little", "I want a few more in the same mood", or "I want to use this character in another scene too".

Most features are called up from a button on the toolbar above the viewer (the screen that shows a picture large) or from the menu you get by right-clicking a picture in the gallery. Hover the mouse over a toolbar button to see its name. For the basics of the viewer and the gallery, see [The Gallery](03-gallery.md).

## What to use from where

| What you want to do | What to use | What else you need |
|---|---|---|
| Make a few more with the same settings, or redo one with slight changes | **{{ui:gallery.derive.menu}}** | The model used for the original picture is installed |
| Remove the background and keep only the person or object | **{{ui:cutout.menu}}** | The extension ComfyUI-RMBG |
| Trim transparent margins | **{{ui:gallery.menu.trim}}** (right-click only) | Nothing |
| Select part of a picture, then cut it out, erase it or repaint it | **{{ui:gallery.menu.segment}}** | An extension such as ComfyUI-segment-anything-2 |
| Clean up small, misshapen faces | **{{ui:facefix.menu}}** | The extensions ComfyUI-Impact-Pack and ComfyUI-Impact-Subpack |
| Turn a picture into a black-and-white manga page | **{{ui:gallery.manga.menu}}** (viewer toolbar only) | The extension ComfyUI-MangaScreen |
| Write out a prompt from a picture | **{{ui:caption.menu}}** | The extension ComfyUI-Florence2 |
| Register a character and use it in other pictures | **{{ui:character.menu}}** | The extension for reference images (IP-Adapter) |
| Line up pictures with changed settings in one table | **{{ui:xyplot.menu}}** | Nothing |
| Choose from half-drawn candidates | The **{{ui:app.views.drafts}}** tab | Nothing |
| Apply the same processing to many pictures | **{{ui:gallery.menu.batch}}** (choose several and right-click) | Depends on the processing |

## When an extension is needed

Removing backgrounds, selecting a region, fixing faces and so on work by adding "extensions" to the engine that makes the pictures (ComfyUI). If an extension is not installed, the dialog says "… needs the extension XXX." and buttons for installing it are shown.

1. Press **{{ui:cutout.install}}**. It downloads and installs what is needed automatically.
2. When installation finishes, the button changes to **{{ui:cutout.restart}}**. Press it and ComfyUI restarts.
3. After the restart, the same dialog can be used just as it is.

The first time you use one, the models the extension uses also start downloading, so it takes a while. You need to be connected to the internet.

> Some extensions take time and disk space to install. ComfyUI-Impact-Pack needs Git to install. On a computer without Git, installation fails. If a message appears, read it and then act on it.

You can also install extensions from the "{{ui:workflows.panel.packs}}" tab in [Workflows](06-upscaling-workflows.md). If it does not work, see [Troubleshooting](10-troubleshooting.md) too.

## Making another one with the same settings (derive)

![The "Derive more" menu opened on the viewer toolbar](shot:derive-menu)

Open a picture you like in the viewer and press the **{{ui:gallery.derive.menu}}** button (the branching icon) on the toolbar. In the gallery, right-click the picture and choose **{{ui:gallery.derive.menu}}**.

You can choose from the following three kinds.

| Item | What it does |
|---|---|
| "Same settings, new seed" (1 or 4 pictures) | Draws with only the seed changed, keeping the prompt, model, size and so on. The composition changes, but the mood is the same. |
| "Redo with small changes" (1 or 4 pictures) | Uses the original picture as a base and redraws it lightly (at a strength of 0.45). The composition and colors stay, and only the details change. |
| **{{ui:gallery.derive.custom}}** | You decide how much to change (see the next section). |

When you choose one, the new pictures go into the queue and are lined up on the same board as the original. **The settings on the Generate tab are not rewritten.** The prompt you are typing also stays as it is.

> When you want to bring the settings back onto the screen and then fix them yourself before making a picture, use **{{ui:gallery.menu.remix}}**. Derive is for "making it with the original settings at the press of one button".

### Choosing how much to change and remaking

![The dialog for deciding how much to change](shot:derive)

When you choose **{{ui:gallery.derive.custom}}**, a dialog opens.

1. Move the **{{ui:gallery.derive.dialog.strength}}** slider. The further left ({{ui:gallery.derive.dialog.close}}), the more of the original composition and colors remain; the further right ({{ui:gallery.derive.dialog.free}}), the closer it gets to a different picture.
2. Choose the **{{ui:gallery.derive.dialog.count}}** from 1, 2, 4 and 8.
3. Press **{{ui:gallery.derive.dialog.create}}**.

As a guide, around 0.25 gives a picture almost the same as the original, and around 0.75 gives a picture where the character stays but the composition changes greatly. It depends on the picture, so try a few. The slider value applies only to that one time.

### What is carried over and what is not

- Carried over: The settings used when the picture was made, such as the prompt, negative prompt, model, LoRA, size, steps, CFG scale and scheduler.
- Reference images and control layers are also remembered along with the picture, so they are used as they are. However, if such an image has been deleted from the gallery, the picture cannot be made. The reason appears in a notification.
- Not carried over: Masks, regional guidance and draft settings. If a picture was made before this feature existed and used reference images or the like, they were not remembered, so they cannot be carried over. When something could not be carried over, you are told in a notification.

In the following cases, the button cannot be pressed, or a notification appears and the picture cannot be made.

- When the picture is not a generated one (that is, one made from text; image to image, inpainting and outpainting count as generated too). Enlarged pictures, video, audio and the like are not covered.
- When the model used for the original picture is not installed. A notification with the model's name appears.

## Removing a background

![The dialog for removing a background](shot:cutout)

It automatically recognizes what is in the picture and makes a picture with the background removed. You do not need to specify anything by clicking.

1. Open the picture in the viewer and press **{{ui:cutout.menu}}** with the scissors icon (it is also in the right-click menu).
2. If needed, change the settings.
   - **{{ui:cutout.model}}**: Usually it is fine as it is.
   - **{{ui:cutout.sensitivity}}**: The lower you set it, the more of the parts with unclear boundaries it keeps.
   - **{{ui:cutout.edge}}**: A positive value widens the outline and a negative value shaves it.
   - **{{ui:cutout.background}}**: Choose **{{ui:cutout.background.alpha}}** or **{{ui:cutout.background.white}}**.
3. Press **{{ui:cutout.run}}**.

The finished picture is saved as a new picture on the same board as the original. **The original picture stays as it is.** If you are not happy with the result, change the settings and press **{{ui:cutout.again}}**. **{{ui:cutout.open}}** shows it in the viewer.

A white background is a good choice when you later want to use the picture as a reference image for a [character](#registering-and-using-a-character). The color of the background is less likely to carry over into the new pictures you make.

## Trimming transparent margins

A picture with a transparent background keeps transparent margins around the outside of the picture. With **{{ui:gallery.menu.trim}}**, you save a new transparent picture cut tightly to the part that has content. It is handy when you use it as a sticker or as material.

- Right-click a picture in the gallery and choose it. Right after removing a background, you can do the same thing from **{{ui:cutout.trim}}** in the dialog (it appears only when you made the background transparent).
- A shadow so faint it is almost invisible is trimmed away as margin.
- For a picture whose transparent area does not reach the edge of the picture, "There is no margin to trim." appears and nothing is saved. A picture that is transparent all over cannot be trimmed either.

## Selecting a region and fixing it

![The dialog for specifying with clicks what to select in the picture](shot:segment)

You select the thing in the picture you have in mind with a click. You can then cut out, erase or repaint the selected part.

1. Open the picture in the viewer and press **{{ui:gallery.menu.segment}}**.
2. The first time only, the extension ComfyUI-segment-anything-2 is needed. Install it by following the guidance on the screen ([When an extension is needed](#when-an-extension-is-needed)).
3. Click the thing you want to select. If something is missing, click another place to add it. To remove an area that spilled over, switch the button to **{{ui:segment.mode.exclude}}** and click, or right-click (or click while holding `Shift`). Clicking a point you set again cancels that point. **{{ui:segment.clear}}** lets you start over from the beginning.
4. Press **{{ui:segment.run}}**. The selected area is shown in blue.
5. If the blue area is right, choose the next operation. If you want to select the "rest" instead, turn on **{{ui:segment.invert}}**.

| Button | What it does | What you need |
|---|---|---|
| **{{ui:segment.cutout}}** | Cuts out only the selected part and saves it as a transparent picture. | Nothing |
| **{{ui:segment.mosaic}}** | Turns the selected part into coarse blocks (mosaic) and saves the picture. The block size is the number beside the button. | Nothing |
| **{{ui:segment.erase}}** | Erases the selected part, blending it into the surrounding picture. | The extension comfyui-inpaint-nodes. With the LaMa model (about 200MB), it erases naturally. Without it, you can still erase in a simple way. |
| **{{ui:segment.redraw.title}}** | Repaints only the selected part according to a text instruction. The other parts do not change. | An image model |
| **{{ui:segment.toCanvas}}** | Sends the picture and the selection to the [canvas](05-canvas.md). The selection becomes an inpaint mask. | Nothing |

When repainting, you write **what to draw** in text (for example: blue hair, red scarf). You are more likely to get the result you expect if you write in the style the model is good at (such as English tags for an anime-style model). The lower you set **{{ui:segment.redraw.strength}}**, the more of the original shapes and colors remain.

The result is saved as a new picture on the same board as the original. The original picture does not change.

## Fixing faces

![The dialog for fixing faces](shot:facefix)

In wide shots, faces that appear small often come out misshapen. **{{ui:facefix.menu}}** automatically finds the faces in the picture, redraws only the faces at a high resolution, and puts them back in the original picture. Nothing other than the faces changes.

1. Open the picture in the viewer and press **{{ui:facefix.menu}}** (it is also in the right-click menu).
2. The first time only, the extensions ComfyUI-Impact-Pack and ComfyUI-Impact-Subpack are needed. Install them with **{{ui:facefix.install}}** and press **{{ui:facefix.restart}}**. The model that finds faces is prepared by the Subpack itself.
3. Check the settings.
   - **{{ui:facefix.model}}**: The model used for the original picture is selected.
   - **{{ui:facefix.prompt}}**: The original picture's prompt is filled in. Adding features of the face makes it more effective.
   - **{{ui:facefix.strength}}**: The lower it is, the closer to the original face; the higher it is, the more it redraws.
   - **{{ui:facefix.sensitivity}}**: Raising it picks up only clear faces, and lowering it also picks up small faces and profiles. However, it also becomes easier for it to pick up things that are not faces.
4. Press **{{ui:facefix.run}}**.

The result is saved on the same board as the original. Press **{{ui:facefix.open}}** to compare it with the original in the viewer. If you do not like it, change the settings and press **{{ui:facefix.again}}**.

> A picture made with a LoRA is redrawn without the LoRA. Because of this, only the face may look slightly different in style.

> When "The face detection model (YOLO) was not found" appears, restart ComfyUI or install the extensions again.

## Finishing a picture as a manga page

**{{ui:gallery.manga.menu}}** on the viewer toolbar turns the open picture into a black-and-white manga page with crisp lines. Shading becomes flat tones and real screentone dots, and the main lines inside solid black are cut out thin and white. Drawing itself always makes the normal color picture; the finish is a step you take afterwards, on a picture you like.

1. Open the picture in the viewer and press **{{ui:gallery.manga.menu}}**. The original is shown on the left.
2. The first time only, the extension ComfyUI-MangaScreen is needed. When it is not installed, a notice appears; press **{{ui:gallery.manga.installPack}}**, and then **{{ui:gallery.manga.restartEngine}}**. The buttons below wait until it is installed.
3. Change the values if you want (they are remembered for next time):
   - **{{ui:gallery.manga.screenLines}}**: rows of dots across the width. 120 is coarse, 200 normal, 300 fine.
   - **{{ui:gallery.manga.whitePoint}}**: brighter than this becomes paper white. Lower it to clear the tone from skin and light hair.
   - **{{ui:gallery.manga.blackPoint}}**: darker than this becomes solid black. Raise it for more black.
   - **{{ui:gallery.manga.gradation}}**: smooth shadows grow their dots with the darkness instead of being cut into steps. 0 keeps flat areas only.
   - **{{ui:gallery.manga.whiteLines}}**: how many lines inside solid black are cut out white. 0 turns it off.
   **{{ui:gallery.manga.reset}}** puts every value back.
4. Press **{{ui:gallery.manga.tryRun}}** to see the result on the right, beside the original. Nothing is saved by a try.
5. Press **{{ui:gallery.manga.save}}** when you like it. The page is saved as a new picture on the same board as the original, and the original does not change. Press **{{ui:gallery.manga.open}}** to look at it.

Saving finishes the picture again with the values shown, so it takes as long as one try.

## Making a prompt from a picture

![The dialog after it wrote out tags for a picture](shot:caption)

Looks at a picture and writes out a prompt (tags or a sentence) for drawing it. Use it when you want pictures close to one you like, or when you are not sure how to write the prompt.

1. Choose the **{{ui:caption.menu}}** button in the viewer, or **{{ui:caption.menu}}** in the picture's right-click menu. You can also open it from the **{{ui:caption.fromPrompt}}** button above the prompt field on the Generate tab. You can drop a gallery picture or an image file from your computer on that button.
2. Under **{{ui:caption.style}}**, choose **{{ui:caption.style.tags}}** or **{{ui:caption.style.sentence}}**.
3. Press **{{ui:caption.run}}**.
4. You can edit the words right there. Then press **{{ui:caption.replace}}**, **{{ui:caption.append}}** or **{{ui:caption.copy}}**.

Replacing and adding work on "{{ui:params.prompt.positive}}" on the Generate tab. This feature adds no picture to the gallery.

> This feature needs the extension ComfyUI-Florence2. When it is not installed, you can install it from the dialog (see "When an extension is needed" in this chapter). The first time you use it, the model for describing pictures (Florence-2 PromptGen) is downloaded.

## Registering and using a character

![The dialog for registering as a character](shot:character)

If you register a picture of a character you like, you can draw that character in other scenes, staying close to its look. You register the following three things.

- Reference images (pictures of the same character, as many as you like)
- Appearance words (hair and eye color, clothes and so on; they are added to the start of the prompt)
- The strength of resemblance

### Registering

1. In the gallery, choose the picture you want to register. For several pictures, click while holding `Ctrl`.
2. Choose the **{{ui:character.menu}}** button in the viewer, or **{{ui:character.menu}}** in the right-click menu. If you open the **{{ui:character.row.choose}}** field on the Generate tab, there is **{{ui:character.row.register}}** at the very bottom of the list, and you can open it from there too.
3. Enter the **{{ui:character.name}}** and the **{{ui:character.tags}}**. Write the features you do not want to change (brown hair, a white blouse, a blue skirt and so on).
4. Decide the **{{ui:character.weight}}**. The higher you raise it, the more it resembles the reference images, but the less freedom you have over scene and composition.
5. Press **{{ui:character.save}}**.

With **{{ui:character.addSelected}}**, you can later add pictures chosen in the gallery to the reference images. **{{ui:character.removePicture}}** is the ✕ at the upper right of an image.

If you turn on **{{ui:character.whiteBg}}**, a picture with the background of the registered picture replaced with white is made, and that is used as the reference image. This prevents the background color from carrying over into the pictures you generate. The original picture is kept, and the white-background picture is saved as a new one. When the extension ComfyUI-RMBG used for removing backgrounds is not installed, this switch cannot be used and the original picture is used as it is.

### Using

1. In the left panel of the **{{ui:app.tabs.generate}}** tab (or the [Canvas](05-canvas.md) tab), open **{{ui:character.row.choose}}** and choose the character you want to use.
2. The character's reference images go into the "{{ui:params.refImage.sectionLabel}}" field, and the appearance words are added to the start of the prompt.
3. Generate as usual.

When you use one, the app may adjust some things automatically. You are told in a notification.

- When reference images are used, a high CFG scale tends to burn the picture, so if the CFG scale is higher than 5 it is lowered to 4.5.
- You can have at most 8 reference images in total. When the total with other reference images goes over 8, the pictures from the start are used.
- When there are several reference images, the strength per image is lowered automatically so that together they do not get too strong.
- Pictures that were deleted from the gallery cannot be used. If all of them have been deleted, the character cannot be used.

To fix or delete a registered character, use the "…" button on an item in the list.

> This is a feature that "gets closer" to the same character, so it does not give exactly the same face. Hairstyle, color, clothes and so on tend to be kept, but the facial features change a little. Writing the features you want to keep in the appearance words helps.

> To use reference images, you need the extension ComfyUI_IPAdapter_plus and a model for reference images. If they are not installed, you can install them from the reference images field on the Generate tab. For the models, see the [Models](08-models.md) chapter.

## Choosing a LoRA for a character

In the character's edit dialog, choose a LoRA under **{{ui:lora.section}}**. Then you can switch **{{ui:lora.use}}** on and off and change **{{ui:lora.weight}}**; using the character adds the LoRA and its trigger word to the prompt. LoRA training lives in the separate app novira-train.

## Comparing settings with a comparison grid

![The comparison grid dialog](shot:xyplot)

How does a picture change when you change the CFG scale or the number of steps? This feature puts that in a single table so you can compare.

1. On the Generate tab, decide the prompt and the model as usual.
2. Press the "▼" to the right of the **{{ui:params.invoke.invoke}}** button and choose **{{ui:xyplot.menu}}**.
3. With **{{ui:xyplot.x}}** and **{{ui:xyplot.y}}**, choose the settings to change. You can make one with just one of them.
4. Enter the values. Separate numbers with commas (for example: 3, 5, 7).
5. Press **{{ui:xyplot.run}}**.

At the bottom of the dialog, the number of pictures to be made appears, like "3 columns × 2 rows = 6 pictures will be made."

The settings you can change are as follows.

| Setting | How to enter it |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Numbers (1 to 30) |
| {{ui:xyplot.axis.steps}} | Whole numbers (1 to 150) |
| {{ui:xyplot.axis.seed}} | Whole numbers |
| {{ui:xyplot.axis.strength}} | Numbers (0.05 to 1). It has an effect only when making from an image (image to image). |
| {{ui:xyplot.axis.scheduler}} | Choose from a list |
| {{ui:xyplot.axis.model}} | Choose models of the same family from a list |
| {{ui:xyplot.axis.prompt}} | Write one per line. They are added to the prompt |

The rules are as follows.

- You can enter up to 8 values for one setting. The table can have at most 36 pictures in total.
- You cannot choose the same setting for the horizontal and the vertical.
- All the pictures are drawn with the **same seed** (except when you choose a setting that changes the seed). The only difference is the setting you changed.
- The settings are taken from the Generate tab's form at that moment. The form is not rewritten.
- A picture that could not be made shows as × in the table. The table is still made with the other pictures.

The finished table is saved in the gallery as one picture. **{{ui:xyplot.open}}** shows it in the viewer. The individual pictures the table was made from also stay in the gallery.

> The more pictures, the more time it takes. For 36 pictures, 36 generations are needed. It is recommended to try 2 or 3 values at first.

## Choosing from drafts

![The Drafts tab with half-drawn candidates lined up](shot:drafts)

A picture changes greatly depending on the seed. Drafts is a feature that draws many seeds only "part of the way" and then draws to the end only the compositions you like. It saves time.

Open the **{{ui:app.views.drafts}}** tab in the center of the **{{ui:app.tabs.generate}}** tab.

1. Choose the **{{ui:drafts.model}}**. At first, the model of the Generate tab is selected. Every picture model the Generate tab offers can be chosen: SDXL and SD1.X, and also the models that come without their text encoders and VAE, such as Anima, Flux, FLUX.2 and Z-Image. Edit models (Flux Fill, Flux Kontext, Qwen-Image-Edit) only change a picture you give them, so they are not in the list; when you have some, their names are shown below.
2. Decide the **{{ui:drafts.count}}** (1 to 24 pictures; 4 at first, which you can change with **{{ui:settings.draftCount.label}}** in the settings). The count and the position stay as you set them when you switch to other screens, until you close the app.
3. Decide the **{{ui:drafts.position}}** (25 to 60%; 35% at first). The smaller it is, the faster it is done, but the rougher the pictures.
4. Press **{{ui:drafts.start}}**.

The draft pictures line up in the order they are finished. The prompt and other settings from the Generate tab are used.

Click a picture to choose it (click it again to deselect it). Double-click to see it large in the viewer. The star button (**{{ui:drafts.keep}}**) and the ✕ (**{{ui:drafts.reject}}**) are marks for your own use. Press the "{{ui:manual.drafts.finish}} N images" button at the lower right (N is the number you chose) and the chosen pictures are drawn to the end. To choose again, press **{{ui:drafts.clearSelection}}**.

Pictures drawn to the end go into the gallery just like a normal generation, and "{{ui:drafts.badge.finished}}" appears over the draft. If some drafts failed, a "{{ui:manual.drafts.retry}} N failed" button appears.

> Although it says "{{ui:manual.drafts.finish}}", it does not resume from the middle. It draws again from beginning to end with the same seed. Because of this, the time it takes to finish is the same as a normal generation. You get a picture with the composition you saw in the draft.

> Drafts can be used only for generation that makes pictures from text. If you have reference images or the like set, a message appears and you cannot start. Draft pictures are not lined up in the gallery list.

Drafts line up in the tabs at the top "in the order you started them". Only the latest 5 stay as tabs; the older ones are chosen from the list that the "older batches" button at the left of the tabs opens. The list is split by day and shows thumbnails of the drafts drawn then, with the time. When you no longer need one, close it with the ✕ on its tab or in the list, or close all the older ones at once with "{{ui:drafts.closeOlder}}" in the list.

## Processing in bulk

![The bulk processing dialog](shot:batch)

You can apply background removal or enlarging to several chosen pictures at once.

1. In the gallery, choose several pictures (click while holding `Ctrl`, or click while holding `Shift` to choose a range).
2. Right-click on a chosen picture and choose **{{ui:gallery.menu.batch}}**.
3. Choose the processing.
   - **{{ui:batch.op.removeBackground.title}}**: Makes the background transparent. The extension ComfyUI-RMBG is needed. If it is not installed, an install button appears.
   - **{{ui:batch.op.upscale.title}}**: Enlarges with an upscaling model. If you do not have a model, install one from the [Models](08-models.md) screen.
4. Press **{{ui:batch.run}}**.

Each picture goes into the queue as its own item. You can see the progress on the **{{ui:app.tabs.queue}}** tab. The results go onto the same board as the original pictures, as new pictures. The original pictures do not change.

When you want to process a single picture carefully while changing settings, use the individual features of this chapter ([Removing a background](#removing-a-background)). To enlarge a single picture, you can also use the [Upscaling](06-upscaling-workflows.md) tab.
