# Comic

![The whole Comic tab. On the left, the same settings as the Generate tab. In the center, an empty comic page](shot:comic)

**{{ui:app.tabs.comic}}** is a workbench for making comic pages. Open it with the last icon (the book) of the row of icons at the very top of the left panel of the **{{ui:app.tabs.generate}}** tab (the key `1` opens whichever of the two you used last). You keep comics in projects. A project holds pages, each page is divided into panels, and you draw a picture for each panel. Besides the pictures you draw, a panel can take a gallery picture or a pose. Add balloons and captions, and you can save the page as one picture.

The screen is divided into three parts.

- Left: at the very top, the row of icons for image, video and so on (the last one is {{ui:app.tabs.comic}}); below it, from the top, the {{ui:presets.label}} and {{ui:params.seed.label}}, the same as on the {{ui:app.tabs.generate}} tab, then the draw button, the comic list and the {{ui:params.model.label}}. The draw button is where the Generate button is on the other screens, and the arrow menu beside it chooses whether it draws the selected panel only or every panel of the page. Below them is the **{{ui:params.prompt.title}}** section, which holds the prompt of the selected panel. Further down are the reference image section (the same as on the {{ui:app.tabs.generate}} tab, and used for every panel of the comic) and the detailed generation settings. Click the heading of a setting to open or close its section.
- Center: the {{ui:app.views.comic}}. The tool row above it holds the page settings, the templates, the tool for cutting panels, the panel tools (balloons and captions, pose, panel templates), the picture tools, the trash can button that deletes what is selected, and the button that makes the page into an image. Below the page are undo and redo, a small drawing of each page, and the zoom.
- Right: two tabs, **{{ui:comic.side.assistant}}** and **{{ui:comic.side.gallery}}**. Pictures drawn in panels also go into the gallery.

## Making a comic

![The comic list at the top left. A thumbnail of page 1, with the name of the comic and its page count](shot:comic-project)

1. Open the comic list at the top left, press **{{ui:comic.project.new}}** at the very bottom, and give it a name. When there is no comic yet, you can also make one with **{{ui:comic.project.new}}** in the center.
2. A new page starts with 3 panels. To add a page, press **{{ui:comic.page.add}}** below the page.
3. Click the panel you want to draw on the page to select it. On the left, in the **{{ui:params.prompt.title}}** section, write a description of its picture, and press **{{ui:comic.panel.draw}}**.
4. To draw all the panels of the page in order, press the arrow beside the draw button, choose **{{ui:comic.page.drawAll}}**, and press the draw button. The panels that have a prompt are drawn in order.
5. To draw every page of the comic, choose **{{ui:comic.comic.drawAll}}** in the same menu and press the draw button. The panels of all the pages that have a prompt are queued in reading order.

The comic list shows a thumbnail of page 1 of each comic, and its page count. Select a comic in the list to open it. To rename or delete a comic, use the menu at the right of its row.

To make a picture, a model must be selected. A panel with an empty prompt cannot be drawn. Prompts work better when written as English tags. A drawn picture goes into its panel, and also into the gallery. A panel that could not be drawn shows **{{ui:comic.draw.failed}}** on the page.

## Panel prompts

On the comic tab, the **{{ui:params.prompt.title}}** section on the left holds the prompt of the selected panel. When you select another panel, the text in the fields changes to that panel's. Each panel has its own pair of **{{ui:params.prompt.positive}}** and **{{ui:params.prompt.negative}}** prompts. When no panel is selected, the fields keep the prompts of the panel selected last (or of the first panel of the page, when none has been selected yet), and the draw button draws that panel.

The fields work the same as on the {{ui:app.tabs.generate}} tab. Loading a {{ui:presets.label}} puts the preset's prompts into the selected panel. The words of the **{{ui:params.promptBook.title}}** also go into the selected panel. When you go back to the {{ui:app.tabs.generate}} tab, the prompts you had written on the {{ui:app.tabs.generate}} tab come back as they were.

A panel's picture is drawn with that panel's prompts only. The prompts of other panels and of the {{ui:app.tabs.generate}} tab are not added.

The dynamic prompt syntax (combination brackets and wildcards) also works. With **{{ui:params.prompt.modeRandom}}**, the picture's seed picks the combination and one picture is drawn. With **{{ui:params.prompt.modeCombinatorial}}**, the combinations are drawn one at a time. The first combination goes into the panel, and the pictures of the other combinations go into the gallery only (not into the panel). When there are several combinations, a notice says so.

## Page settings

Press **{{ui:comic.page.settings}}** at the top of the center to open the page settings.

The number of panels on a page is set from 1 to 24 in the **{{ui:comic.page.panelCount}}** field. When you change the number, the layout of the page is redone automatically. A page whose panel shapes were changed by hand also goes back to the automatic layout when the number changes.

The number of columns on a page can be chosen from 1 to 3 with **{{ui:comic.page.columns}}**. With **{{ui:comic.page.direction}}** you choose the direction in which the panels are read. Manga is normally read right to left, so a new page starts in the "Right to left (manga)" direction. When you change the direction, the order of the panels is reversed from left to right.

When you reduce the number of panels, the last panels are removed. The pictures of removed panels stay in the gallery.

**{{ui:comic.effect.comic}}** and **{{ui:comic.effect.page}}** put a finishing effect over the whole page: **{{ui:comic.effect.mono}}**, **{{ui:comic.effect.ebook}}** (grayed, with the tone of paper) or **{{ui:comic.effect.sepia}}**. You need not ask for black and white when drawing; the same effect can be put over every page afterwards, and a page may be given a different one. The pictures themselves do not change; the effect applies to how the page is shown and to the saved picture, PDF, CBZ and PSD.

The paper size can be chosen from A4, A5, B4 and B5 with **{{ui:comic.page.size}}**. The width-to-height ratio of the page is the same as that of the paper. The page picture that is saved is the paper drawn at 200 dpi (A4 is about 1654 × 2339 px).

**{{ui:comic.page.frameWidth}}** sets how thick the frame lines of the panels are, from 0 mm to 3 mm (0.6 mm at first). **{{ui:comic.page.inset}}** sets the space between a frame line and the picture, from 0 mm to 10 mm (0 mm at first, so the picture fits right against the line). **{{ui:comic.page.margin}}** adds a white margin outside the frame line, from 0 mm to 10 mm (0 mm at first, so no white edge is drawn). **{{ui:comic.page.frameColor}}** chooses the color of the frame lines (black at first). All of them apply to every panel of the page, and the saved page picture is drawn with the same thickness, space and color.

## Switching pages and zooming

A small drawing of each page is lined up in the middle below the page. Each drawing shows the panels and pictures of its page, with the page number at its bottom right. Press a drawing to switch to that page. The drawing of the page that is open now is framed. In a comic read from the right (its first page reads from the right), page 1 is at the right end, as in a printed manga, and later pages lie further left (the left arrow goes on to the later pages). As many pages are shown at once as fit (ten at most). For the pages that do not fit, press the left and right arrows (**{{ui:comic.page.prevGroup}}** and **{{ui:comic.page.nextGroup}}**) to show the drawings of the pages before or after. Showing other drawings with the arrows does not change the open page. **{{ui:comic.page.add}}** adds a page, and the trash can button deletes the page that is open now (press it again to confirm).

The display size of the page can be changed with the **{{ui:common.zoomIn}}** and **{{ui:common.zoomOut}}** buttons at the bottom right of the page. You can also zoom in and out around the pointer by turning the mouse wheel while holding Ctrl. Press the zoom percentage to go back to 100%.

## Templates

![The list of page templates. The layouts are shown as small pictures](shot:comic-templates)

Press **{{ui:comic.template.pageTitle}}** at the top of the center to open the list of page templates. Every template is shown as a small picture of its layout. Press a picture to apply that template to the page that is open now.

The list shows the built-in layouts ({{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}} and {{ui:comic.template.builtin.nine}}, five in all), the shape templates (ten in all, with slanted cuts and combinations of large and small panels) and the templates you saved. A built-in layout is applied with the reading direction and paper size of this page. A shape template is applied with the reading direction of this page, so its panels are flipped to match it. A saved template takes the reading direction and paper size it had when it was saved. When the panel count goes down, the label under the picture changes to **{{ui:comic.template.applyAgain}}**. Press it again to apply, and the pictures and balloons of the last panels are removed.

To save the layout of this page, enter a name below the list and press **{{ui:comic.template.savePage}}**. If the name is left empty, the template is named "Template" followed by a number. Templates are saved inside this project.

A panel template saves the prompt, negative prompt, pose and balloons of the selected panel. It does not save the picture. In the section opened by pressing **{{ui:comic.template.panelTitle}}** at the top center, give it a name and press **{{ui:comic.template.save}}**. On another panel, press **{{ui:comic.template.apply}}** on the row of the saved template, and it is put into that panel. What goes in is the prompt, negative prompt, pose and balloons. The picture of that panel stays.

## Changing the shape of panels

![A page whose panels were reshaped: the top panel is cut on a slant, and the corners of the selected panel show as dots](shot:comic-shapes)

The shapes of panels can be changed by hand, even when the page has the automatic layout. Press **{{ui:comic.shape.cut}}** at the top of the center, then draw a line across a panel from one edge to another, and the panel is cut in two. A line that does not cut the panel in two (a line outside the panel, or one that only touches a corner) cuts nothing.

To add a panel, press **{{ui:comic.shape.addPanel}}** next to **{{ui:comic.shape.cut}}**. The panels already there stay as they are, and the new panel is laid over the middle of the page and selected. The page then becomes one where panels are placed freely (see "Placing panels freely" below). Panels cannot be added when the page already has 24.

To remove a panel, select it and press the trash can button at the top of the center (**{{ui:comic.shape.removePanel}}**), or press the Delete key. Its picture, prompts and balloons go with it. On an automatic layout the remaining panels are laid out again. On a page whose panel shapes were changed by hand, the nearest neighbouring panel grows into the freed space and keeps its own content; if the shape allows no such joining, the page returns to the automatic layout. The last panel of a page cannot be deleted. A deleted panel can be brought back with Ctrl+Z (putting a picture into a panel again is not undone).

To deselect the panel, click the margin of the page, any empty place around the page, or an empty part of the tool row. The Esc key also deselects it. On a page with a picture over the whole page, clicking the page outside the panels selects that picture instead (see "Putting a picture over the whole page").

The selected panel shows its corners as round dots. Drag a corner to change the panel's shape. A corner shared with a neighbouring panel moves with it. Double-click an edge to add a corner, and double-click a straight corner to remove it. A corner does not move to a place where panels would overlap or where an edge would cross another edge.

The selected panel shows a small bar (an edge handle) in the middle of each edge. Drag a handle to move that whole edge; the neighbouring panels change shape with it. An edge does not move outside the page margin.

On a page whose shapes were changed by hand, press **{{ui:comic.shape.reset}}** in **{{ui:comic.page.settings}}** to go back to the automatic layout. Changing the number of panels or the number of columns also goes back to the automatic layout. Ctrl+Z takes a change of shape back.

## Placing panels freely

On any page, drag a panel anywhere on it to move it wherever you like (whatever its shape, it moves from where you press). Pressing a panel without moving it only selects it. Once a panel has been moved, the page becomes one where panels are placed freely. Each panel then has a shape of its own and shares no edge with its neighbour. Panels may lie over each other or leave gaps. How the page looked before (the places of the panels and the white gaps between them) stays as it was.

A panel may run partly off the page; what is outside is cut off, but the middle of the panel stays on the page. Over a panel the cursor is the move cursor, over a corner a cross, and over an edge an arrow that matches the way the edge slides. Dragging inside a panel always moves the panel. To move only its picture, drag with the Alt key held, or double-click the picture to select it and drag the part that sticks out of the panel. Drag the round handle above the selected panel (**{{ui:comic.free.rotate}}**) and the panel turns to any angle; with the Shift key held, it turns in steps of 15 degrees. On a page with panels placed freely, the corners and edges of a panel move that panel alone. Adding a panel puts a rectangular one in the middle of the page. Deleting a panel does not let a neighbour grow into its space. **{{ui:comic.shape.cut}}** works too, and the panels around the cut one stay as they are.

What turns is the panel's frame: the picture stays upright and is cut by the frame. The angle of the picture can be changed separately with the picture tools. To put the page back to the automatic layout, press **{{ui:comic.shape.reset}}** in **{{ui:comic.page.settings}}** (undo brings the free page back).

When panels overlap, a later panel lies in front. Select a panel and press **{{ui:comic.order.front}}**, **{{ui:comic.order.forward}}**, **{{ui:comic.order.backward}}** or **{{ui:comic.order.back}}** to change the order they stack in. The order is also the panels' numbers (the reading order), so changing it renumbers them.

After turning, resizing or moving a panel or its picture, press **{{ui:comic.reset.title}}** at the top of the center to put it back. You can put back one thing at a time (the panel's turn, the panel's shape and size, the picture's turn, size, place or mirroring) or everything with **{{ui:comic.reset.all}}**. Putting back a panel's shape and size gives it the shape it has in the automatic layout. Putting back a picture is not an undo step.

## The picture of a panel

![A picture placed in a panel. Around the shrunk and turned picture are handles at the four corners and at the top](shot:comic-image)

A panel's picture does not have to be one you drew. Drag a gallery picture onto a panel, and that picture becomes the panel's picture. Select a panel and press **{{ui:comic.panel.imageUpload}}** at the top of the center to choose an image file on your computer. The file goes into the gallery first and then becomes the panel's picture.

You move a panel's picture directly on the page, as on the {{ui:app.tabs.canvas}}.

- Pressing and dragging the picture moves the whole panel. To move only the picture, drag it with the Alt key held. Part of the picture can also go outside the panel.
- Double-click the picture, or press it with the Alt key held, to select it; a dotted frame and handles appear around it. The part that sticks out of the panel is also shown faintly.
- Turn the mouse wheel with the Alt key held to enlarge or shrink the picture of the panel under the pointer, around the pointer.
- Drag a corner handle to enlarge or shrink the picture around its center.
- Drag the round handle at the top to turn the picture. Hold Shift while turning to turn it in 15° steps.
- The selected picture moves a little with the arrow keys (hold Shift to move it further).
- If a picture has been moved out of its panel, drag the dotted frame of the selected picture to move it.

The tools at the top of the center also change the picture. **{{ui:comic.image.fitCover}}** removes any rotation and spreads the picture over the whole panel. **{{ui:comic.image.fitContain}}** sizes the picture so that all of it fits in the panel. **{{ui:comic.image.rotateLeft}}** and **{{ui:comic.image.rotateRight}}** turn it by 90°, and **{{ui:comic.image.flipX}}** and **{{ui:comic.image.flipY}}** flip it. **{{ui:comic.image.scaleDown}}** and **{{ui:comic.image.scaleUp}}** shrink and enlarge it a little at a time, and **{{ui:comic.image.center}}** moves the center of the picture to the center of the panel.

To remove the picture from a panel, select the picture and press the Delete key, or press the trash can button at the top of the center (**{{ui:comic.panel.imageClear}}** while a picture is selected). There is one trash can button, and it deletes what is selected (a balloon, a picture, the picture over the whole page, or a panel). Hold the pointer over the button to see what it deletes. Even after you remove it, the picture stays in the gallery. Press **{{ui:comic.history.undo}}** in the notice that appears right after you remove it, and the picture comes back with its position and size. When you put in a different picture, the position and size return to their defaults.

A panel keeps its earlier pictures. When you draw a panel again, put in another picture or remove its picture, the picture it had goes into the panel's **{{ui:comic.takes.title}}** (up to 12, newest first). Select the panel and press **{{ui:comic.takes.title}}** at the top of the center: the picture the panel has now and the earlier ones appear. Press an earlier picture to put it back in the panel with the position and size it had (the picture there now goes into the history). **{{ui:comic.takes.remove}}** takes a picture off the list; it stays in the gallery. A picture you deleted from the gallery is not shown. Undo does not change the history, as it does not change the pictures.

You can also draw only a part of a picture again (when a hand or a face came out wrong, for example). Select a panel with a picture and press **{{ui:comic.fix.start}}** (the brush button) at the top of the center: a thin bar appears above the page. Paint over the part to redraw on the panel. In the bar you can change the **{{ui:comic.fix.brush}}**, and take back too much paint with **{{ui:comic.fix.undoStroke}}** or **{{ui:comic.fix.clear}}**. In **{{ui:comic.fix.words}}**, write in English what to draw there (left empty, the panel prompt is used). The lower **{{ui:comic.fix.strength}}** is, the closer the part stays to the picture. Press **{{ui:comic.fix.go}}**: only the painted part is drawn again, and the rest of the picture stays as it was. The new picture goes into the panel, and the earlier one stays in the **{{ui:comic.takes.title}}**. The characters' words and reference pictures are used as when the panel is drawn. Selecting another panel clears what you painted.

## Putting a picture over the whole page

Press **{{ui:comic.backdrop.title}}** at the top of the center to put a picture over the whole page. It suits a large picture across the page, or a page of photos and pictures that panels are set on. A gallery picture or an image file can also be dropped on the page outside the panels (on a panel, drop with the Alt key held). Or drop it in that section, or pick a file with **{{ui:comic.panel.imageUpload}}**. The picture goes behind the panels, at the very bottom of the page, and what lies outside the page is cut off. A panel with no picture of its own shows the picture through it. The frames and balloons are drawn over it.

Press **{{ui:comic.backdrop.edit}}** and the picture's frame shows over the page. Drag anywhere on the picture to move it, drag a corner circle to resize it, and drag the circle above it to turn it to any angle (with the Shift key held, in steps of 15 degrees). The panels cannot be worked on meanwhile; press the Esc key or select a panel to finish. The buttons in the same section also fit the picture to the page, show it whole, enlarge and shrink it, bring it back to the center, turn it by 90 degrees, mirror it left-right or up-down, and take it off. The Delete key takes it off too, and **{{ui:comic.history.undo}}** in the notice that follows puts it back. Both the picture of the page and the file of all pages include it.

The picture can be handled on the page as well. Click the page outside the panels (a gap between panels, or the margin of the page), and the picture is selected and its frame shows. While it is selected, press the Delete key or the trash can button at the top of the center (**{{ui:comic.backdrop.clear}}**) to take it off. Dropping a gallery picture or a file on the page while it is selected replaces it. Turn the mouse wheel with the Alt key held outside the panels to enlarge or shrink it around the pointer.

## Setting the pose

![The stick-figure screen for setting the pose of a panel](shot:comic-pose)

Select a panel, press the pose button at the top center to open its section, then press **{{ui:comic.panel.pose}}** to open a screen where you set the pose with a stick figure. The pose is drawn in the shape of that panel, and pressing **{{ui:comic.pose.use}}** makes it the pose of that panel. You can open the pose again to correct it. The pose set on this screen is for one person. To remove it, press **{{ui:comic.panel.poseRemove}}**.

![The pose preset field of a panel. Choose a category and a pose](shot:comic-presets)

In the same section, a pose can also be taken from the same ready-made poses as the canvas. Choose a category with **{{ui:comic.panel.poseCategory}}**, choose a pose with **{{ui:comic.panel.posePreset}}**, and press **{{ui:comic.panel.poseApply}}**. A stick-figure picture is made to fit the size of the panel and becomes the pose of that panel. Depending on the composition, several people may stand side by side. In that case, all of them fit in the panel.

For the pose to be reflected in the picture, a ControlNet model for poses (OpenPose, or a union model) must be installed. A union model is told that the picture is a pose. If it is not installed, the pose is not used in the picture, and a warning to that effect appears.

## Laying a panel out in 3D

Select a panel and press **{{ui:comic.rough.open}}** in the pose box: a 3D view in the shape of the panel opens. There you place people as mannequins of cylinders and boxes, and the set as boxes, boards, cylinders and a floor. You also set the camera's direction, distance and angle of view.

- Drag the background to turn the camera; Shift-drag (or drag with the right button) to slide it; use the wheel to come closer or move back.
- Add things with **{{ui:comic.rough.kind.person}}**, **{{ui:comic.rough.kind.box}}**, **{{ui:comic.rough.kind.plane}}** and **{{ui:comic.rough.kind.cylinder}}** on the right. A board goes to the back, the others to the side. Drag a person or a prop to move it on the floor.
- Change the chosen thing's turn, its height above the floor and its size (width, height and depth; for a person, the size where an adult is 100) on the right. **{{ui:comic.rough.remove}}** takes it away.
- Drag a colored dot of the chosen person to bend that limb. Dragging the neck moves the whole person.
- The small pictures at the bottom right are the pose and the depth the ControlNet will get.

Press **{{ui:comic.rough.apply}}** to make two pictures at the panel's size and put them in the panel. One is the pose as the camera sees it, without the joints something hides, such as the face of a person seen from behind or legs behind a desk. The other is a depth picture, where nearer things are lighter. When the panel is drawn, the depth picture goes to the ControlNet with the pose, so the people and the set come out close to where the rough has them. The depth is applied lightly, over the first half of the steps only: stronger, the mannequins and boxes are drawn as they are.

The depth picture needs a ControlNet model for depth (depth, or a union model). If none is installed, the depth is not used in the picture, and a warning to that effect appears.

If you change the pose afterwards with the pose editor, a ready-made pose or the agent, the depth picture is dropped, because it shows the people where they were. The rough itself stays in the panel. Opened again, it keeps its camera and props and starts from the people of the pose as it is now. Press **{{ui:comic.rough.apply}}** to make the depth picture again.

When the panel's shape changes, because the page's cut or size changed, the depth picture is not used either, and a warning says so: made for the old shape, it would be stretched and move the people and the set. Open the rough and press **{{ui:comic.rough.apply}}** to make it for the shape the panel has now.

## Keeping characters the same

Drawing each panel on its own makes a character's face and clothes drift from panel to panel. To stop that, write the cast. Select a panel, press the **{{ui:comic.cast.title}}** button in the panel tools at the top center, and press **{{ui:comic.cast.add}}**. The characters are listed on top, and the one whose name you press is shown below, one at a time. Give the character a name, and write its look as English tags in the field below: the kind and count, age, hair, eyes and clothes with their colors (for example `1boy, old man, short white hair, flat cap, beige cardigan, blue shirt`). The fields grow with their words, so all of them can be read. Tick the box beside the name of each character that is in the selected panel. When that panel is drawn, their tags are put in front of its prompt as written, so the prompt only needs to say what changes: the shot, the place and the action. A character with no check in a panel is not added to it. Removing a character takes it out of every panel.

Words alone keep the hair and clothes, but not the face. So a character can also have a reference picture. Press **{{ui:comic.cast.refUse}}** to take the picture of the selected panel as the reference, or **{{ui:comic.cast.refClear}}** to let it go. Whether the panels use it through IP-Adapter is set by **{{ui:comic.draw.castReference.use}}** in **{{ui:comic.draw.settings}}**, and it is off by default: IP-Adapter tends to dull the style and to carry the reference picture's white background and stance into the panels. When it is on, the reference is used lightly, over the first part of the drawing only, and the CFG scale is not lowered (an IP-Adapter model must be installed). When it is on and you draw the whole page or the whole comic, a character without a reference picture is drawn first on its own, from its words, on a plain background, and that picture becomes the reference. When the Generate tab's model is a FLUX.2 model, the reference pictures go to the model itself whatever this setting says, instead of through IP-Adapter (up to 4 per panel); no IP-Adapter model is needed then.

When a panel with a pose has two or more characters, choose in the cast which person of the pose each one is ("{{ui:comic.cast.posePerson}}"). The character's words and reference picture then act only around that person, so faces and clothes do not move to the other one (with SD 1.5 and SDXL models). When the people are as many as the human characters, they are taken in order without choosing. A monster or an animal without a pose is drawn in the rest of the panel.

Besides the tags box, the look can be split into hair, eyes, face marks, clothes, build and accessories. Then a panel gets only the parts its picture shows: a prompt with close-up adds hair, eyes, face and accessories, upper body adds the clothes, and from behind leaves out the eyes and face. A prompt that says nothing is taken as showing the whole person, so every part is added. Tick "{{ui:comic.cast.nonHuman}}" for a monster or an animal: all its parts are always added, and its reference picture is drawn with no person in it.

If the character is linked to a character of the Characters library that has a LoRA (a link made by an earlier version), the panels this character is alone in are drawn with the LoRA and its trigger word. A panel with two or more characters that have a LoRA uses none, because their looks would mix. Nor is a LoRA used when it is of another kind than the Generate tab's model (such as SDXL and SD 1.5), or when the character's LoRA is turned off.

The agent writes the cast for you when it makes a comic. The cast keeps the words the same; it cannot make a face identical, so a small difference between panels can remain.

## Keeping places the same

Drawn one panel at a time, a scene in one room gets a different background in every panel. To prevent this, register places. Select a panel, press **{{ui:comic.place.title}}** in the panel tools at the top center, and press **{{ui:comic.place.add}}**. The new place becomes the selected panel's place. Give it a name, and in **{{ui:comic.place.tags}}** write what the place is, the things in it, its colors and its light as English tags (for example `classroom, wooden desks, green chalkboard, large windows, afternoon sunlight`). For the other panels, pick the place from the **{{ui:comic.place.inPanel}}** list. When a panel is drawn, the words of its place are added after its prompt as written, so the panels set there are drawn with the same background. Changing the words changes every panel set there. Register a place seen by day and by night as two places.

When the agent makes a comic, it registers the places too and picks a place for each panel.

## Asking the agent

In the **{{ui:comic.side.assistant}}** tab of the right column you can ask the agent about the open comic. It reads and writes the comic's characters and places, the page layouts, each panel's prompt and pose, and the balloons. It does only what you ask, and draws pictures only when you ask for them.

When you ask it to look at a drawn page and fix it, the agent looks at the picture of that page. The picture is sent to the AI you have chosen, so the same confirmation as for reading pictures appears first ([Assistant and settings](09-assistant-settings.md)). If you do not allow it, the agent does not look at that page.

## Stage directions

Each panel can hold a note of its scene in words: like a script's stage direction, write the place, the time and who does what. Select the panel, press the note button (**{{ui:comic.panel.note}}**) at the top of the center to open the section, and write it there. A panel with no picture yet shows its stage direction in slanted letters (a panel without one shows its prompt). Stage directions are not used to make the picture. The agent can write them for you too (see [The Agent and Settings](09-assistant-settings.md)).

## Balloons and captions

![The balloon and caption section. The kinds of balloon are shown as small pictures of how they look](shot:comic-balloon-list)

Select a panel and press **{{ui:comic.panel.bubbles}}** at the top center to open the section: the kinds of balloon are shown as small pictures of how each looks. Press a picture to add a balloon of that kind to the panel, and **{{ui:comic.bubble.editor}}** opens laid over the board on the right. Below them, the section lists the panel's balloons by kind and text. Press a row to select that balloon, and press the pencil button (**{{ui:comic.bubble.edit}}**) to open **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}, {{ui:comic.bubble.kind.rounded}}, {{ui:comic.bubble.kind.box}}: an ellipse, a box with round corners and a square box, to which a tail can be added.
- {{ui:comic.bubble.kind.thought}}: a cloud, followed by small circles instead of a tail.
- {{ui:comic.bubble.preset.whisper}}: an ellipse drawn with a dashed line, for quiet voices and whispers.
- {{ui:comic.bubble.kind.shout}}, {{ui:comic.bubble.kind.explosion}}: balloons with a spiky edge. {{ui:comic.bubble.kind.explosion}} has big, uneven spikes.
- {{ui:comic.bubble.kind.wavy}}, {{ui:comic.bubble.kind.fuzzy}}: a wavy edge and an edge of fine hairs, for a weak voice or an uneasy feeling.
- {{ui:comic.bubble.kind.electric}}: a many-cornered box whose tail is a lightning bolt, for a phone, a speaker or a machine.
- {{ui:comic.bubble.kind.icicle}}: a balloon with icicles hanging from it, for a cold voice.
- {{ui:comic.bubble.kind.heart}}: a heart-shaped balloon.
- {{ui:comic.bubble.kind.flash}}: black lines gather around the words from all sides, for a shock or an inner cry.
- {{ui:comic.bubble.preset.dark}}, {{ui:comic.bubble.preset.double}}: a balloon filled black (with white letters), and a balloon drawn with a double line.
- {{ui:comic.bubble.kind.caption}}: a box with square corners and no tail.
- {{ui:comic.bubble.kind.sfx}}: lettering for a sound effect such as "BOOM". It has no balloon: heavy black letters with a white edge, starting at a larger size. **{{ui:comic.bubble.rotation}}** in **{{ui:comic.bubble.editor}}** slants the letters (from -90 to 90 degrees).
- {{ui:comic.bubble.kind.stamp}}: a sound effect pasted as a picture instead of lettering. There are three hands (angular, sharp brush, dry brush) with 38 words each, such as "DON", "ZAWA" and "GOGOGOGO", 114 pictures in all. The list in **{{ui:comic.bubble.editor}}** can be searched by word, reading or use (for example "don", "zawa" or "tension") and narrowed by hand. Its size, slant and place change as they do for the lettered sound effect, and it goes into the saved page and the PSD as a picture. The pictures are free to use, commercially too (CC0).
- {{ui:comic.bubble.kind.plain}}: letters of normal weight with no balloon, with a thin white edge so they can be read over a picture. They can be slanted too.

The line of a balloon wavers a little, as if drawn by hand. Each balloon has its own wavering, which stays the same when you move it or change its text.

![A balloon with vertical text, and the round handle at the tip of its tail](shot:comic-tail)

A balloon you add is placed in the middle of its panel. Drag a balloon on the page to place it. Even while the panel's picture is selected, pressing a balloon moves the balloon alone, not the panel or the picture. When you select a balloon, it is framed by a dashed blue line and the handles of its panel are hidden. A round handle also appears at the tip of its tail. Dragging the handle changes the direction and length of the tail. To add or remove a tail, press **{{ui:comic.bubble.tail}}** in **{{ui:comic.bubble.editor}}**.

![A balloon just added, with the balloon editing laid over the board on the right](shot:comic-balloon)

Double-clicking a balloon on the page also opens **{{ui:comic.bubble.editor}}**. It opens laid over the board at the right of the screen, so it does not cover the page (when the right panel is closed or narrow, it opens at the right edge of the page instead). Here you can change **{{ui:comic.bubble.kindLabel}}**, the text, **{{ui:comic.bubble.font}}**, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** and **{{ui:comic.bubble.tail}}**. The list of kinds also shows each shape as a small picture. Changing the kind keeps the text and the place. To close it, press the × at the top right or the Esc key. The balloon stays selected after it closes.

Under **{{ui:comic.bubble.look}}** you can change the following.

- **{{ui:comic.bubble.lineLabel}}**: choose from {{ui:comic.bubble.line.solid}}, {{ui:comic.bubble.line.dashed}}, {{ui:comic.bubble.line.double}} and {{ui:comic.bubble.line.none}}.
- **{{ui:comic.bubble.dark}}**: fills the balloon black and makes the letters white.
- **{{ui:comic.bubble.lineWidth}}**: how thick the line is (from 0.3 to 4 times).
- **{{ui:comic.bubble.rough}}**: how much the line wavers, as if drawn by hand. At 0 the line is as straight as if drawn with a ruler.
- **{{ui:comic.bubble.width}}**, **{{ui:comic.bubble.height}}**: the width and height of the balloon around its words (from 0.6 to 3 times).
- **{{ui:comic.bubble.spikes}}**, **{{ui:comic.bubble.depth}}**: how many spikes, cloud bumps, waves, hairs, corners, icicles or lines there are, and how deep. They appear only for the kinds that have them.
- **{{ui:comic.bubble.tailWidth}}**, **{{ui:comic.bubble.tailCurve}}**: how wide the tail is where it leaves the balloon, and how it bends. They appear only when there is a tail.

![A balloon being reshaped freely. Square points stand on its outline, and one has been pulled out to change the shape](shot:comic-balloon-shape)

The shape of a balloon can be changed freely. Press **{{ui:comic.bubble.shapeFreely}}** under **{{ui:comic.bubble.outline}}**, and square points stand on the outline of the balloon. Drag a point to move the outline there. Double-click a point to remove it (there are never fewer than 3), and double-click the balloon to add a point on the outline nearest to where you click. Spikes, cloud bumps and the like follow the changed outline. **{{ui:comic.bubble.smooth}}** switches between joining the points with a curve and with straight lines. **{{ui:comic.bubble.shapeReset}}** puts back the kind's own shape. Press **{{ui:comic.bubble.shapeFreely}}** again to hide the points.

Part of the words can be made bold or given emphasis dots (dots beside the characters, as Japanese stresses words). Select words in the field and press **{{ui:comic.bubble.bold}}** or **{{ui:comic.bubble.dots}}**; select the same words and press it again to take it off. In the field, bold shows as `**words**` and dots as `《《words》》`, and typing them directly does the same. On the page, the dots of horizontal text are above the characters, and those of vertical text on their right.

**{{ui:comic.bubble.font}}** offers the app's fonts and the fonts installed on this computer, each name shown in its own font. **{{ui:comic.bubble.fontDefault}}** uses **{{ui:settings.comicFont.label}}** in the settings (see [The Agent and Settings](09-assistant-settings.md)). The text size is changed with the **{{ui:comic.bubble.size}}** slider, from 40% to 400%. Pressing **{{ui:comic.bubble.vertical}}** makes the text vertical, with the lines running from the right. Vertical text wraps into the next column at the balloon's height.

When words run out of their balloon, a dashed red ring shows round the balloon. **{{ui:comic.bubble.fitHelp}}** (the **{{ui:comic.bubble.fit}}** button). After shrinking, the balloon is also moved so that its shape stays inside the panel. Balloons the agent places are fitted this way by themselves.

Anything you no longer need can be deleted with the trash can on its row in the section, or with **{{ui:comic.bubble.remove}}** in **{{ui:comic.bubble.editor}}**. You can also select a balloon on the page and press the Delete key or the trash can button at the top of the center.

## Layers

The layers of the page are always shown as a **{{ui:canvas.layers.title}}** list under the tabs of the right column (**{{ui:comic.side.assistant}}** and **{{ui:comic.side.gallery}}**). They are the same kind of layers as on the {{ui:app.tabs.canvas}} tab. Every page has two layers from the start: **{{ui:comic.layers.panels}}** (the frames and pictures of the panels) and **{{ui:comic.layers.balloons}}** (all the balloons and captions). A layer higher in the list is drawn in front. The add (plus) menu adds a **{{ui:canvas.add.raster}}** or an **{{ui:canvas.add.inpaint}}** of your own. A page holds up to 32 layers (the {{ui:comic.layers.panels}} and {{ui:comic.layers.balloons}} layers included), 8 masks, and 5000 drawn items in one layer. You are told when a limit is reached.

The eye button on a row shows or hides the layer, and the lock button locks it. A hidden layer is not drawn on the page, nor when the page is made into a picture. When a row is chosen, you can change its **{{ui:canvas.entity.opacity}}** and **{{ui:canvas.entity.blend}}** ({{ui:canvas.entity.blend.normal}}, {{ui:canvas.entity.blend.multiply}}, {{ui:canvas.entity.blend.screen}}). Rows are reordered by dragging or from the right-click menu: a layer below **{{ui:comic.layers.panels}}** lies under the panels' pictures as an underdrawing, and a layer above **{{ui:comic.layers.balloons}}** lies over the balloons. The {{ui:comic.layers.panels}} and {{ui:comic.layers.balloons}} layers can be moved and hidden, but not deleted or drawn on. Masks are not in the page picture or the PSD.

## Painting on the page

The switch at the top of the center changes between **{{ui:comic.paint.page}}** and **{{ui:comic.paint.paint}}**. In paint mode the panel and balloon tools are put away, and you draw on the chosen **{{ui:canvas.add.raster}}** with the same tools as on the {{ui:app.tabs.canvas}} tab ({{ui:canvas.tool.brush}}, {{ui:canvas.tool.eraser}}, {{ui:canvas.tool.mosaic}}, {{ui:canvas.tool.rect}}, {{ui:canvas.tool.lasso}}, {{ui:canvas.tool.move}}, {{ui:canvas.tool.bbox}}, {{ui:canvas.tool.colorPicker}}, {{ui:canvas.tool.bucket}}). Choosing a raster layer row in the list also starts painting, and choosing the {{ui:comic.layers.panels}} or {{ui:comic.layers.balloons}} row, or pressing the Esc key, goes back to the page. Opening another page or leaving the comic screen does too.

The {{ui:canvas.tool.bucket}} fills the region of colors close to the one you press (**{{ui:canvas.toolbar.bucketTolerance}}** sets how close). The **{{ui:canvas.toolbar.filter}}** button applies {{ui:canvas.rasterFilter.blur}}, {{ui:canvas.rasterFilter.grayscale}} or {{ui:canvas.rasterFilter.invert}} to the picture of the chosen raster layer. Both are taken back with the undo of the painting tools. Ctrl+Z while painting undoes the layers of that page; the comic's own undo does not bring layers back.

To redraw only a part of the page, add an {{ui:canvas.add.inpaint}}, paint the mask, set the area to generate with the {{ui:canvas.tool.bbox}} (it cannot leave the page) and press **{{ui:comic.inpaint.run}}** in the row of painting tools. Without a mask you are told to paint one first. The result waits in the accept bar over that page, and **{{ui:canvas.staging.accept}}** puts it into a new raster layer. If it arrives while you are on another page, you are told, and you can accept it by painting on the original page.

## Generation settings

The {{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}}, and {{ui:params.hires.title}} are the same as on the {{ui:app.tabs.generate}} tab. Changing the settings on the left also applies to the {{ui:app.tabs.generate}} tab. Only the prompts are separate for each panel (see "Panel prompts").

The picture that goes into a panel is one per panel. So the size of a picture is decided by the size of the panel, not by the size setting on the {{ui:app.tabs.generate}} tab. The Iterations field does not appear in comics.

The **{{ui:comic.draw.settings}}** of the left column also have fields of their own. **{{ui:comic.draw.style.title}}** are the quality words put in front of every panel's prompt and the negative shared by every panel. Add your usual artist or style tags to the quality words and every panel gets the same style. When they are empty, default words for the model are used. The default negative has no words that take the color out; to make pages black and white, use the page's effect. **{{ui:comic.draw.castReference.title}}** says whether the characters' reference pictures are used through IP-Adapter, and how strongly (see "Keeping characters the same").

## Making the page into one picture

Press **{{ui:comic.page.export}}** at the top of the center to save the page as one picture (PNG) in the gallery. The pictures of the panels and the text of the balloons and captions are drawn into that image. Each panel's picture is drawn with the position, size, rotation and flip you gave it on the page. The balloons are drawn with the same shape, line and wavering as on the page. The text is drawn with fonts installed on Windows, such as Japanese fonts. The layers are drawn in their order, with their opacity and blend mode, and a hidden layer is left out. The image is drawn at 200 dpi to match the paper size.

Press **{{ui:comic.page.psd}}** to save the page as a PSD file split into layers, as a browser download. From the bottom, it holds the white paper, the picture over the whole page, one layer per panel (its picture cut to the panel's shape; a panel with no picture is gray), one layer with all the frames, and one layer per balloon. These and the layers you added follow the order of the page's layers, and keep their opacity, blend mode and whether they are shown. The text of the balloons is drawn into the pictures, so it cannot be retyped in the PSD. The effect of the page is applied to each layer too. The file is named after the comic and the page number.

## Saving every page as one file

Press **{{ui:comic.book.export}}** at the top of the center to save all the pages of the comic as one file. **{{ui:comic.book.pdf}}** makes a PDF, which suits printing and sharing; **{{ui:comic.book.cbz}}** makes a CBZ, which comic readers open; **{{ui:comic.book.psd}}** makes a ZIP of one PSD per page. The pages go in the order they stand, and the file takes the comic's name. The file is saved as a browser download. With many pages, drawing them takes a little while.

Each PDF page is one picture at the paper size. If the first page is set to be read from right to left, the PDF opens as a right-to-left book. A CBZ holds one PNG per page, in order. Each PSD in the ZIP has the same layers as **{{ui:comic.page.psd}}** gives, and they are numbered in page order.

## Undo and redo

Press **{{ui:comic.history.undo}}** at the bottom left, below the page, to take back the last change, and **{{ui:comic.history.redo}}** to bring back a change that was taken back. On the keyboard, Ctrl+Z takes a change back and Ctrl+Shift+Z (or Ctrl+Y) brings it back (on a Mac, Command instead of Ctrl). Undo takes back the layout of the pages and panels (including their shapes), the prompts and poses of the panels, and the balloons. Layers are taken back by the undo of painting (see "Painting on the page"). The pictures of the panels (putting in, removing and moving them), the templates and the name of the comic are not taken back. Text typed into one field without a pause is taken back as one change. While the cursor is in a text field, Ctrl+Z changes the text in that field only.

## Saving and deleting

A comic is saved automatically about 1 second after a change. Even if you close the app and open it again, the saved projects stay in the list, and the pages, panels, balloons and templates remain as they were. They are also included in backups.

To delete a project, open the menu of its row in the comic list, press **{{ui:comic.project.delete}}**, and then press it again to confirm. Deleting a project removes its pages, panels and templates. The pictures you drew stay in the gallery.

To delete a page, press the trash can button below the page (**{{ui:comic.page.delete}}**) and then press it again to confirm. The panels and balloons on the page are removed, but the pictures you drew stay in the gallery.

## Using the drawn pictures

The drawn pictures are ordinary pictures that go into the gallery. Operations on other screens that use gallery pictures, such as dragging a gallery picture onto the {{ui:app.tabs.canvas}} tab, work as they are.
