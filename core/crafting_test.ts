import { assertEquals } from "@std/assert";
import {
  apply,
  missingIngredients,
  newGame,
  RECIPES,
  TERRAIN_YIELD,
} from "./mod.ts";

Deno.test("failed and unknown crafts preserve every state field", () => {
  const state = newGame(121);
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

Deno.test("the repair recipe chain delivers once and stops further commands", () => {
  const state = newGame(121);
  state.inventory = { fiber: 2, driftwood: 2, scrap: 3, fuel: 2 };
  for (const recipe of ["rope", "hull", "engine"]) {
    apply(state, { type: "craft", recipe });
    assertEquals(state.ended, false);
  }
  assertEquals(apply(state, { type: "craft", recipe: "delivery" }), [{
    type: "crafted",
    label: "Deliver the last parcel",
    inventory: { deliveredParcel: 1 },
  }, { type: "delivered" }]);
  assertEquals(state.ended, true);
  const before = JSON.parse(JSON.stringify(state));
  assertEquals(apply(state, { type: "craft", recipe: "delivery" }), []);
  assertEquals(apply(state, { type: "move", direction: "east" }), []);
  assertEquals(state, before);
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
  for (const recipe of Object.values(RECIPES)) {
    assertEquals(reachable.has(recipe.output), true, recipe.label);
    for (const item of Object.keys(recipe.inputs)) {
      assertEquals(reachable.has(item), true, item);
    }
  }
});
