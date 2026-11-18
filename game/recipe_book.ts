import type { Command } from "../core/mod.ts";

export type ManualEntry = {
  label: string;
  command: Command;
  missing(): Readonly<Record<string, number>>;
};

export class RecipeBook {
  private readonly rows: {
    entry: ManualEntry;
    status: HTMLElement;
    button: HTMLButtonElement;
  }[];

  constructor(
    list: HTMLUListElement,
    entries: readonly ManualEntry[],
    submit: (command: Command) => void,
  ) {
    list.replaceChildren();
    this.rows = entries.map((entry) => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      const name = document.createElement("span");
      const status = document.createElement("span");
      button.type = "button";
      button.className = "recipe-button";
      name.className = "recipe-name";
      name.textContent = entry.label;
      status.className = "recipe-status";
      button.append(name, status);
      button.addEventListener("click", (event) => {
        submit(entry.command);
        if (event.detail > 0) button.blur();
      });
      row.append(button);
      list.append(row);
      return { entry, status, button };
    });
  }

  refresh(ended: boolean, nearby: boolean) {
    for (const { entry, status, button } of this.rows) {
      button.disabled = ended || !nearby;
      const missing = Object.entries(entry.missing())
        .map(([item, count]) => `${item} × ${count}`);
      status.textContent = ended
        ? "Delivered"
        : missing.length
        ? `Need ${missing.join(", ")}`
        : "Ready to craft";
    }
  }
}
