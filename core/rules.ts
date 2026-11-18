// The rules of the game. There is no clock here: a command updates the state at
// once, and the events it returns are a record of what happened. Whoever called
// apply() decides how, or whether, to show them over time.

import { atDeliveryDock, atWorkbench, landmarkAt } from "./places.ts";
import { missingIngredients, RECIPES } from "./recipes.ts";
import {
  isPassable,
  type Resource,
  resourceAt,
  type Terrain,
  terrainAt,
} from "./terrain.ts";

export type Cell = { x: number; y: number };

export type Direction = "north" | "south" | "east" | "west";

// Plain data that survives JSON. Terrain is absent because the seed can recompute
// it: besides the seed, only what the player has caused belongs here.
export type GameState = {
  seed: number;
  ended: boolean;
  player: Cell;
  inventory: Record<string, number>;
  harvested: Record<string, boolean>;
};

// Command: https://gameprogrammingpatterns.com/command.html
export type Command =
  | { type: "move"; direction: Direction }
  | { type: "gather"; direction?: Direction }
  | { type: "craft"; recipe: string }
  | { type: "deliver" }
  | { type: "interact" };

// Domain Event: https://martinfowler.com/eaaDev/DomainEvent.html
export type GameEvent =
  | { type: "moved"; from: Cell; to: Cell }
  | { type: "blocked"; at: Cell; toward: Cell; terrain: Terrain }
  | { type: "gathered"; at: Cell; resource: Resource; total: number }
  | { type: "alreadyHarvested"; at: Cell }
  | { type: "crafted"; label: string; inventory: Record<string, number> }
  | { type: "craftFailed"; reason: string }
  | { type: "actionFailed"; reason: string }
  | { type: "workshopOpened" }
  | { type: "delivered"; inventory: Record<string, number> };

const STEPS: Record<Direction, Cell> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

// Singleton, avoided on purpose: tests make as many games as they need. https://gameprogrammingpatterns.com/singleton.html
export function newGame(seed: number): GameState {
  return {
    seed,
    ended: false,
    player: { x: 0, y: 0 },
    inventory: {},
    harvested: {},
  };
}

// The single way in. It updates the state it is given and returns the events.
export function apply(state: GameState, command: Command): GameEvent[] {
  if (state.ended) return [];
  switch (command.type) {
    case "move":
      return move(state, command.direction);
    case "gather":
      return gather(state, command.direction);
    case "craft":
      return craft(state, command.recipe);
    case "deliver":
      return deliver(state);
    case "interact":
      if (atWorkbench(state)) return [{ type: "workshopOpened" }];
      if (atDeliveryDock(state)) return deliver(state);
      return [{
        type: "actionFailed",
        reason: "Visit the workbench at -2, 0 or delivery dock at 3, 0.",
      }];
  }
}

function craft(state: GameState, recipeId: string): GameEvent[] {
  if (!Object.hasOwn(RECIPES, recipeId)) {
    return [{ type: "craftFailed", reason: "Unknown recipe." }];
  }
  if (!atWorkbench(state)) {
    return [{
      type: "craftFailed",
      reason: "Walk to the workbench at -2, 0 to craft.",
    }];
  }
  const recipe = RECIPES[recipeId];
  const missing = missingIngredients(state, recipe);
  if (Object.keys(missing).length > 0) {
    const needed = Object.entries(missing)
      .map(([item, count]) => `${item} × ${count}`).join(", ");
    return [{ type: "craftFailed", reason: `Need ${needed}.` }];
  }

  for (const [item, count] of Object.entries(recipe.inputs)) {
    state.inventory[item] -= count;
    if (state.inventory[item] === 0) delete state.inventory[item];
  }
  state.inventory[recipe.output] = (state.inventory[recipe.output] ?? 0) + 1;
  return [{
    type: "crafted",
    label: recipe.label,
    inventory: { ...state.inventory },
  }];
}

function deliver(state: GameState): GameEvent[] {
  if (!atDeliveryDock(state)) {
    return [{
      type: "actionFailed",
      reason: "Take the final parcel to the delivery dock at 3, 0.",
    }];
  }
  if ((state.inventory.finalParcel ?? 0) < 1) {
    return [{
      type: "actionFailed",
      reason: "Pack the final parcel at the workbench first.",
    }];
  }
  state.inventory.finalParcel -= 1;
  if (state.inventory.finalParcel === 0) delete state.inventory.finalParcel;
  state.inventory.deliveredParcel = (state.inventory.deliveredParcel ?? 0) + 1;
  state.ended = true;
  return [{ type: "delivered", inventory: { ...state.inventory } }];
}

function gather(state: GameState, direction?: Direction): GameEvent[] {
  const step = direction ? STEPS[direction] : { x: 0, y: 0 };
  const at = { x: state.player.x + step.x, y: state.player.y + step.y };
  const landmark = landmarkAt(at.x, at.y);
  if (landmark) {
    return [{
      type: "actionFailed",
      reason: `${landmark} is a landmark. Press E to interact.`,
    }];
  }
  const key = `${at.x},${at.y}`;
  if (state.harvested[key]) {
    return [{ type: "alreadyHarvested", at }];
  }

  const resource = resourceAt(state.seed, at.x, at.y);
  if (!resource) {
    return [{
      type: "actionFailed",
      reason: "This tile is empty. Look for a resource on the map.",
    }];
  }
  const total = (state.inventory[resource] ?? 0) + 1;
  state.inventory[resource] = total;
  state.harvested[key] = true;
  return [{ type: "gathered", at, resource, total }];
}

function move(state: GameState, direction: Direction): GameEvent[] {
  const step = STEPS[direction];
  // Events are retained and played back later, while state keeps changing. So an
  // event gets cells of its own, never an object that state still holds.
  // Aliasing Bug: https://martinfowler.com/bliki/AliasingBug.html
  // Cells in events act as a Value Object: https://martinfowler.com/bliki/ValueObject.html
  const from = { ...state.player };
  const to = { x: from.x + step.x, y: from.y + step.y };
  const terrain = terrainAt(state.seed, to.x, to.y);
  if (!isPassable(terrain)) {
    return [{ type: "blocked", at: from, toward: to, terrain }];
  }
  state.player.x = to.x;
  state.player.y = to.y;
  return [{ type: "moved", from, to }];
}
