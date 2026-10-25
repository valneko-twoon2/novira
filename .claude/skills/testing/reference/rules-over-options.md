# Rules over several options (decision tables, pairwise)

1. List each input the rule reads and its levels, starting from the equivalence classes: for example the mode is txt2img, img2img, inpaint, outpaint or another; a mask is absent, present but empty, or present and valid; a source image is absent or present.
2. Find the rule in the code. Current examples:
   - `backend/crates/novira-core/src/service/guidance.rs` `check`: mode, mask, source, and control and reference counts. Each count must equal the list sent; the limits are the constants at the top of the file.
   - `backend/crates/novira-core/src/comfy/graph.rs`: `check_hires` and `check_guidance`, run before a graph is built.
   - `backend/crates/novira-core/src/service/share.rs` `check_export`.
   - Classification: `backend/crates/novira-core/src/backup/mod.rs` `classify` (a file name to an entry kind) and `backend/crates/novira-core/src/models/classify.rs` (a model kind from its tensor names). One attribute is a partition; several that decide together need a decision table.

| Shape of the rule | Technique | How |
|---|---|---|
| Several conditions, different outcomes (refuse with message A, refuse with B, accept) | Decision table | One row per rule. Columns: each condition (true, false, or "-" when it does not matter), then the outcome. Merge rows where a condition does not matter |
| Several independent options whose faults come from pairs | Pairwise (all pairs) | Every pair of levels of any two options appears in at least one case. Write the covering cases as a table in the test. Pairs catch two-option faults only; say so if a three-option fault is possible |
| Few options with few levels | Full enumeration | When the whole product is small, write every case |
| Output that depends on many options (a graph, a prompt) | Representative cases and a snapshot | One combination per branch of the rule, asserting the parts that matter, plus a snapshot of the whole output for at least one (`*.snapshot.test.ts`, and the graph snapshots of `comfy/graph_snapshots.rs`) |

No pairwise generator is in the repository. Write the covering table by hand; do not add a dependency for it.

- One test per rule row, named after the rule (for example, "refuses a mask outside inpaint and outpaint").
- For a count limit, assert the boundary as `backend/crates/novira-core/tests/backend_service/guidance_mutation.rs` does: the maximum is accepted and one more is refused.
- Include hostile combinations: a mode that must not carry a mask, a count that does not match the list sent (the frontend is not trusted), a weight or a span outside its range.
- Update a snapshot only after reading the JSON diff (`regression-tests.md` gives the command for each side).
- A rule is covered only when each row has a test. List the rows that have none, and why.

Run: `cargo test -p novira-core --test backend_service guidance`, and `cargo test -p novira-core --lib comfy::` for graph building.
