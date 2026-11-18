# Manual test script

Run `deno task dev` and open the local URL with `?seed=121`. Reload before each section. Logical state is available as `game.state` in the browser console.

**Promotion rule:** a bug found by hand or by an agent becomes a permanent test in `core/` before it is fixed, unless it truly lives in `game/`, in which case add a step here.

## Calm map and resources

- Load the game. Most tiles are empty, ground colors are muted, and only scattered wood, leaves, metal, and fuel cans are visible. The camp path is clear.
- At spawn, the page shows the map, bag, brief objective, controls, and a collapsed Resource guide. Workbench recipes and the delivery panel are hidden.
- Gather toward an empty tile. The message explains that the tile is empty. Inventory and harvested records stay unchanged.
- Find a visible resource and gather toward it with Shift + arrow. Exactly one item enters the bag and the resource disappears. Repeat on the same tile. It reports already collected and the count stays unchanged.
- Walk away and return. The collected resource stays absent. Empty tiles cannot provide hidden resources.
- Expand Resource guide if needed. It explains the four resources and gathering fuel from shore.

## Movement and presentation

- Tap and hold all four arrows. The courier faces the movement direction, animates while walking, and stands still after release.
- Approach water and press toward it. The courier faces the blocked direction, flashes red, and returns to the original cell.
- Tap arrows and Shift + arrows during animation. The latest pending tap runs after the current playback. After input stops, the marker matches the small coordinate readout.
- Resize the window or use browser zoom. The canvas remains sharp and the bag, controls, and ending dialog fit the page.
- Toggle Sound with mouse, Tab, and Space. Confirm steps, bumps, collection, and delivery can be heard when enabled, and remain silent when muted. Hearing requires a person with speakers or headphones.

## Workbench, delivery, and restart

- From spawn, move left once and press E. The nearby workbench section opens and the first recipe receives keyboard focus. With missing materials, Enter reports the shortage and leaves the bag unchanged.
- Leave the workbench. After playback settles, the recipe section disappears. Return and gather the materials needed for rope, hull, engine, and the final parcel.
- Use Tab and Enter or Space to craft at the workbench. Shortages update and consumed items leave the bag.
- Packing the final parcel leaves the game running. Walk to the dock at (3, 0). Only near the dock does the Deliver button appear.
- At the dock without a parcel, E explains what is missing. With the parcel, E or Deliver consumes it and opens the ending dialog.
- The ending dialog focuses Start a new delivery. Press Enter to restart with empty cargo, uncollected resources, and no ending stamp.
- Repeat on `?seed=7`. Both landmarks remain reachable and the full gathering, repair, and delivery route can be completed.

## Pickup, navigation, and recipe hints

- Walk onto a visible resource and press F. The resource disappears and enters the bag. F again and adjacent gathering of that same cell both report already collected.
- Walk away from camp. The bottom-right map corner shows arrows and distances to the workbench and dock. Walk in different directions and check the arrows rotate toward each location. Near the corresponding landmark, its hint disappears.
- Gather a new material. A dismissible recipe card names the recipe, shows the complete ingredient quantities and output, and explains what is still missing. Gather enough material to make it and check a Ready to make card points you to the workbench.
- The card can be dismissed by mouse or keyboard. Moving leaves it available to read. Restart clears discovery hints for the new game.
- Ground has occasional grass, pebbles, flowers, and shoreline details. Most cells stay empty and decorative details provide no resources.
