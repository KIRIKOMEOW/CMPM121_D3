import { assert, assertEquals } from "@std/assert";
import { apply, isPassable, newGame, resourceAt, terrainAt } from "./mod.ts";

Deno.test("picking up the current cell shares harvest history with adjacent gathering", () => {
  const state = newGame(121);
  let found = false;
  for (let y = -20; y <= 20 && !found; y++) {
    for (let x = -20; x <= 20; x++) {
      if (resourceAt(121, x, y) && isPassable(terrainAt(121, x, y))) {
        state.player = { x, y };
        found = true;
        break;
      }
    }
  }
  assert(found);
  const original = { ...state.player };
  const resource = resourceAt(121, original.x, original.y)!;
  const first = apply(state, { type: "gather" });
  assertEquals(first, [{
    type: "gathered",
    at: original,
    resource,
    total: 1,
  }]);
  assertEquals(state.player, original);
  assertEquals(state.inventory, { [resource]: 1 });
  assertEquals(apply(state, { type: "gather" }), [{
    type: "alreadyHarvested",
    at: original,
  }]);
  state.player.x--;
  assertEquals(apply(state, { type: "gather", direction: "east" }), [{
    type: "alreadyHarvested",
    at: original,
  }]);
  assertEquals(first[0], {
    type: "gathered",
    at: original,
    resource,
    total: 1,
  });
  state.ended = true;
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "gather" }), []);
  assertEquals(state, before);
});
