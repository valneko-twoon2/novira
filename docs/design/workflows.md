---
covers:
  - backend/crates/novira-core/src/service/workflows.rs
  - frontend/src/backend/defaultWorkflows.ts
  - frontend/src/state/workflows/**
  - frontend/src/features/workflows/**
---
# Workflows

The node workflow editor of the Workflows tab, the workflows it saves, and what runs a graph. Running a graph, the nodes of ComfyUI the editor offers and what the backend does with the result are in [workflow-graphs.md](workflow-graphs.md); installing packs is in [extensions.md](extensions.md); the assistant's edits are in [assistant.md](assistant.md).

## Behaviour

### Saved workflows

- Only user workflows are stored: one row each in the `workflows` table (`Table::Workflows` in `backend/crates/novira-core/src/db.rs`), sorted by `updated_at`, and held in memory for `bootstrap` (`service/mod.rs`). The wire type `SavedWorkflow` (`types.rs`) has id, name, description, author, tags, category (`user` or `default`), `updatedAt` and `graph` (any JSON).
- `save_workflow` (`service/workflows.rs`) updates the stored user workflow with the given id. Any other input (no id, or an id that is not a stored user workflow, such as a built-in's) creates one with a new id `wf-` plus 12 hex digits. Each save stamps `updated_at`. Memory changes first, then the row is written.
- `delete_workflow` removes it from the table and then from memory; an unknown id does nothing. A row that no longer parses is skipped and logged at start-up (`Db::load`).
- `save_workflow` checks its input before anything is stored (`check` in `backend/crates/novira-core/src/service/workflows.rs`): a name of 1 to 200 characters (not blank), an author of at most 200, a description of at most 20000, at most 50 tags of at most 100 characters, none with control characters (a description may hold line breaks and tabs), and a graph that is a JSON object of at most 32 MiB (`MAX_WORKFLOW_BYTES`, the cap of the canvas and comic documents, see [comic-canvas.md](comic-canvas.md)). A refused save returns an error naming the field and stores nothing. The shape inside the graph is the frontend's: the backend keeps it as it is.
- The database is written first, then the list in memory, so a write that fails leaves the list as it was.

### Built-in workflows

- Seven built-in workflows are listed in `frontend/src/backend/defaultWorkflows.ts` (category `default`, no graph). Their graphs are built on demand by `buildDefaultGraph` (`frontend/src/features/workflows/defaultGraphs.ts`). The backend stores none of them. In the desktop app a stored user workflow with the same id hides the built-in (`TauriBackend.ts`).
- The library opens from the Library card (`LibraryCard.tsx`, mounted in `app/Workspace.tsx`) above the Generate button, where the other tabs show their presets: it names the open workflow, marks unsaved changes, and opens the library dialog (not a preset list). The left panel and the editor toolbar have no library button.
- The library deletes only user workflows and copies only built-ins (`frontend/src/features/workflows/LibraryModal.tsx`). A copy is a new user workflow without the `default` tag. A workflow file is opened through the store's `loadFile` (set by `register.ts`: it asks before discarding unsaved changes), from the library's upload button and from the launchpad's load card, which opens the file picker itself.
- Saving an opened built-in creates a new user workflow, since `persist` (`actions.ts`) passes an id only for category `user`.

### The editor state

- `useWorkflows` (`frontend/src/state/workflows/workflows.ts`) holds the open graph (React Flow nodes and edges), the details, the linear-view form (an ordered list of node fields), the unsaved flag, the library and recent ids. Only the editor settings and recent ids persist (`novira.workflows`).
- Settings: snap to grid, edge labels, animated edges, minimap, field types, and `autoTidy`. Animated edges are on by default, automatic tidying off.
- Undo and redo keep snapshots of nodes, edges and form, up to the undo-limit setting (`undoLimit()`, `frontend/src/state/settings.ts`). Adding or removing nodes or connections, a drag, a connection and a form change each save a step; repeated edits of one field within `COALESCE_MS` share one. Loading a graph clears both stacks.
- Automatic tidying (`frontend/src/features/workflows/optimizeWorkflow.ts`) runs after an added or removed node or connection, once the wait `AUTO_OPTIMIZE_DELAY_MS` has passed and no drag or connection is in progress. It removes nothing for being unconnected and merges only wired nodes. The Optimize button (`optimizeGraph.ts`) also merges duplicates, removes nodes whose results reach no output, drops duplicate and dangling edges, and lays the graph out. Both are one undo step.

### Adding nodes

- The Nodes tab of the left panel (`NodeLibrary.tsx`) is laid out like ComfyUI's node library (`nodeTree.ts`): two sections (the nodes: the app's own and ComfyUI's in one tree, the app's filed by kind into the ComfyUI folder that fits (`BUILTIN_PATH`); extension nodes), the first a tree of folders by every part of the ComfyUI category, extension nodes a folder per extension (by name) with its categories inside (a lone category repeating the extension's name is left out), folders and nodes in the order ComfyUI lists the nodes (`comfyOrder`), folders and headings named with ComfyUI's own words in the app's language ([workflow-graphs.md](workflow-graphs.md)). Folders start closed; a search shows a flat list of matches, each with its path. A double-click or Enter adds the node to the middle of the canvas, each one 30 px off the last (`nodeAdder.ts`, which the editor registers with); a drag carries `NODE_MIME` and the editor places it at the drop point.
- The picker dialog (`NodePicker.tsx`) remains for `Shift+A` or `Space` and a connection dropped on empty space (it then lists only nodes that fit). Both use the search of `nodeCatalog.ts`.

### Saving and files

- Save and Save As (`actions.ts`, `persist`) send the name, description, author, tags and serialized graph. Save writes in place only for an open user workflow (`canSaveInPlace`). A failure shows as a notification.
- The serialized form (`frontend/src/features/workflows/serialize.ts`) is `format: "novira-workflow"`, `version: 1`, the details, nodes, edges, the form, and `packs` (folder and GitHub address of each custom pack used, when there are some).
- Reading (`deserializeWorkflow`, from an object or JSON text) needs `nodes` and `edges` arrays. A node needs a string id, `data`, `position` and a node type the editor knows; one unknown type makes the file invalid. Edges to missing nodes or unknown handles and form entries for missing fields are dropped. A `format` other than `novira-workflow`, or a `version` other than 1, is refused; a file that names neither is read as version 1.

### Files that need missing packs

- A file that fails only on nodes of packs not installed (every unknown type starts with `comfy:`, `frontend/src/features/workflows/packRequirements.ts`) waits in `frontend/src/state/workflows/workflowImport.ts`. `frontend/src/features/workflows/ImportNeedsPacks.tsx` lists its packs, with the address from the file or the one the app knows for the folder, and offers Install, or Restart when the folder is installed. A pack with no address reads "unknown source".
- Install uses the Extensions install path. The backend accepts only `https://github.com/<owner>/<repo>` (`parse_github`, `backend/crates/novira-core/src/comfy/node_packs.rs`).
- When ComfyUI's node definitions reload, the waiting file opens by itself if it now reads (`register.ts` subscribes to `useComfyNodes`). The wait is in memory only and is lost on restart.

## Boundaries

| Boundary | Guard |
|---|---|
| Saved workflow rows (`save_workflow`, `delete_workflow`) | Typed argument (`WorkflowInput`), then `check`: name, author, description and tags of bounded length without control characters, the graph a JSON object of at most 32 MiB. Ids are compared only with stored user workflows. Bound parameters in `db.rs`. |
| Workflow files and assistant edits | `deserializeWorkflow` refuses unknown node types, malformed nodes, and a `format` or `version` it does not know, and drops dangling parts. Assistant edits pass the same parser (`frontend/src/features/workflows/aiOps.ts`). |
| Pack address in a file (`packs[].url`) | Used only as an install address, limited by `parse_github` to `https://github.com/<owner>/<repo>`. |

## Known limits

- A saved workflow is bounded in size (32 MiB) but its graph is not checked inside.
- Saved workflows are unencrypted in the database and go into backups with it.
- A save replaces the stored graph; there is no version history.

## Not implemented

- Version history of saved workflows.
