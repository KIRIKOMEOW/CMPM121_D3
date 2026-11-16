import {
  type Cell,
  type GameEvent,
  type GameState,
  terrainAt,
} from "../core/mod.ts";

function element(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "gathered":
      return `Scanned ${event.resource} at ${event.at.x}, ${event.at.y}.`;
    case "alreadyHarvested":
      return `Delivery exception: already harvested at ${event.at.x}, ${event.at.y}.`;
    case "moved":
      return `moved to ${event.to.x}, ${event.to.y}`;
    case "blocked":
      return `blocked by ${event.terrain} at ${event.toward.x}, ${event.toward.y}`;
  }
}

// The readout, as ordinary page elements that CSS can style and that assistive
// tools can read. It changes only as events play.
export class Hud {
  private readonly seed: number;
  private readonly inventory: Record<string, number>;
  private readonly harvested: Record<string, boolean>;
  private position: Cell;

  constructor(state: GameState) {
    this.seed = state.seed;
    this.inventory = { ...state.inventory };
    this.harvested = { ...state.harvested };
    this.position = { ...state.player };
    this.showInventory();
    this.showPosition();
  }

  show(event: GameEvent) {
    element("live").textContent = describe(event);
    if (event.type === "moved") {
      this.position = event.to;
      this.showPosition();
    }
    if (event.type === "gathered") {
      this.harvested[`${event.at.x},${event.at.y}`] = true;
      this.showPosition();
      this.inventory[event.resource] = event.total;
      this.showInventory();
    }
  }

  showDelivery() {
    element("objective").hidden = true;
    element("delivery-stamp").hidden = false;
    element("live").textContent = "Final parcel delivered.";
  }

  private showInventory() {
    const rows = Object.entries(this.inventory).map(([resource, count]) => {
      const row = document.createElement("li");
      const name = document.createElement("span");
      const quantity = document.createElement("strong");
      name.textContent = resource;
      quantity.textContent = String(count);
      row.append(name, quantity);
      return row;
    });
    if (rows.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No cargo collected.";
      rows.push(empty);
    }
    element("inventory").replaceChildren(...rows);
  }

  private showPosition() {
    const { x, y } = this.position;
    const terrain = terrainAt(this.seed, x, y);
    element("position").textContent = `${x}, ${y}`;
    element("terrain").textContent = this.harvested[`${x},${y}`]
      ? `${terrain} · Collected`
      : terrain;
  }
}
