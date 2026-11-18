import { assert, assertEquals } from "@std/assert";
import {
  apply,
  type GameState,
  isPassable,
  newGame,
  resourceAt,
  terrainAt,
} from "./mod.ts";

// Each test has a Given-When-Then shape: https://martinfowler.com/bliki/GivenWhenThen.html
const SEED = 121;

// A state with the player just west of a cell that is, or is not, passable.
// Searching keeps these tests honest if the terrain formula changes.
function besideEasternCell(
  passable: boolean,
  needsResource = false,
): GameState {
  for (let x = 2; x < 10_000; x++) {
    const here = isPassable(terrainAt(SEED, x, 0));
    const east = isPassable(terrainAt(SEED, x + 1, 0));
    if (
      here && east === passable &&
      (!needsResource || resourceAt(SEED, x + 1, 0))
    ) {
      const state = newGame(SEED);
      state.player = { x, y: 0 };
      return state;
    }
  }
  throw new Error("Found no suitable cell on this row.");
}

Deno.test("gathering from an adjacent lagoon gives fuel only once", () => {
  const state = besideEasternCell(false, true);
  const at = { x: state.player.x + 1, y: state.player.y };
  assertEquals(terrainAt(SEED, at.x, at.y), "lagoon");
  const player = { ...state.player };

  const first = apply(state, { type: "gather", direction: "east" });

  assertEquals(first, [{ type: "gathered", at, resource: "fuel", total: 1 }]);
  assertEquals(state.inventory, { fuel: 1 });
  assertEquals(state.harvested, { [`${at.x},${at.y}`]: true });
  assertEquals(state.player, player);
  const snapshot = JSON.parse(JSON.stringify(state));

  const second = apply(state, { type: "gather", direction: "east" });

  assertEquals(second, [{ type: "alreadyHarvested", at }]);
  assertEquals(state, snapshot);
});

Deno.test("moving onto passable terrain moves the player", () => {
  const state = besideEasternCell(true);
  const { x, y } = state.player;

  const events = apply(state, { type: "move", direction: "east" });

  assertEquals(state.player, { x: x + 1, y });
  assertEquals(events, [{
    type: "moved",
    from: { x, y },
    to: { x: x + 1, y },
  }]);
});

Deno.test("a gathered event keeps its cell and count after later commands", () => {
  const state = newGame(SEED);
  let startX = 5;
  while (
    !isPassable(terrainAt(SEED, startX, 0)) ||
    !isPassable(terrainAt(SEED, startX + 1, 0)) ||
    !isPassable(terrainAt(SEED, startX + 2, 0)) ||
    !resourceAt(SEED, startX + 1, 0) ||
    resourceAt(SEED, startX + 1, 0) !== resourceAt(SEED, startX + 2, 0)
  ) {
    if (++startX > 10000) throw new Error("No matching resource pair.");
  }
  state.player = { x: startX, y: 0 };
  const gather = { type: "gather", direction: "east" } as const;
  const [first] = apply(state, gather);
  assert(first.type === "gathered");
  assertEquals(first.total, 1);
  const snapshot = JSON.parse(JSON.stringify(first));

  apply(state, { type: "move", direction: "east" });
  const [second] = apply(state, gather);
  apply(state, { type: "move", direction: "east" });

  assert(second.type === "gathered");
  assertEquals(second.resource, first.resource);
  assertEquals(state.inventory[first.resource], 2);
  assertEquals(state.player, { x: startX + 2, y: 0 });
  assertEquals(first, snapshot);
});

Deno.test("a blocked move changes nothing and reports why", () => {
  const state = besideEasternCell(false);
  const snapshot = JSON.parse(JSON.stringify(state));
  const { x, y } = state.player;
  const target = { x: x + 1, y };

  const events = apply(state, { type: "move", direction: "east" });

  assertEquals(state, snapshot);
  assertEquals(events, [{
    type: "blocked",
    at: { x, y },
    toward: target,
    terrain: terrainAt(SEED, target.x, target.y),
  }]);
});

Deno.test("an event keeps its cells while state moves on", () => {
  const state = besideEasternCell(true);
  const { x, y } = state.player;

  const first = apply(state, { type: "move", direction: "east" });
  const second = apply(state, { type: "move", direction: "west" });
  apply(state, { type: "move", direction: "east" });

  // Both retained events still report the cells from when they happened, even
  // though state.player has since changed.
  assertEquals(first, [{
    type: "moved",
    from: { x, y },
    to: { x: x + 1, y },
  }]);
  assertEquals(second, [{
    type: "moved",
    from: { x: x + 1, y },
    to: { x, y },
  }]);
});
