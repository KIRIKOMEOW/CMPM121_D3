import type { Cell, GameState } from "./rules.ts";

export const WORKBENCH: Readonly<Cell> = { x: -2, y: 0 };
export const DELIVERY_DOCK: Readonly<Cell> = { x: 3, y: 0 };

export function isNear(player: Cell, place: Readonly<Cell>): boolean {
  return Math.abs(player.x - place.x) + Math.abs(player.y - place.y) <= 1;
}

export function atWorkbench(state: GameState): boolean {
  return isNear(state.player, WORKBENCH);
}

export function atDeliveryDock(state: GameState): boolean {
  return isNear(state.player, DELIVERY_DOCK);
}

export function landmarkAt(x: number, y: number): string | undefined {
  if (x === WORKBENCH.x && y === WORKBENCH.y) return "Workbench";
  if (x === DELIVERY_DOCK.x && y === DELIVERY_DOCK.y) return "Delivery dock";
}
