// The only folder allowed to import Phaser, and for one job: drawing the grid.
// Input, the HUD, sound, and the order of events all live outside it.
import Phaser from "phaser";
import type { Cell, Direction, GameEvent, GameState } from "../../core/mod.ts";
import {
  DELIVERY_DOCK,
  landmarkAt,
  resourceAt,
  terrainAt,
  WORKBENCH,
} from "../../core/mod.ts";

export const CELL_SIZE = 48;
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const WALK_MS = 120;
const BUMP_MS = 60;
const BUMP_COLOR = 0xe0533d;
const SCAN_COLOR = 0xff3434;
const COURIER_DIRECTIONS: Direction[] = ["south", "west", "east", "north"];

const TERRAIN_NAMES = ["sand", "grove", "wreck", "lagoon"] as const;
const GROUND_COLORS = {
  sand: 0xe2cfa6,
  grove: 0xadc090,
  wreck: 0xc6b49b,
  lagoon: 0x91babb,
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
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private position: Cell;
  private marker!: Phaser.GameObjects.Sprite;
  private facing: Direction = "south";

  constructor(state: GameState, onReady: () => void) {
    super("grid");
    this.seed = state.seed;
    this.onReady = onReady;
    this.start = { ...state.player };
    this.position = { ...state.player };
    this.harvested = { ...state.harvested };
  }

  preload() {
    this.load.image(
      "island",
      new URL("./resource-icons.png", import.meta.url).href,
    );
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
    const island = this.textures.get("island");
    const image = island.getSourceImage() as HTMLImageElement;
    for (const [column, terrain] of TERRAIN_NAMES.entries()) {
      const left = Math.floor(column * image.width / 4);
      island.add(
        terrain,
        0,
        left,
        0,
        Math.floor((column + 1) * image.width / 4) - left,
        image.height,
      );
    }
    island.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ground = this.add.graphics();
    for (
      const [place, label] of [
        [WORKBENCH, "WORKBENCH"],
        [DELIVERY_DOCK, "DELIVERY DOCK"],
      ] as const
    ) {
      const center = cellCenter(place);
      this.add.text(center.x, center.y - 38, label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#fff4d4",
        backgroundColor: "#302a21",
        padding: { x: 5, y: 3 },
      }).setOrigin(0.5).setDepth(2);
    }
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
    // One tile always spans 48 CSS pixels. A narrow layout shows fewer tiles.
    this.cameras.main.setZoom(ratio);
  }

  show(event: GameEvent): Promise<void> {
    switch (event.type) {
      case "moved":
        this.position = { ...event.to };
        this.drawCellsAround(event.to);
        return this.walk(event.from, event.to);
      case "blocked":
        return this.bump(event.at, event.toward);
      case "gathered":
        this.harvested[`${event.at.x},${event.at.y}`] = true;
        this.drawCellsAround(this.position);
        return this.flashHarvest(event.at);
      case "alreadyHarvested":
      case "crafted":
      case "craftFailed":
      case "actionFailed":
      case "workshopOpened":
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
    let index = 0;
    for (let y = centerY - CELLS_DOWN; y <= centerY + CELLS_DOWN; y++) {
      for (let x = centerX - CELLS_ACROSS; x <= centerX + CELLS_ACROSS; x++) {
        const terrain = terrainAt(this.seed, x, y);
        const occupied = resourceAt(this.seed, x, y) &&
          !this.harvested[`${x},${y}`] && !landmarkAt(x, y);
        this.ground.fillStyle(GROUND_COLORS[terrain]);
        this.ground.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE,
        );
        this.drawGroundDetail(x, y, terrain);
        let tile = this.tiles[index];
        if (!tile) {
          tile = this.add.image(0, 0, "island", terrain).setOrigin(0.5)
            .setDepth(0.5);
          this.tiles.push(tile);
        }
        tile.setFrame(terrain).setPosition(
          x * CELL_SIZE + CELL_SIZE / 2,
          y * CELL_SIZE + CELL_SIZE / 2,
        ).setDisplaySize(34, 34).setVisible(Boolean(occupied));
        index++;
      }
    }
    this.drawLandmarks();
  }

  private drawGroundDetail(
    x: number,
    y: number,
    terrain: typeof TERRAIN_NAMES[number],
  ) {
    const value =
      (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ this.seed) >>> 0;
    const left = x * CELL_SIZE;
    const top = y * CELL_SIZE;
    if (terrain === "lagoon") {
      this.ground.fillStyle(0xc1d4c1, 0.7);
      if (terrainAt(this.seed, x, y - 1) !== "lagoon") {
        this.ground.fillRect(left, top, CELL_SIZE, 3);
      }
      if (terrainAt(this.seed, x - 1, y) !== "lagoon") {
        this.ground.fillRect(left, top, 3, CELL_SIZE);
      }
      if (terrainAt(this.seed, x, y + 1) !== "lagoon") {
        this.ground.fillRect(left, top + CELL_SIZE - 3, CELL_SIZE, 3);
      }
      if (terrainAt(this.seed, x + 1, y) !== "lagoon") {
        this.ground.fillRect(left + CELL_SIZE - 3, top, 3, CELL_SIZE);
      }
      if (value % 4 === 0) {
        this.ground.fillStyle(0xc4d9d2, 0.5);
        this.ground.fillRect(left + 10, top + 30, 10, 2);
        this.ground.fillRect(left + 23, top + 12, 6, 2);
      }
      return;
    }
    if (value % 5 !== 0) return;
    if (terrain === "grove") {
      this.ground.lineStyle(1, 0x7b9868, 0.6);
      this.ground.lineBetween(left + 10, top + 38, left + 8, top + 33);
      this.ground.lineBetween(left + 10, top + 38, left + 13, top + 32);
      if (value % 3 === 0) {
        this.ground.fillStyle(0xead4b3, 0.85);
        this.ground.fillRect(left + 12, top + 30, 3, 3);
      }
    } else {
      this.ground.fillStyle(terrain === "sand" ? 0xc1ae88 : 0xa3907c, 0.45);
      this.ground.fillEllipse(left + 12, top + 36, 4, 2);
      this.ground.fillEllipse(left + 17, top + 39, 2, 2);
    }
  }

  private drawLandmarks() {
    const bench = cellCenter(WORKBENCH);
    const dock = cellCenter(DELIVERY_DOCK);
    this.ground.lineStyle(2, 0xffe8b7);
    for (const point of [bench, dock]) {
      this.ground.strokeRect(point.x - 23, point.y - 23, 46, 46);
    }
    this.ground.fillStyle(0x523522);
    this.ground.fillRect(bench.x - 16, bench.y - 6, 5, 21);
    this.ground.fillRect(bench.x + 11, bench.y - 6, 5, 21);
    this.ground.fillStyle(0xbb804c);
    this.ground.fillRect(bench.x - 20, bench.y - 13, 40, 12);
    this.ground.fillStyle(0xf3dda3);
    this.ground.fillRect(bench.x - 8, bench.y - 10, 3, 14);
    this.ground.fillStyle(0x71858b);
    this.ground.fillRect(bench.x - 13, bench.y - 12, 14, 6);
    this.ground.fillStyle(0x725035);
    this.ground.fillRect(dock.x - 22, dock.y - 22, 44, 44);
    this.ground.fillStyle(0xc19562);
    for (let offset = -19; offset < 20; offset += 8) {
      this.ground.fillRect(dock.x - 20, dock.y + offset, 40, 5);
    }
    this.ground.fillStyle(0x9b3529);
    this.ground.fillRect(dock.x - 13, dock.y - 16, 26, 28);
    this.ground.fillStyle(0xffecc0);
    this.ground.fillRect(dock.x - 9, dock.y - 12, 18, 12);
    this.ground.lineStyle(2, 0x9b3529);
    this.ground.lineBetween(dock.x - 9, dock.y - 12, dock.x, dock.y - 5);
    this.ground.lineBetween(dock.x + 9, dock.y - 12, dock.x, dock.y - 5);
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
