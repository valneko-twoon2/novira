# The Gallery and the Viewer

The pictures you make are lined up in the **gallery** on the right side of the screen. A picture you choose in the gallery can be seen large in the **{{ui:app.views.viewer}}** in the center.
This chapter explains how to organize pictures, how to find them, how to look at them in the viewer, how to recall their settings, and how to delete and download them.

## Reading the gallery

The right panel is made of two parts, one above the other.

- Top: **{{ui:gallery.boards.title}}**. They are something like folders for keeping pictures.
- Bottom: Thumbnails of the pictures on the selected board.

The row above the thumbnails has the following.

- A switch between "{{ui:gallery.view.images}}" and "{{ui:gallery.view.assets}}", and the number of pictures.
- The magnifying glass button: search ({{ui:gallery.search.label}})
- The calendar button: {{ui:gallery.date.button}}
- The gear button: {{ui:gallery.settings.title}}
- The upward arrow button: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** holds the pictures made in novira (including video and audio).
**{{ui:gallery.view.assets}}** holds images you uploaded and things such as logos that are treated as "material separate from your works". If a picture seems to be missing, look at the other one.

You can change the size of the thumbnails with the slider on the gear button.
Thumbnails for video and audio carry a play mark, and if you hover over one and move the cursor sideways, you can check the scene at that position.

## Boards

A board is a container for dividing up and organizing pictures. "{{ui:gallery.boards.uncategorized}}" is a board that is there from the start, and it holds the pictures that are not on any board.

- **Create**: Press the **＋** ({{ui:gallery.boards.add}}) at the upper right of the boards area. You can type the name right there.
- **Switch**: Click a board. Only the pictures on that board are lined up below.
- **Rename**: Double-click the name of a board, or choose "{{ui:common.rename}}" from the right-click menu.
- **Search**: The magnifying glass in the boards area searches board names.
- **Collapse**: Click the "{{ui:gallery.boards.title}}" heading. Drag the bottom edge of the boards area to change its height.

### Which board a new picture goes to

A newly made picture (and also an uploaded one) goes to the board marked "**{{ui:gallery.boards.autoBadge}}**".
At first, every time you click a board, that board becomes "{{ui:gallery.boards.autoBadge}}". If you want to pin it, turn off "{{ui:gallery.settings.autoAssign}}" in the gallery settings and choose it with "{{ui:gallery.boards.setAutoAdd}}" in the board's right-click menu.

### The right-click menu of a board

- **{{ui:gallery.boards.setAutoAdd}}**: Makes it the place where new pictures are saved.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: Hides the board from the list. It is not deleted; if you turn on "{{ui:gallery.settings.showArchived}}" in the gallery settings, you can see it again. "{{ui:gallery.boards.unarchive}}" puts it back.
- **{{ui:gallery.boards.delete}}**: A confirmation window appears, and you choose one of the following.
  - "{{ui:gallery.boards.deleteBoardOnly}}": The pictures stay and move to "{{ui:gallery.boards.uncategorized}}".
  - "{{ui:gallery.boards.deleteBoardAndImages}}": The pictures in the board are deleted too.

> "{{ui:gallery.boards.uncategorized}}" cannot be renamed, archived or deleted.

## Choosing pictures

You can choose thumbnails as follows.

| Action | Result |
|---|---|
| Click | Chooses that one picture. The picture shown in the viewer also changes to it |
| Click while holding `Ctrl` | Adds it to the chosen pictures, or removes it from the choice (multiple selection) |
| Click while holding `Shift` | Chooses everything from the previously chosen picture to the one you clicked |
| Click while holding `Alt` | Compares it with the picture in the viewer (described below) |
| Double-click | Switches the center to the viewer and shows that picture large |
| `Ctrl+A` | Chooses all the pictures lined up now |
| Arrow keys | Move the choice to the previous, next, upper or lower picture. Hold `Shift` to extend the range |
| `Esc` | Clears the choice |

> The arrow keys and the like work when the cursor is over the gallery or when the center is the viewer.

Chosen pictures get a blue frame. When you hover over a thumbnail, the following appear.

- The size of the picture (you can also show it all the time with "{{ui:gallery.settings.alwaysShowSize}}" in the gallery settings)
- The star button (adds or removes a star)
- The trash can button (delete)

A picture with a star gets a yellow star mark at its upper left.

## Right-clicking a thumbnail

![The right-click menu of a thumbnail, listing Open in viewer, Download, Remix, Send to canvas and more](shot:gallery-menu)

When you right-click a thumbnail, a list of the operations available for that picture appears. Operations you cannot use are grayed out (for example, "{{ui:gallery.menu.remix}}" cannot be used on a picture that has no recorded settings).

| Menu item | What it does |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | Shows it large in the viewer in the center |
| **{{ui:common.download}}** | Saves the picture file |
| **{{ui:share.menu}}** | Exports copies in a format and size you choose (the generation info can be removed) |
| **{{ui:share.check.title}}** | Checks a picture for a watermark, the AI-generated label and Content Credentials |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copies the picture to the clipboard |
| **{{ui:gallery.menu.compare}}** (`Alt+click`) | Compares it with the picture shown in the viewer |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Opens the workflow that made the picture |
| **{{ui:gallery.menu.remix}}** (`R`) | Loads all the settings except the seed into the left panel |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Loads only the prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Loads only the seed (the seed becomes fixed) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Loads all the settings |
| **{{ui:gallery.menu.useSize}}** | Loads only the width and height |
| **{{ui:gallery.menu.sendToCanvas}}** | Places it on the canvas. You can choose between making a new canvas and adding it to the current canvas as a layer or a mask |
| **{{ui:gallery.menu.useAsReference}}** | Adds it to a reference image frame |
| **{{ui:gallery.menu.sendToVideo}}** | Makes it the first picture of a video |
| **{{ui:gallery.menu.sendToWorkflow}}** | Adds it to the open workflow as an image input |
| **{{ui:gallery.menu.sendToText}}** | Makes it the background of a text image |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | Sends it to the Upscaling tab |
| **{{ui:gallery.menu.segment}}** | Selects a part of the picture so you can cut it out or repaint it |
| **{{ui:gallery.derive.menu}}** | Makes other pictures with this picture's settings, using a different seed or slight changes |
| **{{ui:cutout.menu}}** | Removes the background |
| **{{ui:facefix.menu}}** | Finds faces and redraws them |
| **{{ui:gallery.menu.trim}}** | Trims the transparent margins and saves the result as a new transparent image |
| **{{ui:character.menu}}** | Registers the picture as a character |
| **{{ui:gallery.menu.changeBoard}}** | Moves it to another board |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Adds or removes a star |
| **{{ui:gallery.menu.delete}}** (`Del`) | Deletes the picture |

How to use "{{ui:gallery.menu.sendToCanvas}}" and the operations for remaking or improving a picture are explained in [Drawing More on the Canvas](05-canvas.md), [Fixing and Reusing Pictures](04-improve.md), [Upscaling and Workflows](06-upscaling-workflows.md) and [Video, Music, Voice, Logos and Text](07-media.md).

> Only when you are using it in a computer's web browser does "{{ui:gallery.menu.openInNewTab}}" also appear. It does not appear in the desktop version.

## Working on several pictures at once

![The menu when two pictures are chosen and right-clicked](shot:gallery-multi-menu)

If you choose two or more pictures and then right-click one of the chosen pictures, a menu for working on them together appears. At its top, the number chosen is shown, such as "2 images selected".

- **{{ui:gallery.menu.changeBoard}}**: Moves the chosen pictures to another board all at once.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: Saves the chosen pictures one after another.
- **{{ui:share.menu}}**: Exports copies of the chosen pictures for sharing (videos and sounds are left out).
- **{{ui:gallery.menu.batch}}**: Applies the same processing (background removal, enlarging and so on) to all the chosen pictures. Each picture goes into the queue separately.
- The red item at the very bottom: Deletes the chosen pictures all at once.

> If you right-click a picture that is not chosen, the menu for that one picture appears. To act on several pictures, choose them first and then right-click on one of the chosen pictures.

## Finding, filtering and sorting

### Search

Press the magnifying glass button to open the search field. Enter a file name or part of the positive prompt and the pictures on that board are narrowed down. Press `Esc` to close the search and clear the filter.

### Filtering by date

![The menu for filtering by date, with buttons such as Today and Yesterday and a monthly calendar](shot:gallery-date)

Press the calendar button to open the menu for filtering by date.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: Set the period with a single button.
- The monthly calendar: Days that have pictures are marked. Click a date and only that day's pictures are lined up. Use the arrows at the top to move between months.
- **{{ui:gallery.date.custom}}**: Enter a start date and an end date and press **{{ui:gallery.date.apply}}** to line up only the pictures in that period. You can also use just one of the two.
- **{{ui:gallery.date.quick.all}}**: Stops filtering.

While a filter is active, a tag showing the period appears above the gallery. You can also clear it with the × on the tag.

### Gallery settings

The gear button lets you change how pictures are arranged and how things look.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: When a picture is finished, it is shown automatically.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: Lines up pictures with a star at the very top (this is on by default).
- {{ui:gallery.settings.sort}}: "{{ui:gallery.settings.sortNewest}}" or "{{ui:gallery.settings.sortOldest}}".
- {{ui:gallery.settings.groupByDate}}: Separates pictures with a heading for each day.

## Looking in the viewer

![The viewer, with the toolbar at the top, the picture in the center, the zoom buttons at the lower right and the picture's information at the bottom](shot:viewer)

The "{{ui:app.views.viewer}}" in the center shows the chosen picture large.
You can move to the previous and next pictures with the arrows at the left and right of the screen. The bottom row shows the picture's size, the model used, the seed and the file name. Video and audio can be played right there.

### Zooming and moving

- Mouse wheel: Zooms in and out around the position of the cursor.
- Drag: Moves the picture when it is zoomed in and extends beyond the edge of the view. You can also move it while holding `Space` or while pressing the wheel button.
- Double-click: Switches between showing the whole picture and actual size (100%).
- Buttons at the lower right: zoom out, the zoom level (press it for a list of commonly used levels), zoom in, `1:1` (actual size), and fit to screen.
- Keys: `+` and `-` zoom one step at a time, `Ctrl+0` fits to the screen, and `Ctrl+1` shows actual size.

### Toolbar

The toolbar above the picture lines up the operations for that picture. Hover over a button to see its name and shortcut.

| Group | Buttons |
|---|---|
| Information | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Load settings | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Send and improve | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:gallery.manga.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organize | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

They do the same things as the items with the same names in the thumbnail's right-click menu. For a picture with no settings (such as an uploaded image), the buttons for loading settings are grayed out.

## Picture information and recalling settings

![The metadata panel, with a list of prompt, model, seed, steps and so on](shot:viewer-metadata)

Press the **{{ui:gallery.viewer.toggleMetadata}}** button (`I`) on the toolbar and a panel of information opens over the picture. Press it again, press the × at the upper right, or press anywhere outside the panel to close it. You can select the text in the panel by dragging and copy it with `Ctrl+C` (while text is selected, `Ctrl+C` copies the text, not the picture).
The panel has four tabs.

- **{{ui:gallery.meta.tabRecall}}**: The settings used when the picture was made are listed item by item (prompt, model, seed, steps, CFG scale, scheduler, size, LoRA and so on). The arrow button at the right of each row loads **just that item** into the left panel. On the prompt rows, the button left of the arrow copies the prompt as it is. A picture of a model whose family fixes the scheduler (Anima, Flux and so on) shows a "{{ui:gallery.meta.sampling}}" row in place of the scheduler, with the sampler and scheduler that actually ran. That row loads nothing, and "{{ui:gallery.menu.useAll}}" keeps your current scheduler.
- **{{ui:gallery.meta.tabMetadata}}**: Shows the recorded contents as they are. You can copy them with the button at the upper right.
- **{{ui:gallery.meta.tabDetails}}**: The file name, size, date and time it was made, the board, whether it has a star, and so on.
- **{{ui:gallery.meta.tabWorkflow}}**: For a picture made with a workflow, its contents are shown.

You choose how to load settings depending on how much of them you want.

| Method | What it loads |
|---|---|
| **{{ui:gallery.menu.useAll}}** | All of the settings, such as the prompt, model, seed and size. The seed becomes fixed. For a picture made in other software and imported, the model is looked up by its name (small differences in writing, such as `v17` and `v170`, count as the same model). When none is found, the current model stays, and the notification says so |
| **{{ui:gallery.menu.remix}}** | Everything except the seed. The current seed setting (random or fixed) stays as it is. Use it when you want to "make a different picture with the same settings" |
| **{{ui:gallery.menu.usePrompt}}** | Only the prompt (positive and negative) |
| **{{ui:gallery.menu.useSeed}}** | Only the seed. The seed becomes fixed |
| **{{ui:gallery.menu.useSize}}** | Only the width and height (right-click menu only) |

After loading, just look at the left panel and press **{{ui:params.invoke.invoke}}**.

> The image file (PNG) of a picture made in novira has its settings recorded along with it. Because of this, you can sometimes load the settings even from a picture that you moved to another place and uploaded again. Images made with other software, and images that were edited and saved again, do not contain settings.

## Comparing two pictures

![The viewer comparing two pictures with the slider. You move the vertical line in the middle left and right](shot:viewer-compare)

When you want to see the difference between two pictures, use compare.

1. Click the first picture you want to compare to choose it, and make sure the center is on the "{{ui:app.views.viewer}}" tab.
2. Click the thumbnail of the second picture while holding `Alt` (you can also do it with "{{ui:gallery.menu.compare}}" in the right-click menu).
3. A "{{ui:gallery.compare.badge}}" tag appears on the second thumbnail, and the viewer changes to the compare screen.

> You can also start by choosing two pictures while holding `Ctrl` and then pressing the compare button on the toolbar or the `C` key. If you have chosen only one, the guidance "{{ui:gallery.compare.hint}}" appears.

The following buttons appear at the top of the compare screen.

- **{{ui:gallery.compare.slider}}**: The two pictures are overlaid, and if you drag the vertical line in the middle, you can see how they differ on the left and right.
- **{{ui:gallery.compare.sideBySide}}**: Lines up the two pictures left and right.
- **{{ui:gallery.compare.hover}}**: Switches to the second picture only while the cursor is over the picture.
- **{{ui:gallery.compare.swap}}**: Swaps the first and second pictures.
- **{{ui:gallery.compare.exit}}**: Stops comparing. You can also stop with `Esc`.

Zooming and moving work in step on the two pictures. Differences in fine details are easier to see when you zoom in.

## Stars and deleting

### Adding a star

You can put a star on pictures you like. You can add or remove a star with the star button on the thumbnail, from the right-click menu or from the viewer toolbar.
When "{{ui:gallery.settings.starredFirst}}" is on in the gallery settings, pictures with a star gather at the front.

### Deleting

You can delete a picture in the following ways.

- The trash can button on the thumbnail
- "{{ui:gallery.menu.delete}}" in the right-click menu
- The trash can button on the viewer toolbar
- Choose the picture and press the `Delete` key (`Backspace` does the same)

A confirmation window appears, and pressing "{{ui:common.delete}}" deletes it.

> A deleted picture cannot be restored. There is no place like a recycle bin.

If you check "{{ui:common.dontAskAgain}}" in the confirmation window, pictures are deleted without confirmation from then on. To get the confirmation back, turn on "{{ui:settings.confirmOnDelete}}" in **{{ui:app.nav.settings}}**.

## Uploading and downloading

### Uploading

You can bring images from your computer into the gallery.

- Press the **{{ui:gallery.upload}}** button above the gallery and choose files.
- Drag and drop image files from File Explorer onto the gallery. If you drop them onto a board, they go into that board.

Uploaded images go into **{{ui:gallery.view.assets}}** of the "{{ui:gallery.boards.autoBadge}}" board, and the screen switches there too. You can put in several files at once. Files that are not images are ignored.

### Downloading

To save a picture's file, use the right-click menu or **{{ui:common.download}}** on the viewer toolbar. If you have chosen several pictures, they are saved together.

### Exporting for sharing

![The Export for sharing window: format (PNG, JPEG, WebP), quality, longest side and the switch that removes the generation info](shot:share-export)

To make copies of pictures for social media or for other people, use **{{ui:share.menu}}** in the right-click menu (it also works with several pictures chosen) or on the viewer toolbar. The originals do not change.

- **{{ui:share.format}}**: PNG, JPEG or WebP. For JPEG you can set the **{{ui:share.quality}}** (1 to 100), and transparent parts become white. WebP is saved without loss.
- **{{ui:share.size}}**: "{{ui:share.size.original}}", 2048, 1536 or 1024 px, or "{{ui:share.size.custom}}" to type a length. Pictures smaller than that are not enlarged.
- **{{ui:share.removeInfo}}**: Off at first. When it is on, the prompt, settings and workflow are left out, and the picture is saved again from its pixels, so no other embedded data remains either. When it is off, only PNG keeps the settings. Turn it on before you hand a picture to others if you do not want to show the prompt.
- **{{ui:share.watermark}}**: Off at first. When it is on, the exported pictures get an invisible watermark (TrustMark), the label that marks media made with AI (IPTC) and signed Content Credentials (C2PA). The watermark carries novira's mark and a random number that differs for each picture, and the app records which picture each number came from.

Press **{{ui:share.run}}**; in the desktop app a window opens to choose the folder. Each file gets the gallery file name with the new extension; if a file with that name exists, a number such as "-2" or "-3" is added, and nothing is overwritten. Afterwards, **{{ui:share.openFolder}}** opens that folder.

> Only pictures are exported; videos and sounds among the chosen items are left out. In a browser, the files go to the browser's downloads: one picture as it is, two or more in one zip. One export carries up to 1 GB in all; above that, you are asked to choose fewer pictures.

The files the watermark needs (about 140 MB in all) are downloaded automatically when the app starts. Until they are ready, the progress shows under the switch and **{{ui:share.run}}** cannot be pressed. If the download fails, press **{{ui:share.watermarkRetry}}**.

> The watermark sits in the centered square of the picture. It has been checked to survive saving again as JPEG at quality 80 and halving the size, but cropping, regenerating or heavy edits can remove it. The scheme is public, so anyone can write the same mark. The signature is made on this PC, so other apps show the signer as untrusted. The watermark needs the Microsoft Visual C++ Redistributable; without it, an error is shown.

### Checking for a watermark

Open it with **{{ui:share.check.title}}** in a thumbnail's right-click menu. Choose a picture file (PNG, JPEG or WebP) with **{{ui:share.check.pick}}**, and the window lists what it found. When you open it from the right-click menu, that picture is checked right away. In a browser, a file cannot be chosen for checking.

- **{{ui:share.check.watermark}}**: whether novira's watermark is there, with its number.
- **{{ui:share.check.original}}**: if the number is in this app's export records, the original picture and when it was exported; **{{ui:share.check.showOriginal}}** shows it in the viewer.
- **{{ui:share.check.credentials}}**: whether Content Credentials are there, whether the file changed after signing, whether they record the picture as AI-generated, and who signed them.
- **{{ui:share.check.iptc}}**: whether the label that marks media made with AI is there.

> Finding no watermark does not prove that a picture was not made with AI. The export records live in this app's database, so the original of a picture exported by novira on another PC is not known. While the watermark's files are not ready, only the other items are checked.

## Drag and drop

You can drag thumbnails to other places and use them there. When several are chosen, the chosen pictures move together.

- **Onto a board**: Moves the picture to that board.
- **Onto a {{ui:params.refImage.sectionLabel}} frame**: Makes it a reference image (see [Making Images](02-generate.md)).
- **Onto the image field of the canvas or of Upscaling, or onto a card on the start screen**: Uses it as material for that screen.

Files from File Explorer can be dropped onto the gallery, onto a board, onto a reference image frame, onto a card on the start screen and so on.

## Gallery keyboard shortcuts

| Action | Key |
|---|---|
| Choose the previous, next, upper or lower picture | Arrow keys (`Shift` extends the range) |
| Choose all | `Ctrl+A` |
| Clear the choice | `Esc` |
| Delete the chosen pictures | `Delete` |
| Copy the picture in the viewer | `Ctrl+C` |
| Open and close the information panel | `I` |
| Remix, prompt, seed, all | `R`, `P`, `S`, `A` |
| Load the workflow | `W` |
| Send to Upscaling | `Shift+U` |
| Start and stop compare | `C` |
| Fit to screen, actual size | `Ctrl+0`, `Ctrl+1` |
| Zoom in, zoom out | `+`, `-` |

These work when the cursor is over the gallery or when the center is the viewer. You can also see the list under "{{ui:app.nav.hotkeys}}" in the **{{ui:app.nav.settings}}** menu.
