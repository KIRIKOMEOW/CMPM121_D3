import { missingIngredients, newGame, RECIPES } from "../core/mod.ts";
import { Controller } from "./controller.ts";
import { startGridView } from "./grid/grid_view.ts";
import { Hud } from "./hud.ts";
import { Presenter } from "./presenter.ts";
import { type ManualEntry, RecipeBook } from "./recipe_book.ts";
import { Sounds } from "./sounds.ts";

// Where everything is wired together, and the only file that knows every part.
// Hexagonal Architecture (the core inside; keys, grid, HUD, sound, and tests around
// it): https://alistair.cockburn.us/hexagonal-architecture

// Choose another world with a URL like ?seed=7
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed")) || 121;

const state = newGame(seed);
const hud = new Hud(state);
const sounds = new Sounds(
  document.getElementById("mute") as HTMLButtonElement,
);
const grid = await startGridView(document.getElementById("grid")!, state);
const presenter = new Presenter([grid, hud, sounds]);
const controller = new Controller(state, presenter);

const recipes: ManualEntry[] = Object.entries(RECIPES).map(([id, recipe]) => ({
  label: recipe.label,
  command: { type: "craft", recipe: id },
  missing: () => missingIngredients(state, recipe),
}));
const manual = new RecipeBook(
  document.querySelector<HTMLUListElement>("#recipes")!,
  recipes,
  (command) => controller.submit(command),
);
controller.onSettled = () => manual.refresh(state.ended);

// Exercise the presentation with a user gesture while the capstone is pending.
if (params.get("preview") === "delivery") {
  const button = document.querySelector<HTMLButtonElement>(
    "#preview-delivery",
  )!;
  button.hidden = false;
  button.addEventListener("click", () => {
    button.hidden = true;
    presenter.play([{ type: "delivered" }]);
  }, { once: true });
}

// For poking at in the browser console, such as comparing logical state with
// presentation state: game.state
Object.assign(globalThis, {
  game: { state, grid, hud, sounds, presenter, controller },
});
