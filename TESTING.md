# Manual test script

For a person, or an agent driving a browser. Run `deno task dev` and open the local URL with `?seed=121`. Before each section, reload. To read logical state, use `game.state` in the console. To read what has played, use the panel beside the grid, including the `#live` text, or look at the marker.

**Promotion rule:** a bug found by hand or by an agent becomes a permanent test in `core/` before it is fixed, unless it truly lives in `game/`, in which case add a step here.

| #  | Action                                                    | Expected observation                                                                                                                                                            |
| -- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Load the page                                             | One canvas with a pale marker at the center. The waybill shows an empty Manifest. No console errors.                                                                            |
| 2  | Tap the right arrow                                       | The marker slides one cell east. `#live` says `moved to 1, 0`. `player` is `{ x: 1, y: 0 }`.                                                                                    |
| 3  | Walk until lagoon is ahead, then press toward it.         | The marker lurches and flashes red, then returns to its cell. #live says blocked by lagoon at .... player has not changed.                                                      |
| 4  | Tap an arrow during a walk                                | The tap waits. The marker finishes the walk, then takes that step. It never skips a cell.                                                                                       |
| 5  | Mash arrows quickly, then stop                            | The marker settles on the cell `player` reports.                                                                                                                                |
| 6  | Hold an arrow down                                        | The marker keeps walking. Holding into a wall repeats the bump.                                                                                                                 |
| 7  | Load `?seed=7`                                            | A different map.                                                                                                                                                                |
| 8  | Run `game.state` in the console                           | Plain data includes `seed`, `player`, `inventory`, `harvested`, and `ended`. A new game has `ended: false`.                                                                     |
| 9  | Press an arrow several times                              | Position and Terrain in the panel change as each step plays, and never ahead of the marker.                                                                                     |
| 10 | Make the window short, then press the down arrow          | The page does not scroll. The marker moves.                                                                                                                                     |
| 11 | Click the sound button, then press an arrow               | The button reads `Sound: off`, and the arrow still moves the marker.                                                                                                            |
| 12 | Click the sound button again                              | The button reads `Sound: on`, and you hear a two-note chime.                                                                                                                    |
| 13 | Tab to the sound button and press Space                   | It toggles. Arrow keys still move the marker.                                                                                                                                   |
| 14 | Listen while walking and bumping (headphones or speakers) | A soft tick on each step, and a low buzz on each bump. **This is the only check that a person can hear them.**                                                                  |
| 15 | On a high-resolution display, or at browser zoom 200%     | Grid edges stay sharp. The marker stays centered. Run `document.querySelector("canvas").width`: it is the canvas `clientWidth` times `devicePixelRatio`.                        |
| 16 | Tap Shift + right arrow, then repeat                      | A red line scans the eastern cell with one high beep and leaves a barcode. One item appears in the Manifest. On repeat, `already harvested` appears and the count stays at one. |
| 17 | While walking, tap Shift + arrow                          | The walk finishes before the target flashes and Manifest updates. The gather targets the cell next to the new player position.                                                  |
| 18 | From spawn, gather east, then walk east, west, east       | The barcode stays on the map. Terrain reads `Collected` on the harvested cell both times and drops that label one cell west. The inventory count stays at one.                  |

### Repair manual

- Tab to **Repair manual** below the manifest. Press Space to close it and Enter to reopen it. Focus stays on the heading. With an empty catalog, the manual reads “No repair recipes available yet.”
- With catalog entries connected, Tab to a recipe and gather a missing material. Check that the displayed shortage changes after the animation and the same button keeps focus. When all materials are available, it reads “Ready to craft.”
- Use Enter or Space on a recipe, including one with missing materials. Each activation sends one request. If an animation is playing, the request waits for it to finish.

### Delivery preview

- Open `?seed=121`. Move and gather. The waybill still shows its objective and the delivery stamp stays hidden.
- Open `?seed=121&preview=delivery`. Turn sound on, then activate **Preview delivery** by mouse or keyboard. The red **DELIVERED** stamp replaces the objective, Latest scan reads “Final parcel delivered.”, and a short rising chord plays once. The button disappears. The preview leaves `game.state.ended` false. You can still walk and gather.
- Reload the preview, switch sound off and activate it again. Check that the same stamp and message appear silently.
- To check playback order, reload the preview and run `game.controller.submit({ type: "move", direction: "east" }); document.querySelector("#preview-delivery").click()` in the browser console. The marker finishes the step before the stamp appears.

### Crafting and delivery

- Reload a regular game. The Repair manual lists rope, hull, engine, and delivery with the quantities still needed. Tab to a recipe and press Enter with insufficient cargo. Latest scan explains what is missing and cargo stays unchanged.
- Gather two fiber, craft rope, gather two driftwood and craft hull, gather three scrap and craft engine, then gather two fuel and choose delivery. All recipes support Tab and Enter or Space.
- After each craft, consumed cargo disappears and its output appears. A recipe activated during a walk waits for playback. The manual refreshes when playback settles.
- Delivery consumes the hull, engine, and fuel. The delivered stamp appears with the arrival chord. Further movement and gathering leave the state unchanged, and recipe buttons become disabled. Reload to start another game.
