import { assertEquals } from "@std/assert";
import { apply, type Command, newGame } from "./mod.ts";

Deno.test("an ended game ignores every command and keeps its state", () => {
  const state = newGame(121);
  assertEquals(state.ended, false);
  apply(state, { type: "gather", direction: "west" });
  state.ended = true;
  const finished = JSON.parse(JSON.stringify(state));

  const commands = {
    move: { type: "move", direction: "east" },
    gather: { type: "gather", direction: "east" },
    craft: { type: "craft", recipe: "rope" },
    deliver: { type: "deliver" },
    interact: { type: "interact" },
  } satisfies { [K in Command["type"]]: Extract<Command, { type: K }> };
  for (const command of Object.values(commands)) {
    assertEquals(apply(state, command), []);
    assertEquals(state, finished);
  }
});
