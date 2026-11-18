import type { GameState } from "./rules.ts";

export type Recipe = {
  label: string;
  inputs: Readonly<Record<string, number>>;
  output: string;
};

export const RECIPES: Readonly<Record<string, Recipe>> = {
  rope: { label: "Make rope", inputs: { fiber: 2 }, output: "rope" },
  hull: {
    label: "Repair hull",
    inputs: { driftwood: 2, rope: 1 },
    output: "hull",
  },
  engine: { label: "Repair engine", inputs: { scrap: 3 }, output: "engine" },
  delivery: {
    label: "Pack final parcel",
    inputs: { hull: 1, engine: 1, fuel: 2 },
    output: "finalParcel",
  },
};

export function missingIngredients(
  state: GameState,
  recipe: Recipe,
): Record<string, number> {
  const missing: Record<string, number> = {};
  for (const [item, required] of Object.entries(recipe.inputs)) {
    const shortage = required - (state.inventory[item] ?? 0);
    if (shortage > 0) missing[item] = shortage;
  }
  return missing;
}
