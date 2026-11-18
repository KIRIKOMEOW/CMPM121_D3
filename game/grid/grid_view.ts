// The only folder allowed to import Phaser, and for one job: drawing the grid.
// Input, the HUD, sound, and the order of events all live outside it.
import Phaser from "phaser";
import type {
  Cell,
  Direction,
  GameEvent,
  GameState,
  Terrain,
} from "../../core/mod.ts";
import { terrainAt } from "../../core/mod.ts";

export const CELL_SIZE = 32;
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const WALK_MS = 120;
const BUMP_MS = 60;
const BUMP_COLOR = 0xe0533d;
const SCAN_COLOR = 0xff3434;
const COURIER_DIRECTIONS: Direction[] = ["south", "west", "east", "north"];

const TERRAIN_COLORS: Record<Terrain, number> = {
  sand: 0xe4cf9a,
  grove: 0x2f6b3a,
  lagoon: 0x48a9a6,
  wreck: 0x9ca3af,
};

// Enough cells to cover the view, plus a margin so that the camera can lag behind
// the player without showing an unpainted edge.
const CELLS_ACROSS = 16;
const CELLS_DOWN = 13;

function cellCenter({ x, y }: Cell): Cell {
  return {
    x: x * CELL_SIZE + CELL_SIZE / 2,
    y: y * CELL_SIZE + CELL_SIZE / 2,
  };
}

// One output of the presenter. It shows events; it decides nothing.
// Humble Object: http://xunitpatterns.com/Humble%20Object.html
export class GridView extends Phaser.Scene {
  private readonly seed: number;
  private readonly onReady: () => void;
  private readonly start: Cell;
  private readonly harvested: Record<string, boolean>;
  private ground!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Sprite;
  private facing: Direction = "south";

  constructor(state: GameState, onReady: () => void) {
    super("grid");
    this.seed = state.seed;
    this.onReady = onReady;
    this.start = { ...state.player };
    this.harvested = { ...state.harvested };
  }

  preload() {
    this.load.image(
      "courier",
      new URL("./courier-walk.png", import.meta.url).href,
    );
  }

  create() {
    const texture = this.textures.get("courier");
    const source = texture.getSourceImage() as HTMLImageElement;
    for (const [row, direction] of COURIER_DIRECTIONS.entries()) {
      for (let pose = 0; pose < 4; pose++) {
        const left = Math.floor(pose * source.width / 4);
        const top = Math.floor(row * source.height / 4);
        texture.add(
          `${direction}-${pose}`,
          0,
          left,
          top,
          Math.floor((pose + 1) * source.width / 4) - left,
          Math.floor((row + 1) * source.height / 4) - top,
        );
      }
      this.anims.create({
        key: `walk-${direction}`,
        frames: [0, 1, 2, 3].map((pose) => ({
          key: "courier",
          frame: `${direction}-${pose}`,
        })),
        duration: WALK_MS,
      });
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ground = this.add.graphics();
    const { x, y } = cellCenter(this.start);
    this.marker = this.add.sprite(x, y, "courier", "south-0")
      .setOrigin(0.5, 0.92)
      .setDisplaySize(40, 40)
      .setDepth(1);
    this.cameras.main.startFollow(this.marker, true, 0.2, 0.2);
    this.drawCellsAround(this.start);
    this.trackDisplaySize();
    this.onReady();
  }

  private trackDisplaySize() {
    const parent = this.scale.canvas.parentElement!;
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.fitToDisplay(parent));
    };
    // A canvas resize can change its parent's height. Update on the next frame
    // and resize the backing store only when its dimensions change.
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(parent);

    // Browser zoom and moving between monitors can change the pixel ratio even
    // when the layout width stays the same.
    const listeners = new AbortController();
    const watchRatio = () => {
      matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
        "change",
        () => {
          scheduleFit();
          watchRatio();
        },
        { once: true, signal: listeners.signal },
      );
    };
    watchRatio();
    const stop = () => {
      observer.disconnect();
      listeners.abort();
      cancelAnimationFrame(frame);
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
      this.events.off(Phaser.Scenes.Events.DESTROY, stop);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.events.once(Phaser.Scenes.Events.DESTROY, stop);
    this.fitToDisplay(parent);
  }

  private fitToDisplay(parent: HTMLElement) {
    const width = Math.min(parent.clientWidth, VIEW_WIDTH);
    if (width === 0) return;
    const height = Math.round(width * VIEW_HEIGHT / VIEW_WIDTH);
    const ratio = globalThis.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    const canvas = this.scale.canvas;
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      this.scale.resize(pixelWidth, pixelHeight);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // One tile always spans 32 CSS pixels. A narrow layout shows fewer tiles.
    this.cameras.main.setZoom(ratio);
  }

  show(event: GameEvent): Promise<void> {
    switch (event.type) {
      case "moved":
        this.drawCellsAround(event.to);
        return this.walk(event.from, event.to);
      case "blocked":
        return this.bump(event.at, event.toward);
      case "gathered":
        this.harvested[`${event.at.x},${event.at.y}`] = true;
        this.drawHarvestStamp(event.at.x, event.at.y);
        return this.flashHarvest(event.at);
      case "alreadyHarvested":
      case "crafted":
      case "craftFailed":
      case "delivered":
        return Promise.resolve();
      default:
        // A new event type fails to type-check here until it has a presentation.
        event satisfies never;
        return Promise.resolve();
    }
  }

  private flashHarvest(at: Cell): Promise<void> {
    const { x, y } = cellCenter(at);
    const scan = this.add.rectangle(
      x,
      y - CELL_SIZE / 3,
      CELL_SIZE - 4,
      3,
      SCAN_COLOR,
    );
    return new Promise((done) => {
      this.tweens.add({
        targets: scan,
        y: y + CELL_SIZE / 3,
        alpha: 0,
        duration: WALK_MS * 2,
        onComplete: () => {
          scan.destroy();
          done();
        },
      });
    });
  }

  private face(from: Cell, to: Cell) {
    if (to.x !== from.x) this.facing = to.x > from.x ? "east" : "west";
    else if (to.y !== from.y) this.facing = to.y > from.y ? "south" : "north";
    this.marker.setFrame(`${this.facing}-0`);
  }

  private walk(from: Cell, to: Cell): Promise<void> {
    this.face(from, to);
    this.marker.play(`walk-${this.facing}`);
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        ...cellCenter(to),
        duration: WALK_MS,
        onComplete: () => {
          this.marker.stop().setFrame(`${this.facing}-0`);
          done();
        },
      });
    });
  }

  // Lurch part of the way toward the blocked cell, flash, and come back.
  private bump(at: Cell, toward: Cell): Promise<void> {
    const start = cellCenter(at);
    const target = cellCenter(toward);
    this.face(at, toward);
    this.marker.setTint(BUMP_COLOR);
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        x: start.x + (target.x - start.x) * 0.3,
        y: start.y + (target.y - start.y) * 0.3,
        duration: BUMP_MS,
        yoyo: true,
        onComplete: () => {
          this.marker.clearTint();
          done();
        },
      });
    });
  }

  // Paint only what is near the camera. Asking the core again costs little, and
  // the world itself is never stored.
  private drawCellsAround({ x: centerX, y: centerY }: Cell) {
    this.ground.clear();
    for (let y = centerY - CELLS_DOWN; y <= centerY + CELLS_DOWN; y++) {
      for (let x = centerX - CELLS_ACROSS; x <= centerX + CELLS_ACROSS; x++) {
        this.ground.fillStyle(TERRAIN_COLORS[terrainAt(this.seed, x, y)]);
        this.ground.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE - 1,
          CELL_SIZE - 1,
        );
        if (this.harvested[`${x},${y}`]) this.drawHarvestStamp(x, y);
      }
    }
  }

  // A barcode in the corner stays visible when the player stands on the tile.
  private drawHarvestStamp(x: number, y: number) {
    const left = x * CELL_SIZE + 2;
    const top = (y + 1) * CELL_SIZE - 9;
    this.ground.fillStyle(0x322c27);
    this.ground.fillRect(left, top, 13, 7);
    this.ground.fillStyle(0xffe8b7);
    this.ground.fillRect(left + 2, top + 1, 1, 5);
    this.ground.fillRect(left + 5, top + 1, 2, 5);
    this.ground.fillRect(left + 9, top + 1, 1, 5);
  }
}

// Resolves once Phaser has booted and the scene exists. Phaser's input and audio
// are off: this project only asks it to draw.
export function startGridView(
  parent: HTMLElement,
  state: GameState,
): Promise<GridView> {
  return new Promise((ready) => {
    const view = new GridView(state, () => ready(view));
    new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: "#14161a",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: view,
    });
  });
}
