import {
  atDeliveryDock,
  atWorkbench,
  missingIngredients,
  newGame,
  RECIPES,
} from "../core/mod.ts";
import { Controller } from "./controller.ts";
import { startGridView } from "./grid/grid_view.ts";
import { Hud } from "./hud.ts";
import { Presenter } from "./presenter.ts";
import { type ManualEntry, RecipeBook } from "./recipe_book.ts";
import { Sounds } from "./sounds.ts";

history.scrollRestoration = "manual";
globalThis.scrollTo(0, 0);
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed")) || 121;
const state = newGame(seed);
const hud = new Hud(state);
const sounds = new Sounds(document.getElementById("mute") as HTMLButtonElement);
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
const deliver = document.querySelector<HTMLButtonElement>("#deliver")!;
deliver.addEventListener("click", () => controller.submit({ type: "deliver" }));
const refresh = () => {
  const nearWorkbench = atWorkbench(state);
  manual.refresh(state.ended, nearWorkbench);
  document.querySelector<HTMLElement>("#manual")!.hidden = !nearWorkbench;
  document.querySelector<HTMLElement>("#delivery-panel")!.hidden =
    !atDeliveryDock(state);
  if (hud.focusWorkshop) {
    hud.focusWorkshop = false;
    document.querySelector<HTMLButtonElement>("#recipes button:not(:disabled)")
      ?.focus();
  }
  deliver.disabled = state.ended || !atDeliveryDock(state);
};
controller.onSettled = refresh;
refresh();
document.querySelector("#dismiss-tip")!.addEventListener("click", () => {
  document.querySelector<HTMLElement>("#recipe-tip")!.hidden = true;
});
document.querySelector("#restart")!.addEventListener(
  "click",
  () => location.reload(),
);
document.querySelector("#ending")!.addEventListener(
  "cancel",
  (event) => event.preventDefault(),
);
Object.assign(globalThis, {
  game: { state, grid, hud, sounds, presenter, controller },
});
