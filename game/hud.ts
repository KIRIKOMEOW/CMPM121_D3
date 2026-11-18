import {
  atDeliveryDock,
  atWorkbench,
  DELIVERY_DOCK,
  type GameEvent,
  type GameState,
  missingIngredients,
  RECIPES,
  WORKBENCH,
} from "../core/mod.ts";

function element(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "gathered":
      return `Collected ${event.resource}.`;
    case "alreadyHarvested":
      return "Already collected.";
    case "moved":
      return "";
    case "blocked":
      return "Water ahead. Gather fuel from the shore.";
    case "crafted":
      return event.label + ".";
    case "craftFailed":
    case "actionFailed":
      return event.reason;
    case "workshopOpened":
      return "Choose a repair recipe.";
    case "delivered":
      return "Final parcel delivered.";
  }
}

export class Hud {
  focusWorkshop = false;
  private readonly shown: GameState;
  private readonly knownMaterials = new Set<string>();
  private readonly discoveredRecipes = new Set<string>();
  private readyRecipes = new Set<string>();

  constructor(state: GameState) {
    this.shown = {
      ...state,
      player: { ...state.player },
      inventory: { ...state.inventory },
      harvested: { ...state.harvested },
    };
    for (const item of Object.keys(state.inventory)) {
      this.knownMaterials.add(item);
    }
    this.showInventory();
    this.showPosition();
  }

  show(event: GameEvent) {
    if (event.type !== "moved") element("live").textContent = describe(event);
    if (event.type === "moved") this.shown.player = { ...event.to };
    if (event.type === "gathered") {
      this.shown.harvested[`${event.at.x},${event.at.y}`] = true;
      this.shown.inventory[event.resource] = event.total;
    }
    if (event.type === "crafted" || event.type === "delivered") {
      this.shown.inventory = { ...event.inventory };
    }
    if (event.type === "workshopOpened") {
      (element("manual") as HTMLDetailsElement).open = true;
      this.focusWorkshop = true;
    }
    if (event.type === "delivered") {
      this.shown.ended = true;
      element("objective").hidden = true;
      element("delivery-stamp").hidden = false;
      (element("ending") as HTMLDialogElement).showModal();
    }
    if (event.type === "gathered" || event.type === "crafted") {
      for (const item of Object.keys(this.shown.inventory)) {
        this.knownMaterials.add(item);
      }
      this.showRecipeHint();
    }
    this.showInventory();
    this.showPosition();
  }

  private showRecipeHint() {
    const readyNow = new Set<string>();
    let discovered: string | undefined;
    let newlyReady: string | undefined;
    for (const [id, recipe] of Object.entries(RECIPES)) {
      const relevant = Object.keys(recipe.inputs).some((item) =>
        this.knownMaterials.has(item)
      );
      if (!relevant) continue;
      if (!this.discoveredRecipes.has(id)) {
        this.discoveredRecipes.add(id);
        discovered = id;
      }
      if (Object.keys(missingIngredients(this.shown, recipe)).length === 0) {
        readyNow.add(id);
        if (!this.readyRecipes.has(id)) newlyReady = id;
      }
    }
    this.readyRecipes = readyNow;
    const id = newlyReady ?? discovered;
    if (!id) return;
    const recipe = RECIPES[id];
    element("recipe-tip-title").textContent = newlyReady
      ? "Ready to make · " + recipe.label
      : "Recipe discovered · " + recipe.label;
    element("recipe-tip-formula").textContent = Object.entries(recipe.inputs)
      .map(([item, count]) => `${item} × ${count}`).join(" + ") +
      " → " + recipe.output.replace(/([a-z])([A-Z])/g, "$1 $2");
    const missing = Object.entries(missingIngredients(this.shown, recipe))
      .map(([item, count]) => `${item} × ${count}`);
    element("recipe-tip-status").textContent = missing.length
      ? "Still need " + missing.join(", ")
      : "Materials collected. Visit the workbench to craft.";
    element("recipe-tip").hidden = false;
  }

  private showInventory() {
    const rows = Object.entries(this.shown.inventory).map(
      ([resource, count]) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const quantity = document.createElement("strong");
        name.textContent = resource.replace(/([a-z])([A-Z])/g, "$1 $2");
        quantity.textContent = String(count);
        row.append(name, quantity);
        return row;
      },
    );
    if (rows.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "Empty for now";
      rows.push(empty);
    }
    element("inventory").replaceChildren(...rows);
    element("objective").textContent = this.shown.inventory.finalParcel
      ? "Take the final parcel to the dock."
      : "Gather supplies, then repair at the workbench.";
  }

  private showLandmarkHints() {
    const hints: HTMLElement[] = [];
    for (
      const [place, label] of [[WORKBENCH, "Workbench"], [
        DELIVERY_DOCK,
        "Dock",
      ]] as const
    ) {
      const dx = place.x - this.shown.player.x;
      const dy = place.y - this.shown.player.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance <= 6) continue;
      const row = document.createElement("div");
      row.className = "landmark-hint";
      row.setAttribute(
        "aria-label",
        `${label}, ${distance} tiles away, at ${place.x}, ${place.y}`,
      );
      const arrow = document.createElement("span");
      arrow.className = "compass-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↑";
      arrow.style.transform = `rotate(${
        Math.atan2(dy, dx) * 180 / Math.PI + 90
      }deg)`;
      const name = document.createElement("span");
      name.textContent = `${label} · ${distance} tiles`;
      row.append(arrow, name);
      hints.push(row);
    }
    element("landmark-hints").replaceChildren(...hints);
  }

  private showPosition() {
    const { x, y } = this.shown.player;
    element("position").textContent = `${x}, ${y}`;
    element("context").textContent = atWorkbench(this.shown)
      ? "Workbench · press E to repair."
      : atDeliveryDock(this.shown)
      ? "Delivery dock · press E to hand over your parcel."
      : "F picks up a resource under your feet.";
    this.showLandmarkHints();
  }
}
