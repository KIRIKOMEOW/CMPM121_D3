import { assertEquals } from "@std/assert";
import {
  apply,
  DELIVERY_DOCK,
  missingIngredients,
  newGame,
  RECIPES,
  TERRAIN_YIELD,
  WORKBENCH,
} from "./mod.ts";

Deno.test("crafting away from the workbench preserves cargo", () => {
  const state = newGame(121);
  state.inventory = { fiber: 2 };
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "craft", recipe: "rope" }), [{
    type: "craftFailed",
    reason: "Walk to the workbench at -2, 0 to craft.",
  }]);
  assertEquals(state, before);
});

Deno.test("failed and unknown crafts preserve every state field", () => {
  const state = newGame(121);
  state.player = { ...WORKBENCH };
  state.inventory.fiber = 1;
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(missingIngredients(state, RECIPES.rope), { fiber: 1 });
  assertEquals(apply(state, { type: "craft", recipe: "rope" }), [{
    type: "craftFailed",
    reason: "Need fiber × 1.",
  }]);
  for (const recipe of ["unknown", "__proto__", "constructor"]) {
    assertEquals(apply(state, { type: "craft", recipe }), [{
      type: "craftFailed",
      reason: "Unknown recipe.",
    }]);
  }
  assertEquals(state, before);
});

Deno.test("crafting consumes ingredients and retained events keep their inventory", () => {
  const state = newGame(121);
  state.player = { ...WORKBENCH };
  state.inventory = { fiber: 4, fuel: 2 };
  const first = apply(state, { type: "craft", recipe: "rope" });
  apply(state, { type: "craft", recipe: "rope" });
  assertEquals(state.inventory, { rope: 2, fuel: 2 });
  assertEquals(first, [{
    type: "crafted",
    label: "Make rope",
    inventory: { fiber: 2, fuel: 2, rope: 1 },
  }]);
});

Deno.test("packing the final parcel requires a separate trip to the dock", () => {
  const state = newGame(121);
  state.player = { ...WORKBENCH };
  state.inventory = { fiber: 2, driftwood: 2, scrap: 3, fuel: 2 };
  for (const recipe of ["rope", "hull", "engine", "delivery"]) {
    apply(state, { type: "craft", recipe });
    assertEquals(state.ended, false);
  }
  assertEquals(state.inventory, { finalParcel: 1 });
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "deliver" }), [{
    type: "actionFailed",
    reason: "Take the final parcel to the delivery dock at 3, 0.",
  }]);
  assertEquals(state, before);
  state.player = { ...DELIVERY_DOCK };
  assertEquals(apply(state, { type: "deliver" }), [{
    type: "delivered",
    inventory: { deliveredParcel: 1 },
  }]);
  const finished = JSON.parse(JSON.stringify(state));
  assertEquals(state.ended, true);
  assertEquals(apply(state, { type: "deliver" }), []);
  assertEquals(apply(state, { type: "move", direction: "east" }), []);
  assertEquals(state, finished);
});

Deno.test("delivery without a parcel and gathering landmarks change nothing", () => {
  const state = newGame(121);
  state.player = { ...DELIVERY_DOCK };
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "deliver" }), [{
    type: "actionFailed",
    reason: "Pack the final parcel at the workbench first.",
  }]);
  assertEquals(state, before);
  state.player = { x: WORKBENCH.x + 1, y: WORKBENCH.y };
  const beside = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "gather", direction: "west" }), [{
    type: "actionFailed",
    reason: "Workbench is a landmark. Press E to interact.",
  }]);
  assertEquals(state, beside);
});

Deno.test("every recipe has positive costs and inputs reachable from gathering", () => {
  const reachable = new Set<string>(Object.values(TERRAIN_YIELD));
  let previousSize: number;
  do {
    previousSize = reachable.size;
    for (const recipe of Object.values(RECIPES)) {
      for (const amount of Object.values(recipe.inputs)) {
        assertEquals(Number.isInteger(amount) && amount > 0, true);
      }
      if (Object.keys(recipe.inputs).every((item) => reachable.has(item))) {
        reachable.add(recipe.output);
      }
    }
  } while (reachable.size !== previousSize);
  assertEquals(reachable.has("finalParcel"), true);
  for (const recipe of Object.values(RECIPES)) {
    assertEquals(reachable.has(recipe.output), true, recipe.label);
  }
});
