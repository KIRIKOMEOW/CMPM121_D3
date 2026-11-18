import { assertEquals } from "@std/assert";
import {
  apply,
  type Cell,
  type Command,
  DELIVERY_DOCK,
  type Direction,
  type GameEvent,
  isPassable,
  landmarkAt,
  newGame,
  resourceAt,
  terrainAt,
  WORKBENCH,
} from "./mod.ts";

const STEPS: [Direction, Cell][] = [
  ["north", { x: 0, y: -1 }],
  ["east", { x: 1, y: 0 }],
  ["south", { x: 0, y: 1 }],
  ["west", { x: -1, y: 0 }],
];

function journey(seed: number) {
  const state = newGame(seed);
  const commands: Command[] = [];
  const events: GameEvent[] = [];
  const run = (command: Command) => {
    commands.push(command);
    events.push(...apply(state, command));
  };
  const findPath = (accept: (cell: Cell) => boolean): Direction[] => {
    const queue: { cell: Cell; path: Direction[] }[] = [{
      cell: { ...state.player },
      path: [],
    }];
    const visited = new Set([`${state.player.x},${state.player.y}`]);
    for (let index = 0; index < queue.length; index++) {
      const { cell, path } = queue[index];
      if (accept(cell)) return path;
      for (const [direction, step] of STEPS) {
        const next = { x: cell.x + step.x, y: cell.y + step.y };
        const key = `${next.x},${next.y}`;
        if (
          Math.abs(next.x) > 50 || Math.abs(next.y) > 50 ||
          visited.has(key) || !isPassable(terrainAt(seed, next.x, next.y))
        ) continue;
        visited.add(key);
        queue.push({ cell: next, path: [...path, direction] });
      }
    }
    throw new Error("No reachable route in the test region.");
  };
  const walk = (path: Direction[]) => {
    for (const direction of path) run({ type: "move", direction });
  };
  for (
    const [resource, count] of Object.entries({
      fiber: 2,
      driftwood: 2,
      scrap: 3,
      fuel: 2,
    })
  ) {
    while ((state.inventory[resource] ?? 0) < count) {
      let gatherDirection: Direction = "north";
      const path = findPath((cell) =>
        STEPS.some(([direction, step]) => {
          const x = cell.x + step.x;
          const y = cell.y + step.y;
          if (
            landmarkAt(x, y) || state.harvested[`${x},${y}`] ||
            resourceAt(seed, x, y) !== resource
          ) return false;
          gatherDirection = direction;
          return true;
        })
      );
      walk(path);
      run({ type: "gather", direction: gatherDirection });
    }
  }
  walk(findPath((cell) => cell.x === WORKBENCH.x && cell.y === WORKBENCH.y));
  for (const recipe of ["rope", "hull", "engine", "delivery"]) {
    run({ type: "craft", recipe });
  }
  assertEquals(state.ended, false);
  walk(
    findPath((cell) =>
      cell.x === DELIVERY_DOCK.x && cell.y === DELIVERY_DOCK.y
    ),
  );
  run({ type: "deliver" });
  assertEquals(state.ended, true);
  assertEquals(state.inventory, { deliveredParcel: 1 });
  return { state, commands, events };
}

Deno.test("a courier can gather, visit the workbench, and deliver through commands", () => {
  for (const seed of [121, 7]) {
    const first = journey(seed);
    assertEquals(journey(seed), first);
    assertEquals(first.events.at(-1)?.type, "delivered");
  }
});
