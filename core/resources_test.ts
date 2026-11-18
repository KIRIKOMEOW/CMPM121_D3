import { assert, assertEquals } from "@std/assert";
import { apply, newGame, resourceAt } from "./mod.ts";

Deno.test("empty ground cannot be harvested and leaves state unchanged", () => {
  const state = newGame(121);
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(resourceAt(121, 1, 0), undefined);
  assertEquals(apply(state, { type: "gather", direction: "east" }), [{
    type: "actionFailed",
    reason: "This tile is empty. Look for a resource on the map.",
  }]);
  assertEquals(state, before);
});

Deno.test("resources are deterministic and leave most ground empty", () => {
  let occupied = 0;
  for (let y = -30; y < 30; y++) {
    for (let x = -30; x < 30; x++) {
      const resource = resourceAt(121, x, y);
      assertEquals(resourceAt(121, x, y), resource);
      if (resource) occupied++;
    }
  }
  assert(occupied > 360 && occupied < 1080);
});
