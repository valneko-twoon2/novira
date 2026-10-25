# Canvas

![The whole Canvas tab. The canvas is in the center and the list of layers is at the lower right](shot:canvas)

The **{{ui:app.tabs.canvas}}** tab is a workbench for "drawing, placing and repainting just one part" of a picture. You can place an image and extend it, put a mask over the part you want to repaint, or decide a pose with a stick figure.

The screen is divided into three.

- Left: A panel with the same settings as the Generate tab (prompt, model, size and so on). On the canvas, an item for **{{ui:params.compositing.title}}** is added.
- Center: The canvas. Tool buttons are lined up above it.
- Right: The list of **{{ui:canvas.layers.title}}**, which hold your pictures.

If you press **{{ui:params.invoke.invoke}}** with nothing on it, a picture is simply made inside the dotted frame (the generation area). The real strength of the canvas shows when you place a picture or a rough sketch there. Layers and masks are saved automatically and come back when you open the app again (the undo history is not saved).

## Placing and drawing pictures

There are several ways to put a picture on the canvas.

- Draw with the brush (choose **{{ui:canvas.tool.brush}}** or press `B` first). If no layer is selected, a "{{ui:canvas.add.raster}}" is created automatically.
- Drag a picture from the gallery onto the canvas. A frame for choosing where to put it (raster, control, inpaint mask and so on) appears, so drop it there.
- Press `Ctrl+V` to paste a picture from the clipboard as a new raster layer (it is also saved to the gallery).
- Right-click a picture in the gallery (in the viewer, the brush icon) and choose a destination from **{{ui:gallery.menu.sendToCanvas}}**.

The destinations are as follows.

| Destination | What it becomes |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Clears the canvas first and starts anew at the same size as that picture. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Starts anew in the same way, but the picture becomes a control layer. |
| **{{ui:gallery.canvas.raster}}** | Adds it to the current canvas as a raster layer. |
| **{{ui:gallery.canvas.control}}** | Adds it as a control layer. |
| **{{ui:gallery.canvas.inpaint}}** | Adds it as an inpaint mask. |
| **{{ui:gallery.canvas.regional}}** | Adds it as a reference image for regional guidance (see [Regional guidance](#regional-guidance)). |

## Tools

The tools are lined up on the bar at the top. You can also switch them with letter keys on the keyboard. When the app starts, **{{ui:canvas.tool.view}}** is chosen, so dragging on the canvas first only shifts the view and draws nothing.

| Tool | Key | What it is for |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Draws pictures. You change the color with the color button on the bar. |
| **{{ui:canvas.tool.eraser}}** | `E` | Erases what you drew. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Turns the part you paint over into a mosaic (to hide something). The block size is the number in the bar. Works only on a layer with a picture. |
| **{{ui:canvas.tool.rect}}** | `U` | Fills in a rectangle. |
| **{{ui:canvas.tool.lasso}}** | `L` | Draws a free-form shape and fills it with the color (on a mask, it is masked). |
| **{{ui:canvas.tool.pose}}** | `O` | Places a stick-figure pose on a control layer and lets you move the joints (see "Making a pose on the canvas" below). |
| **{{ui:canvas.tool.move}}** | `V` | Moves layers. The arrow keys nudge the selected layer by 1 px (10 px with Shift). |
| **{{ui:canvas.tool.bbox}}** | `C` | Moves the generation area (bounding box) and changes its size. |
| **{{ui:canvas.tool.view}}** | `H` | Shifts the view. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Picks up a color from the picture. |
| **{{ui:canvas.tool.bucket}}** | `K` | Fills the region of colors close to the one you press. **{{ui:canvas.toolbar.bucketTolerance}}** on the bar sets how close. |

You can also do the following.

- Change the brush width with **{{ui:canvas.toolbar.brushWidth}}** on the bar, or with the `[` and `]` keys. `Q` switches between the current tool and the one used before.
- Zoom in and out with the mouse wheel or the `+` and `-` keys. `Ctrl+0` shows the whole canvas, and `Ctrl+1` shows actual size (100%).
- To shift the view, drag while holding `Space`, or drag while pressing the wheel button.
- With **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) and **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`), you can undo and redo what you drew.

The gear, **{{ui:canvas.settings.title}}**, has things such as showing a grid, darkening the outside of the generation area, a setting that keeps drawn lines inside the generation area only, and an operation that merges the visible raster layers into one.

## The generation area (bounding box)

The dotted frame in the canvas is "the area where a picture is made this time". Each time you generate, only the inside of this frame is made, and its size becomes the size of the picture.

- Switch to **{{ui:canvas.tool.bbox}}** (`C`) and drag the frame to move it. Drag a corner or an edge to change its size.
- You can also decide the size with **{{ui:params.image.bboxWidth}}** and **{{ui:params.image.bboxHeight}}** in the left panel.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) fits the frame to the pictures you placed.

## Layers

In **{{ui:canvas.layers.title}}** at the lower right, the things you placed on the canvas are listed. Add them with the **{{ui:common.add}}** button.

![The Add menu of the layers opened](shot:canvas-add-layer)

Layers come in kinds with different roles.

| Kind | Role |
|---|---|
| **{{ui:canvas.add.raster}}** | An ordinary picture layer. You draw on it and place pictures on it. What is here becomes the "original picture". |
| **{{ui:canvas.add.control}}** | A picture used as a clue for shape, lines, pose and so on. It acts as an instruction to the generation and does not become part of the picture itself. |
| **{{ui:canvas.add.inpaint}}** | You paint the area that says "repaint here". |
| **{{ui:canvas.add.regional}}** | A layer that gives a different prompt for each place (see [Regional guidance](#regional-guidance)). |
| **{{ui:canvas.add.globalRef}}** | A reference image that makes the whole picture imitate a mood. It is the same as the reference images on the Generate tab. |

In the list of layers, you can do the following.

- The eye icon switches between visible and hidden, and the lock icon switches the lock. Hidden layers are not used for generation. You cannot draw on a locked layer.
- Double-click a name to rename it.
- Right-click to duplicate, reorder (move forward or back; layers of the same kind can also be dragged within the list), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (control layers only), convert to another kind, copy to the clipboard, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}**, and delete.
- From **{{ui:canvas.layers.more}}** ("…"), you can also merge the visible raster layers into one and delete all layers.

![The context menu of a layer](shot:canvas-layer-menu)

Under the selected layer, that layer's settings open.

- {{ui:canvas.add.inpaint}}: The color and fill pattern of the mask (affects only how it looks on screen), and **{{ui:canvas.mask.denoiseLimit}}** (if you turn it on and lower it, the original picture is more likely to remain even inside the mask). In the mask's right-click menu, **{{ui:canvas.entityMenu.invertMask}}** swaps masked and clear areas inside the generation area.
- {{ui:canvas.add.control}}: See the next section, "{{ui:canvas.add.control}}".

## How it gets repainted

When you press **{{ui:params.invoke.invoke}}** on the canvas, the app looks inside the generation area and decides how to make the picture automatically. You do not have to choose it yourself.

| State inside the generation area | How it is made |
|---|---|
| Nothing is drawn on the visible raster layers | A new picture is made from text (text to image). |
| Only part of the raster layer is filled | The empty parts are added to extend it (outpainting). The empty parts are filled with a color first. |
| Everything is filled and the inpaint mask has no paint | The current picture is used as a base and redrawn (image to image). |
| Everything is filled and the inpaint mask has paint | Only the masked part is redrawn (inpainting). Outside the mask, the original picture stays as it is. |

For image to image, how much it changes is decided with **{{ui:params.image.strength}}** in the left panel. 0 keeps the original as it is, and 1 redraws it completely.

For outpainting, what the empty parts are filled with is chosen with **{{ui:params.compositing.infillTitle}}** under **{{ui:params.compositing.title}}** in the left panel. With **{{ui:params.compositing.infill.color}}**, they are filled with the color you choose (black, white, gray and so on). If you choose another, they are filled by blending in the surrounding colors. How soft the seam is is decided with **{{ui:params.compositing.maskBlur}}**.

> Inpainting works as it is with ordinary models. You do not need a dedicated "inpainting model".

## Deciding whether to use the result (staging)

A picture made on the canvas does not go into the canvas right away. It is shown over the generation area, and you decide whether to use it with the bar below (**{{ui:canvas.staging.title}}**).

| Button | What it does |
|---|---|
| Left and right arrows (`←` `→`) | When you made several, shows the next or previous picture. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Puts this picture into the canvas as a new raster layer. The other pictures are thrown away. |
| **{{ui:canvas.staging.hideResults}}** | Hides the results so you can compare with the original picture. |
| **{{ui:canvas.staging.saveToGallery}}** | Saves this picture to the gallery. |
| **{{ui:canvas.staging.discard}}** | Throws away just this picture. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Throws away everything. |

> Result pictures do not go into the gallery by themselves. For a picture you want to keep in the gallery, press **{{ui:canvas.staging.saveToGallery}}** first. Pictures you throw away are gone.

The grip (⋮⋮) at the left end of the results bar is for dragging a picture to another place to hand it over.

## Control layers

A control layer is a clue that says "draw following this shape, this line, this pose". You put in line art, outlines, pose pictures and so on.

To use one, you need a ControlNet model that fits the main model. For how to install one, see the [Models](08-models.md) chapter. Select the layer and choose the **{{ui:common.model}}** in its settings. If there is no model, a message such as "Control Layer 1 has no model selected" appears at the Generate button and you cannot make a picture.

The settings are as follows.

- **{{ui:canvas.control.weight}}**: How strongly it follows the clue.
- **{{ui:canvas.control.begin}}** and **{{ui:canvas.control.end}}**: From what fraction to what fraction of the generation it takes effect.
- **{{ui:canvas.control.controlMode}}**: There are **{{ui:canvas.control.mode.balanced}}** and **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** behaves the same as **{{ui:canvas.control.mode.balanced}}** for now.
- **{{ui:canvas.control.filter}}**: Converts a picture into a picture meant as a clue, such as lines or depth. It is a simple conversion done inside the app. Try it with **{{ui:canvas.control.process}}**, and if it looks good, apply it to the picture with **{{ui:common.apply}}**.

## Making a pose (stick figure)

![The dialog for deciding a pose with a stick figure](shot:pose)

You can decide a pose by moving a stick figure. It is handy when specifying a pose in words does not work well.

1. On the **{{ui:app.tabs.canvas}}** tab, press the layer **{{ui:common.add}}** and choose **{{ui:pose.menu}}**.
2. From **{{ui:pose.preset}}**, choose the pose closest to what you want ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Drag the circles at the joints to change the posture. You can also select a circle and move it with the arrow keys (hold `Shift` to move it a lot). **{{ui:pose.mirror}}** flips it left and right, and **{{ui:pose.reset}}** returns it to the original template.
4. Choose the **{{ui:pose.size}}**. Usually the canvas size is fine.
5. Press **{{ui:pose.use}}**.

The pose goes into the canvas as a control layer. If the canvas is empty, it starts anew at that size.

To use it, you need a ControlNet model that supports OpenPose. If you have one, the app automatically picks it as the layer's model. If you do not, you are told in a notification. After installing the model, choose it in the layer's settings.

> You can decide the pose of only one person. You cannot decide things as fine as the fingers of the hands or the direction of the face, so specify the face and hands in the prompt.

> How strongly the pose takes effect is decided by the layer's **{{ui:canvas.control.weight}}**. A pose layer is set from the start to the maximum strength and to take effect from beginning to end. If you want more freedom in the pose, lower it.

### Making a pose on the canvas

![The stick figure placed on the canvas with the pose tool](shot:canvas-pose)

With the **{{ui:canvas.tool.pose}}** tool (`O`) you can make a pose directly on the canvas. A placed pose can be adjusted again as many times as you like.

- Click an empty spot to place a standing stick figure. If no control layer is selected, a new control layer is created, with the strength for poses and a model that supports OpenPose (if one is installed).
- Drag a joint circle to rotate it together with the limb beyond it (the bone length does not change). Drag the neck to move the whole body. Drag while holding `Shift` to move only that joint.
- Click a joint while holding `Alt` to hide it or show it again (for limbs that stick out of the screen, for example).
- Press the `R` key or the **{{ui:canvas.pose.random}}** button on the bar to change the pose of the selected layer into a new random pose. You can press it as many times as you like, so you can try until you find one you like.
- With the number and lightning buttons on the pose tool bar, you can generate that many images in a row, changing the pose each time (up to 16). The seed changes with each pose too, so you get pictures in various postures from the same settings. If generation cannot start, the reason is shown and nothing begins.
- You can place any number of figures on one layer. Flipping left and right, rotating and scaling are done from the layer's right-click menu.
- You can also ask in words. With the **{{ui:app.tabs.canvas}}** tab open, open the agent and describe it, such as "a running pose" or "raise the left hand", and a figure is placed (up to 4 figures). After that, tell it "lean forward a little more" and it adjusts that pose. A requested pose is a guess from your words, so if it is not what you wanted, drag the joints to fix it.
- You can also make a pose from a person in a picture. Right-click a picture in the gallery and choose **{{ui:canvas.poseFromImage.menu}}**, or press the button of the same name in the pose tool bar, and the skeletons of the people in it are read and placed as stick figures (up to 4 people). The placed poses can be adjusted like any other pose. It needs the extension (comfyui_controlnet_aux), and if it is missing the dialog offers to install it. The first time, downloading the models takes a while. A person who is too small or partly hidden may not be found.
- The **{{ui:canvas.pose.presets}}** button in the pose tool bar opens a window with the categories on the left and a card for each pose on the right. Each card draws the OpenPose figure inside a frame the shape of the generation box. The "{{ui:canvas.pose.group.panel}}" (close and far, two people, groups, everyday scenes, drama and emotion) also fix where the people stand and how big they are, and replace every pose of the selected layer. The "{{ui:canvas.pose.group.standard}}" and "{{ui:canvas.pose.group.manga}}" poses replace the first pose of the selected layer in the same place and size; with no pose there, a new one is placed. A pose that would leave the box, with raised arms or a kick, is made smaller to fit.
- The **{{ui:canvas.pose3d.menu}}** button in the pose tool bar edits a pose in 3D (the first pose of the selected control layer, or a standing figure when there is none). Dragging a joint moves it with its bone length kept, and a bone can point away from you or towards you. Dragging the background turns the body, and the wheel zooms. The **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** and **{{ui:canvas.pose3d.top}}** buttons turn to fixed views. **{{ui:canvas.pose3d.apply}}** puts the shape you see now on the canvas as the pose (the depth is remembered, so you can open it in 3D again and turn it further); closing without it leaves the pose as it was. The 3D view needs WebGL in the browser; where it is missing, the dialog says so.

![Reading the poses of a picture before putting them on the canvas](shot:canvas-pose-from-image)

![The ready-made poses and compositions window with the Two people category chosen](shot:canvas-pose-presets)

![The dialog for editing a pose in 3D](shot:canvas-pose-3d)

If you want to extract a pose from a photo, you can use the template "{{ui:workflows.templates.poseControl.title}}" in [Workflows](06-upscaling-workflows.md).

## Regional guidance

A **{{ui:canvas.add.regional}}** layer gives a prompt for the place you paint on it. Paint the region, then add a positive prompt (what to draw there) or a negative prompt (what to keep out of it) in the layer's settings. The prompt of the whole picture still applies everywhere; the layer's prompts apply inside its region on top of it. With **auto negative** on, the layer's positive prompt is also kept out of the rest of the picture, so a "red hat" stays in its place.

- A layer that has no paint inside the generation area, or no prompt, says nothing and is left out.
- At most 8 layers can be used at once. Hidden layers are not used.
- Regional guidance works with SD1.X and SDXL models. With the newer families (Flux, Qwen-Image and the like), generation fails and says so; hide the layers.
- The reference images added to a regional layer are not used yet.

## Saving and cleaning up

- To save the canvas picture to the gallery, press **{{ui:canvas.toolbar.saveToGallery}}** (the disk icon) on the bar at the top. The visible raster layers inside the generation area are merged and saved as one picture.
- To save the canvas as a PSD file that keeps its layers, press **{{ui:canvas.toolbar.savePsd}}** (the document with a down arrow icon). The generation area is saved as a browser download. Each raster layer becomes a layer of the PSD, keeping its name, position, opacity and visibility. Control layers go in as hidden layers; inpaint masks and regional guidance are left out.
- To save just one layer, right-click the layer and choose **{{ui:canvas.entityMenu.saveToGallery}}**.
- **{{ui:canvas.settings.title}}** also has **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** and **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** deletes all the layers.

There are also features for fixing pictures in [Fixing and Reusing Pictures](04-improve.md). The result of "{{ui:gallery.menu.segment}}" can be sent to the canvas and repainted further.
