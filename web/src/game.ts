import Phaser from "phaser";

// ─── Constants ────────────────────────────────────────────────────────────────
const VW = 400;
const VH = 600;

const HUNGER_DECAY = 1.0;
const HAPPY_DECAY  = 0.7;
const ENERGY_DECAY = 0.5;
const ENERGY_REGEN = 2.2;
const HUNGER_SLEEP = 0.3;
const STAT_MAX = 100;
const STAT_MIN = 0;

const SAVE_KEY = "digicritter_v2_save";

// ─── Animal definitions ───────────────────────────────────────────────────────
export type AnimalType = "dog" | "cat" | "rabbit" | "bird" | "hamster";

interface AnimalDef {
  label: string;
  emoji: string;
  bodyColor: number;
  earColor: number;
  bellyColor: number;
  accentColor: number;
  bgColor: number;
  groundColor: number;
}

const ANIMALS: Record<AnimalType, AnimalDef> = {
  dog: {
    label: "Dog", emoji: "🐶",
    bodyColor: 0xc8914a, earColor: 0xa06830, bellyColor: 0xf5deb3,
    accentColor: 0x7a4f20, bgColor: 0x1a2e1a, groundColor: 0x2d4a1e,
  },
  cat: {
    label: "Cat", emoji: "🐱",
    bodyColor: 0x888888, earColor: 0x666666, bellyColor: 0xdddddd,
    accentColor: 0x444444, bgColor: 0x1a1a2e, groundColor: 0x2a2a4a,
  },
  rabbit: {
    label: "Rabbit", emoji: "🐰",
    bodyColor: 0xf0e0e0, earColor: 0xf5c0c0, bellyColor: 0xffffff,
    accentColor: 0xd4a0a0, bgColor: 0x1e2a1e, groundColor: 0x2a3a2a,
  },
  bird: {
    label: "Bird", emoji: "🐦",
    bodyColor: 0x4a90d9, earColor: 0x2a6090, bellyColor: 0xffffff,
    accentColor: 0xfacc15, bgColor: 0x0f1f3a, groundColor: 0x1a3a5a,
  },
  hamster: {
    label: "Hamster", emoji: "🐹",
    bodyColor: 0xe8b870, earColor: 0xf0c090, bellyColor: 0xfff0d0,
    accentColor: 0xb08040, bgColor: 0x2a1a0a, groundColor: 0x3a2a10,
  },
};

// ─── Mood ─────────────────────────────────────────────────────────────────────
type Mood = "happy" | "content" | "sad" | "sick" | "sleeping" | "dead";

function getMood(hunger: number, happy: number, energy: number, sleeping: boolean, dead: boolean): Mood {
  if (dead) return "dead";
  if (sleeping) return "sleeping";
  if (hunger > 80 || energy < 10) return "sick";
  if (happy > 60 && hunger < 60) return "happy";
  if (happy < 30 || hunger > 70) return "sad";
  return "content";
}

// ─── Save ─────────────────────────────────────────────────────────────────────
interface SaveData {
  animal: AnimalType;
  hunger: number; happy: number; energy: number;
  age: number; score: number;
  sleeping: boolean; dead: boolean; lastTime: number;
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch { return null; }
}
function writeSave(d: SaveData): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /**/ }
}
function deleteSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /**/ }
}

// ─── Animal drawing ───────────────────────────────────────────────────────────
function drawAnimal(g: Phaser.GameObjects.Graphics, animal: AnimalType, def: AnimalDef, mood: Mood, cx: number, cy: number): void {
  g.clear();
  const eyeOpen = mood !== "sleeping" && mood !== "dead";
  const eyeColor = mood === "dead" ? 0x555555 : 0x1a1a1a;
  switch (animal) {
    case "dog":     drawDog(g, def, cx, cy, eyeColor, eyeOpen, mood); break;
    case "cat":     drawCat(g, def, cx, cy, eyeColor, eyeOpen, mood); break;
    case "rabbit":  drawRabbit(g, def, cx, cy, eyeColor, eyeOpen, mood); break;
    case "bird":    drawBird(g, def, cx, cy, eyeColor, eyeOpen, mood); break;
    case "hamster": drawHamster(g, def, cx, cy, eyeColor, eyeOpen, mood); break;
  }
}

function xEyes(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.beginPath(); g.moveTo(cx - 20, cy - 12); g.lineTo(cx - 12, cy - 4); g.strokePath();
  g.beginPath(); g.moveTo(cx - 12, cy - 12); g.lineTo(cx - 20, cy - 4); g.strokePath();
  g.beginPath(); g.moveTo(cx + 12, cy - 12); g.lineTo(cx + 20, cy - 4); g.strokePath();
  g.beginPath(); g.moveTo(cx + 20, cy - 12); g.lineTo(cx + 12, cy - 4); g.strokePath();
}

function drawDog(g: Phaser.GameObjects.Graphics, def: AnimalDef, cx: number, cy: number, eyeColor: number, eyeOpen: boolean, mood: Mood): void {
  // Floppy ears
  g.fillStyle(def.earColor); g.fillEllipse(cx - 42, cy + 5, 28, 48); g.fillEllipse(cx + 42, cy + 5, 28, 48);
  // Body + head
  g.fillStyle(def.bodyColor); g.fillEllipse(cx, cy + 30, 80, 60); g.fillCircle(cx, cy, 52);
  // Belly + snout
  g.fillStyle(def.bellyColor); g.fillEllipse(cx, cy + 38, 44, 32); g.fillEllipse(cx, cy + 16, 34, 22);
  // Nose
  g.fillStyle(0x222222); g.fillEllipse(cx, cy + 9, 14, 9);
  // Mouth
  g.lineStyle(2.5, 0x333333, 1);
  if (mood === "happy") {
    g.beginPath(); g.arc(cx - 7, cy + 18, 7, 0, Math.PI, false); g.strokePath();
    g.beginPath(); g.arc(cx + 7, cy + 18, 7, 0, Math.PI, false); g.strokePath();
  } else if (mood === "sad" || mood === "sick") {
    g.beginPath(); g.arc(cx, cy + 22, 9, Math.PI, 0, true); g.strokePath();
  } else {
    g.beginPath(); g.moveTo(cx - 8, cy + 18); g.lineTo(cx + 8, cy + 18); g.strokePath();
  }
  // Eyes
  if (eyeOpen) {
    g.fillStyle(eyeColor); g.fillCircle(cx - 16, cy - 8, 8); g.fillCircle(cx + 16, cy - 8, 8);
    g.fillStyle(0xffffff); g.fillCircle(cx - 13, cy - 11, 3); g.fillCircle(cx + 19, cy - 11, 3);
  } else if (mood === "sleeping") {
    g.lineStyle(2.5, eyeColor, 1);
    g.beginPath(); g.arc(cx - 16, cy - 8, 6, Math.PI, 0, false); g.strokePath();
    g.beginPath(); g.arc(cx + 16, cy - 8, 6, Math.PI, 0, false); g.strokePath();
  } else { g.lineStyle(2.5, eyeColor, 1); xEyes(g, cx, cy); }
  // Tail
  g.fillStyle(def.bodyColor); g.fillEllipse(cx + 52, cy + 20, 18, 30);
}

function drawCat(g: Phaser.GameObjects.Graphics, def: AnimalDef, cx: number, cy: number, eyeColor: number, eyeOpen: boolean, mood: Mood): void {
  // Pointy ears
  g.fillStyle(def.earColor);
  g.fillTriangle(cx - 38, cy - 44, cx - 18, cy - 70, cx - 6, cy - 44);
  g.fillTriangle(cx + 38, cy - 44, cx + 18, cy - 70, cx + 6, cy - 44);
  g.fillStyle(0xf0a0b0);
  g.fillTriangle(cx - 34, cy - 46, cx - 20, cy - 64, cx - 10, cy - 46);
  g.fillTriangle(cx + 34, cy - 46, cx + 20, cy - 64, cx + 10, cy - 46);
  // Body + head
  g.fillStyle(def.bodyColor); g.fillEllipse(cx, cy + 30, 76, 58); g.fillCircle(cx, cy, 50);
  // Belly + snout
  g.fillStyle(def.bellyColor); g.fillEllipse(cx, cy + 36, 40, 28); g.fillEllipse(cx, cy + 14, 28, 18);
  // Nose
  g.fillStyle(0xf08080); g.fillTriangle(cx, cy + 8, cx - 5, cy + 14, cx + 5, cy + 14);
  // Mouth
  g.lineStyle(2, 0x666666, 1);
  g.beginPath(); g.moveTo(cx, cy + 14); g.lineTo(cx - 8, cy + 20); g.strokePath();
  g.beginPath(); g.moveTo(cx, cy + 14); g.lineTo(cx + 8, cy + 20); g.strokePath();
  // Whiskers
  g.lineStyle(1.5, def.accentColor, 0.7);
  g.beginPath(); g.moveTo(cx - 14, cy + 14); g.lineTo(cx - 44, cy + 10); g.strokePath();
  g.beginPath(); g.moveTo(cx - 14, cy + 17); g.lineTo(cx - 44, cy + 18); g.strokePath();
  g.beginPath(); g.moveTo(cx + 14, cy + 14); g.lineTo(cx + 44, cy + 10); g.strokePath();
  g.beginPath(); g.moveTo(cx + 14, cy + 17); g.lineTo(cx + 44, cy + 18); g.strokePath();
  // Eyes
  if (eyeOpen) {
    g.fillStyle(0x44bb44); g.fillEllipse(cx - 16, cy - 8, 14, 16); g.fillEllipse(cx + 16, cy - 8, 14, 16);
    g.fillStyle(eyeColor); g.fillEllipse(cx - 16, cy - 8, 5, 14); g.fillEllipse(cx + 16, cy - 8, 5, 14);
    g.fillStyle(0xffffff); g.fillCircle(cx - 12, cy - 12, 3); g.fillCircle(cx + 20, cy - 12, 3);
  } else if (mood === "sleeping") {
    g.lineStyle(2, eyeColor, 1);
    g.beginPath(); g.arc(cx - 16, cy - 8, 6, Math.PI, 0, false); g.strokePath();
    g.beginPath(); g.arc(cx + 16, cy - 8, 6, Math.PI, 0, false); g.strokePath();
  } else { g.lineStyle(2.5, eyeColor, 1); xEyes(g, cx, cy); }
  // Tail
  g.fillStyle(def.bodyColor); g.fillEllipse(cx + 50, cy + 25, 16, 40); g.fillEllipse(cx + 44, cy - 2, 14, 20);
}

function drawRabbit(g: Phaser.GameObjects.Graphics, def: AnimalDef, cx: number, cy: number, eyeColor: number, eyeOpen: boolean, mood: Mood): void {
  // Tall ears
  g.fillStyle(def.bodyColor); g.fillEllipse(cx - 22, cy - 68, 22, 60); g.fillEllipse(cx + 22, cy - 68, 22, 60);
  g.fillStyle(def.earColor);  g.fillEllipse(cx - 22, cy - 68, 12, 48); g.fillEllipse(cx + 22, cy - 68, 12, 48);
  // Body + head
  g.fillStyle(def.bodyColor); g.fillEllipse(cx, cy + 32, 82, 64); g.fillCircle(cx, cy, 48);
  // Belly + snout
  g.fillStyle(def.bellyColor); g.fillEllipse(cx, cy + 38, 50, 36); g.fillEllipse(cx, cy + 16, 30, 20);
  // Nose
  g.fillStyle(0xf08080); g.fillCircle(cx, cy + 10, 5);
  // Mouth
  g.lineStyle(2, 0xaaaaaa, 1);
  g.beginPath(); g.moveTo(cx, cy + 15); g.lineTo(cx - 7, cy + 22); g.strokePath();
  g.beginPath(); g.moveTo(cx, cy + 15); g.lineTo(cx + 7, cy + 22); g.strokePath();
  // Eyes
  if (eyeOpen) {
    g.fillStyle(0xcc4444); g.fillCircle(cx - 15, cy - 6, 8); g.fillCircle(cx + 15, cy - 6, 8);
    g.fillStyle(eyeColor); g.fillCircle(cx - 15, cy - 6, 4); g.fillCircle(cx + 15, cy - 6, 4);
    g.fillStyle(0xffffff); g.fillCircle(cx - 12, cy - 9, 2.5); g.fillCircle(cx + 18, cy - 9, 2.5);
  } else if (mood === "sleeping") {
    g.lineStyle(2, eyeColor, 1);
    g.beginPath(); g.arc(cx - 15, cy - 6, 6, Math.PI, 0, false); g.strokePath();
    g.beginPath(); g.arc(cx + 15, cy - 6, 6, Math.PI, 0, false); g.strokePath();
  } else { g.lineStyle(2.5, eyeColor, 1); xEyes(g, cx, cy); }
  // Fluffy tail
  g.fillStyle(def.bellyColor); g.fillCircle(cx + 46, cy + 36, 12);
}

function drawBird(g: Phaser.GameObjects.Graphics, def: AnimalDef, cx: number, cy: number, eyeColor: number, eyeOpen: boolean, mood: Mood): void {
  // Tail feathers
  g.fillStyle(def.earColor);
  g.fillTriangle(cx + 38, cy + 28, cx + 62, cy + 10, cx + 58, cy + 42);
  g.fillTriangle(cx + 36, cy + 32, cx + 64, cy + 28, cx + 58, cy + 50);
  // Wing
  g.fillStyle(def.earColor); g.fillEllipse(cx - 10, cy + 20, 60, 28);
  // Body + head
  g.fillStyle(def.bodyColor); g.fillEllipse(cx, cy + 22, 72, 56); g.fillCircle(cx - 4, cy - 12, 38);
  // Belly
  g.fillStyle(def.bellyColor); g.fillEllipse(cx + 4, cy + 28, 38, 36);
  // Beak
  g.fillStyle(def.accentColor); g.fillTriangle(cx - 38, cy - 14, cx - 18, cy - 20, cx - 18, cy - 8);
  // Crest
  g.fillStyle(def.earColor);
  g.fillEllipse(cx - 10, cy - 46, 10, 22); g.fillEllipse(cx, cy - 50, 10, 26); g.fillEllipse(cx + 10, cy - 46, 10, 22);
  // Eye
  if (eyeOpen) {
    g.fillStyle(0xffffff); g.fillCircle(cx + 6, cy - 16, 10);
    g.fillStyle(eyeColor); g.fillCircle(cx + 7, cy - 16, 6);
    g.fillStyle(0xffffff); g.fillCircle(cx + 9, cy - 19, 2.5);
  } else if (mood === "sleeping") {
    g.lineStyle(2, eyeColor, 1);
    g.beginPath(); g.arc(cx + 6, cy - 16, 7, Math.PI, 0, false); g.strokePath();
  } else {
    g.lineStyle(2.5, eyeColor, 1);
    g.beginPath(); g.moveTo(cx + 2, cy - 20); g.lineTo(cx + 10, cy - 12); g.strokePath();
    g.beginPath(); g.moveTo(cx + 10, cy - 20); g.lineTo(cx + 2, cy - 12); g.strokePath();
  }
  // Feet
  g.lineStyle(3, def.accentColor, 1);
  g.beginPath(); g.moveTo(cx - 8, cy + 52); g.lineTo(cx - 8, cy + 64); g.strokePath();
  g.beginPath(); g.moveTo(cx - 8, cy + 64); g.lineTo(cx - 20, cy + 68); g.strokePath();
  g.beginPath(); g.moveTo(cx - 8, cy + 64); g.lineTo(cx + 6, cy + 68); g.strokePath();
  g.beginPath(); g.moveTo(cx + 8, cy + 52); g.lineTo(cx + 8, cy + 64); g.strokePath();
  g.beginPath(); g.moveTo(cx + 8, cy + 64); g.lineTo(cx + 22, cy + 68); g.strokePath();
  g.beginPath(); g.moveTo(cx + 8, cy + 64); g.lineTo(cx - 4, cy + 68); g.strokePath();
}

function drawHamster(g: Phaser.GameObjects.Graphics, def: AnimalDef, cx: number, cy: number, eyeColor: number, eyeOpen: boolean, mood: Mood): void {
  // Round ears
  g.fillStyle(def.earColor); g.fillCircle(cx - 38, cy - 32, 18); g.fillCircle(cx + 38, cy - 32, 18);
  g.fillStyle(0xf0a0a0);     g.fillCircle(cx - 38, cy - 32, 10); g.fillCircle(cx + 38, cy - 32, 10);
  // Body + head
  g.fillStyle(def.bodyColor); g.fillEllipse(cx, cy + 28, 92, 68); g.fillCircle(cx, cy, 54);
  // Cheek pouches
  g.fillStyle(def.accentColor); g.fillEllipse(cx - 46, cy + 10, 28, 22); g.fillEllipse(cx + 46, cy + 10, 28, 22);
  // Belly + snout
  g.fillStyle(def.bellyColor); g.fillEllipse(cx, cy + 34, 56, 44); g.fillEllipse(cx, cy + 16, 32, 22);
  // Nose
  g.fillStyle(0xf08080); g.fillCircle(cx, cy + 10, 5);
  // Mouth
  g.lineStyle(2, 0x999999, 1);
  g.beginPath(); g.moveTo(cx, cy + 15); g.lineTo(cx - 7, cy + 22); g.strokePath();
  g.beginPath(); g.moveTo(cx, cy + 15); g.lineTo(cx + 7, cy + 22); g.strokePath();
  // Eyes
  if (eyeOpen) {
    g.fillStyle(eyeColor); g.fillCircle(cx - 17, cy - 6, 8); g.fillCircle(cx + 17, cy - 6, 8);
    g.fillStyle(0x333333); g.fillCircle(cx - 17, cy - 6, 5); g.fillCircle(cx + 17, cy - 6, 5);
    g.fillStyle(0xffffff); g.fillCircle(cx - 14, cy - 9, 2.5); g.fillCircle(cx + 20, cy - 9, 2.5);
  } else if (mood === "sleeping") {
    g.lineStyle(2, eyeColor, 1);
    g.beginPath(); g.arc(cx - 17, cy - 6, 6, Math.PI, 0, false); g.strokePath();
    g.beginPath(); g.arc(cx + 17, cy - 6, 6, Math.PI, 0, false); g.strokePath();
  } else { g.lineStyle(2.5, eyeColor, 1); xEyes(g, cx, cy); }
  // Paws + tail
  g.fillStyle(def.accentColor); g.fillEllipse(cx - 44, cy + 52, 20, 12); g.fillEllipse(cx + 44, cy + 52, 20, 12);
  g.fillStyle(def.bellyColor); g.fillCircle(cx + 46, cy + 30, 8);
}

// ─── Select Scene ─────────────────────────────────────────────────────────────
class SelectScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;

  constructor(onScore: (n: number) => void) {
    super("select");
    this.onScore = onScore;
  }

  create(): void {
    this.onScore(0);

    this.add.rectangle(VW / 2, VH / 2, VW, VH, 0x0f0f1a);
    for (let i = 0; i < 50; i++) {
      const sx = Phaser.Math.Between(0, VW);
      const sy = Phaser.Math.Between(0, VH);
      this.add.circle(sx, sy, Math.random() < 0.3 ? 1.5 : 1, 0xffffff, Phaser.Math.FloatBetween(0.2, 0.8));
    }

    this.add.text(VW / 2, 52, "DigiCritter", {
      fontFamily: "Fraunces, serif", fontSize: "38px", color: "#c4b5fd",
    }).setOrigin(0.5);
    this.add.text(VW / 2, 96, "Choose your pet!", {
      fontFamily: "Manrope, sans-serif", fontSize: "18px", color: "#a0a0c0",
    }).setOrigin(0.5);

    // Continue button if save exists
    const save = loadSave();
    if (save && !save.dead) {
      const adef = ANIMALS[save.animal];
      const contBg = this.add.rectangle(VW / 2, 136, 220, 36, 0x3b1d6e).setInteractive({ useHandCursor: true });
      this.add.text(VW / 2, 136, `▶ Continue with ${adef.emoji} ${adef.label}`, {
        fontFamily: "Manrope, sans-serif", fontSize: "13px", color: "#e0d0ff",
      }).setOrigin(0.5);
      contBg.on("pointerdown", () => this.scene.start("digi", { animal: save.animal, onScore: this.onScore }));
      contBg.on("pointerover", () => contBg.setFillStyle(0x5b2d9e));
      contBg.on("pointerout",  () => contBg.setFillStyle(0x3b1d6e));
    }

    const animals: AnimalType[] = ["dog", "cat", "rabbit", "bird", "hamster"];
    const positions = [
      { x: VW / 2 - 90, y: 295 },
      { x: VW / 2 + 90, y: 295 },
      { x: VW / 2 - 130, y: 468 },
      { x: VW / 2,       y: 468 },
      { x: VW / 2 + 130, y: 468 },
    ];

    animals.forEach((anim, i) => {
      const pos = positions[i]!;
      this.makeAnimalCard(pos.x, pos.y, anim, ANIMALS[anim]);
    });
  }

  private makeAnimalCard(x: number, y: number, animal: AnimalType, def: AnimalDef): void {
    const W = 142, H = 158;
    const bg = this.add.rectangle(x, y, W, H, 0x1e1b4b, 0.9).setInteractive({ useHandCursor: true });
    this.add.rectangle(x, y, W, H).setStrokeStyle(2, def.bodyColor, 0.8);

    const scale = 0.50;
    const g = this.add.graphics();
    g.x = x; g.y = y - 30; g.setScale(scale);
    drawAnimal(g, animal, def, "happy", 0, 0);

    this.add.text(x, y + H / 2 - 22, def.emoji + " " + def.label, {
      fontFamily: "Fraunces, serif", fontSize: "15px", color: "#e0d0ff",
    }).setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(0x2e2b6b);
      this.tweens.add({ targets: g, scaleX: scale * 1.1, scaleY: scale * 1.1, duration: 120, ease: "Back.Out" });
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x1e1b4b);
      this.tweens.add({ targets: g, scaleX: scale, scaleY: scale, duration: 120, ease: "Back.Out" });
    });
    bg.on("pointerdown", () => {
      deleteSave();
      this.scene.start("digi", { animal, onScore: this.onScore });
    });
  }
}

// ─── Main Pet Scene ───────────────────────────────────────────────────────────
class DigiScene extends Phaser.Scene {
  private onScore!: (n: number) => void;
  private animal!: AnimalType;
  private def!: AnimalDef;

  private hunger   = 20;
  private happy    = 80;
  private energy   = 80;
  private age      = 0;
  private score    = 0;
  private sleeping = false;
  private dead     = false;

  private critterGfx!: Phaser.GameObjects.Graphics;
  private shadowEllipse!: Phaser.GameObjects.Ellipse;
  private moodText!: Phaser.GameObjects.Text;
  private ageText!: Phaser.GameObjects.Text;
  private actionFeedback!: Phaser.GameObjects.Text;

  private hungerBar!: Phaser.GameObjects.Rectangle;
  private happyBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;

  private feedBtn!: Phaser.GameObjects.Container;
  private playBtn!: Phaser.GameObjects.Container;
  private walkBtn!: Phaser.GameObjects.Container;
  private sleepBtn!: Phaser.GameObjects.Container;
  private restartBtn!: Phaser.GameObjects.Container;

  private floatTween?: Phaser.Tweens.Tween;
  private bounceTween?: Phaser.Tweens.Tween;
  private feedCooldown = 0;
  private playCooldown = 0;
  private walkCooldown = 0;

  private readonly cx = VW / 2;
  private critterBaseY = VH / 2 - 40;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super("digi"); }

  init(data: { animal: AnimalType; onScore: (n: number) => void }): void {
    this.animal  = data.animal;
    this.onScore = data.onScore;
    this.def     = ANIMALS[this.animal];
  }

  create(): void {
    // Load save
    const save = loadSave();
    if (save && save.animal === this.animal) {
      const elapsed = Math.min((Date.now() - save.lastTime) / 1000, 300);
      this.hunger   = save.hunger;
      this.happy    = save.happy;
      this.energy   = save.energy;
      this.age      = save.age;
      this.score    = save.score;
      this.sleeping = save.sleeping;
      this.dead     = save.dead;
      this.applyDecay(elapsed);
    } else {
      this.hunger = 20; this.happy = 80; this.energy = 80;
      this.age = 0; this.score = 0; this.sleeping = false; this.dead = false;
    }
    this.onScore(this.score);

    const def = this.def;

    // Background
    this.add.rectangle(VW / 2, VH / 2, VW, VH, def.bgColor);
    this.add.rectangle(VW / 2, VH * 0.3, VW, VH * 0.6, 0x000022, 0.3);
    for (let i = 0; i < 35; i++) {
      const sx = Phaser.Math.Between(0, VW);
      const sy = Phaser.Math.Between(0, VH * 0.55);
      this.add.circle(sx, sy, Math.random() < 0.3 ? 1.5 : 1, 0xffffff, Phaser.Math.FloatBetween(0.2, 0.7));
    }
    // Ground
    this.add.rectangle(VW / 2, VH - 50, VW, 100, def.groundColor);
    const groundLineColor = Phaser.Display.Color.IntegerToColor(def.groundColor).lighten(20).color;
    this.add.rectangle(VW / 2, VH - 96, VW, 4, groundLineColor);

    // Back button
    const backBg = this.add.circle(28, 28, 20, 0x000000, 0.4).setInteractive({ useHandCursor: true });
    this.add.text(28, 28, "←", { fontFamily: "Manrope, sans-serif", fontSize: "18px", color: "#c4b5fd" }).setOrigin(0.5);
    backBg.on("pointerdown", () => this.scene.start("select", { onScore: this.onScore }));
    backBg.on("pointerover", () => backBg.setFillStyle(0x000000, 0.7));
    backBg.on("pointerout",  () => backBg.setFillStyle(0x000000, 0.4));

    // Animal name
    this.add.text(VW - 12, 14, def.emoji + " " + def.label, {
      fontFamily: "Fraunces, serif", fontSize: "18px", color: "#e0d0ff",
    }).setOrigin(1, 0);

    // Shadow + critter
    this.critterBaseY = VH / 2 - 40;
    this.shadowEllipse = this.add.ellipse(this.cx, this.critterBaseY + 72, 90, 18, 0x000000, 0.2);
    this.critterGfx = this.add.graphics();
    this.critterGfx.x = this.cx;
    this.critterGfx.y = this.critterBaseY;

    // Float tween
    this.floatTween = this.tweens.add({
      targets: this.critterGfx,
      y: this.critterBaseY - 10,
      duration: 1400,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        const off = this.critterGfx.y - this.critterBaseY;
        this.shadowEllipse.scaleX = 1 - Math.abs(off) * 0.006;
        this.shadowEllipse.alpha  = 0.2 - Math.abs(off) * 0.003;
      },
    });

    // Mood + age labels
    this.moodText = this.add.text(VW / 2, 52, "", {
      fontFamily: "Fraunces, serif", fontSize: "20px", color: "#c4b5fd",
    }).setOrigin(0.5);
    this.ageText = this.add.text(VW / 2, 76, "", {
      fontFamily: "Manrope, sans-serif", fontSize: "13px", color: "#9090c0",
    }).setOrigin(0.5);

    // Action feedback
    this.actionFeedback = this.add.text(VW / 2, VH / 2 - 120, "", {
      fontFamily: "Manrope, sans-serif", fontSize: "20px", color: "#ffffff",
    }).setOrigin(0.5).setAlpha(0);

    // Stat bars
    const barY0 = VH - 168;
    const barH  = 11;
    const barW  = 152;
    const labelX = 18;
    const barLeft = 118;

    this.add.text(labelX, barY0,      "🍎 Hunger", { fontFamily: "Manrope, sans-serif", fontSize: "12px", color: "#d0c0f0" }).setOrigin(0, 0.5);
    this.add.text(labelX, barY0 + 28, "⭐ Happy",  { fontFamily: "Manrope, sans-serif", fontSize: "12px", color: "#d0c0f0" }).setOrigin(0, 0.5);
    this.add.text(labelX, barY0 + 56, "⚡ Energy", { fontFamily: "Manrope, sans-serif", fontSize: "12px", color: "#d0c0f0" }).setOrigin(0, 0.5);

    this.add.rectangle(barLeft + barW / 2, barY0,      barW, barH, 0x1a1040).setOrigin(0.5);
    this.add.rectangle(barLeft + barW / 2, barY0 + 28, barW, barH, 0x1a1040).setOrigin(0.5);
    this.add.rectangle(barLeft + barW / 2, barY0 + 56, barW, barH, 0x1a1040).setOrigin(0.5);

    this.hungerBar = this.add.rectangle(barLeft, barY0,      barW, barH, 0xef4444).setOrigin(0, 0.5);
    this.happyBar  = this.add.rectangle(barLeft, barY0 + 28, barW, barH, 0xfacc15).setOrigin(0, 0.5);
    this.energyBar = this.add.rectangle(barLeft, barY0 + 56, barW, barH, 0x34d399).setOrigin(0, 0.5);

    // Buttons
    const btnY = VH - 44;
    const gap  = 80;
    const bx0  = VW / 2 - gap * 1.5;
    this.feedBtn  = this.makeBtn(bx0 + gap * 0, btnY, "🍎", "Feed",  () => this.doFeed());
    this.playBtn  = this.makeBtn(bx0 + gap * 1, btnY, "🎾", "Play",  () => this.doPlay());
    this.walkBtn  = this.makeBtn(bx0 + gap * 2, btnY, "🦮", "Walk",  () => this.doWalk());
    this.sleepBtn = this.makeBtn(bx0 + gap * 3, btnY, "💤", "Sleep", () => this.doSleep());
    this.restartBtn = this.makeBtn(VW / 2, VH / 2 + 120, "🔄", "New Pet", () => this.doRestart());
    this.restartBtn.setVisible(false);

    // Particles
    this.particles = this.add.particles(0, 0, "__DEFAULT", {
      speed: { min: 60, max: 180 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.7, end: 0 },
      lifespan: 650,
      quantity: 0,
      tint: [0xfcd34d, 0xf472b6, 0x34d399, 0x60a5fa, 0xfb923c],
    });

    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.save() });
    this.refreshUI();
  }

  private makeBtn(x: number, y: number, emoji: string, label: string, cb: () => void): Phaser.GameObjects.Container {
    const bg = this.add.circle(0, 0, 28, 0x2a1a5e).setInteractive({ useHandCursor: true });
    const em = this.add.text(0, -6, emoji, { fontSize: "20px" }).setOrigin(0.5);
    const lb = this.add.text(0, 17, label, { fontFamily: "Manrope, sans-serif", fontSize: "10px", color: "#c4b5fd" }).setOrigin(0.5);
    bg.on("pointerdown", cb);
    bg.on("pointerover",  () => bg.setFillStyle(0x4a2a9e));
    bg.on("pointerout",   () => bg.setFillStyle(0x2a1a5e));
    return this.add.container(x, y, [bg, em, lb]);
  }

  private applyDecay(dt: number): void {
    if (this.dead) return;
    if (this.sleeping) {
      this.hunger = Phaser.Math.Clamp(this.hunger + HUNGER_SLEEP * dt, STAT_MIN, STAT_MAX);
      this.energy = Phaser.Math.Clamp(this.energy + ENERGY_REGEN * dt, STAT_MIN, STAT_MAX);
    } else {
      this.hunger = Phaser.Math.Clamp(this.hunger + HUNGER_DECAY * dt, STAT_MIN, STAT_MAX);
      this.happy  = Phaser.Math.Clamp(this.happy  - HAPPY_DECAY  * dt, STAT_MIN, STAT_MAX);
      this.energy = Phaser.Math.Clamp(this.energy - ENERGY_DECAY * dt, STAT_MIN, STAT_MAX);
    }
    this.age += dt;
    this.feedCooldown = Math.max(0, this.feedCooldown - dt);
    this.playCooldown = Math.max(0, this.playCooldown - dt);
    this.walkCooldown = Math.max(0, this.walkCooldown - dt);
    if (this.hunger >= STAT_MAX || (this.energy <= STAT_MIN && this.happy <= STAT_MIN)) {
      this.dead = true;
    }
  }

  private refreshUI(): void {
    const mood = getMood(this.hunger, this.happy, this.energy, this.sleeping, this.dead);
    drawAnimal(this.critterGfx, this.animal, this.def, mood, 0, 0);

    const moodLabel: Record<Mood, string> = {
      happy: "😊 Happy!", content: "😌 Content", sad: "😢 Sad...",
      sick: "🤒 Sick!", sleeping: "💤 Sleeping", dead: "💀 Gone...",
    };
    this.moodText.setText(moodLabel[mood]);

    const ageS = Math.floor(this.age);
    this.ageText.setText(
      ageS < 60 ? `Age: ${ageS}s`
      : ageS < 3600 ? `Age: ${Math.floor(ageS / 60)}m ${ageS % 60}s`
      : `Age: ${Math.floor(ageS / 3600)}h`
    );

    const barW = 152;
    this.hungerBar.width = (this.hunger / STAT_MAX) * barW;
    this.happyBar.width  = (this.happy  / STAT_MAX) * barW;
    this.energyBar.width = (this.energy / STAT_MAX) * barW;

    if (this.hunger < 40)      this.hungerBar.setFillStyle(0x34d399);
    else if (this.hunger < 70) this.hungerBar.setFillStyle(0xfacc15);
    else                       this.hungerBar.setFillStyle(0xef4444);

    if (this.dead || this.sleeping) this.floatTween?.pause();
    else this.floatTween?.resume();

    // Update sleep button text
    const sleepLabel = this.sleepBtn.list[2] as Phaser.GameObjects.Text;
    const sleepEmoji = this.sleepBtn.list[1] as Phaser.GameObjects.Text;
    sleepLabel.setText(this.sleeping ? "Wake" : "Sleep");
    sleepEmoji.setText(this.sleeping ? "☀️" : "💤");

    const alive = !this.dead;
    this.feedBtn.setVisible(alive);
    this.playBtn.setVisible(alive);
    this.walkBtn.setVisible(alive);
    this.sleepBtn.setVisible(alive);
    this.restartBtn.setVisible(this.dead);
  }

  private showFeedback(text: string, color: string): void {
    this.actionFeedback.setText(text).setColor(color).setAlpha(1).setY(this.critterGfx.y - 100);
    this.tweens.add({
      targets: this.actionFeedback,
      y: this.critterGfx.y - 145,
      alpha: 0,
      duration: 1200,
      ease: "Quad.Out",
    });
  }

  private doFeed(): void {
    if (this.dead || this.sleeping || this.feedCooldown > 0) return;
    if (this.hunger <= 5) { this.showFeedback("Already full! 🍎", "#facc15"); return; }
    this.hunger = Math.max(0, this.hunger - 35);
    this.happy  = Math.min(STAT_MAX, this.happy + 5);
    this.feedCooldown = 3;
    this.score += 2; this.onScore(this.score);
    this.showFeedback("Yummy! 😋", "#fcd34d");
    this.burst(0xfcd34d); this.bounceAnim(); this.save();
  }

  private doPlay(): void {
    if (this.dead || this.sleeping || this.playCooldown > 0) return;
    if (this.energy < 15) { this.showFeedback("Too tired! 😴", "#a0a0ff"); return; }
    this.happy  = Math.min(STAT_MAX, this.happy + 28);
    this.energy = Math.max(0, this.energy - 12);
    this.hunger = Math.min(STAT_MAX, this.hunger + 8);
    this.playCooldown = 5;
    this.score += 5; this.onScore(this.score);
    this.showFeedback("So fun! 🎉", "#f472b6");
    this.burst(0xf472b6); this.bounceAnim(); this.save();
  }

  private doWalk(): void {
    if (this.dead || this.sleeping || this.walkCooldown > 0) return;
    if (this.energy < 10) { this.showFeedback("Too tired to walk! 😴", "#a0a0ff"); return; }
    this.happy  = Math.min(STAT_MAX, this.happy + 18);
    this.energy = Math.max(0, this.energy - 8);
    this.hunger = Math.min(STAT_MAX, this.hunger + 12);
    this.walkCooldown = 6;
    this.score += 4; this.onScore(this.score);
    this.showFeedback("Nice walk! 🌿", "#34d399");
    this.burst(0x34d399); this.walkAnim(); this.save();
  }

  private doSleep(): void {
    if (this.dead) return;
    this.sleeping = !this.sleeping;
    this.showFeedback(this.sleeping ? "Zzz... 💤" : "Good morning! ☀️", "#a0c4ff");
    this.save();
  }

  private doRestart(): void {
    deleteSave();
    this.scene.start("select", { onScore: this.onScore });
  }

  private burst(tint: number): void {
    const wx = this.critterGfx.x;
    const wy = this.critterGfx.y;
    this.particles.setPosition(wx, wy);
    this.particles.setParticleTint(tint);
    this.particles.explode(20, wx, wy);
  }

  private bounceAnim(): void {
    this.bounceTween?.stop();
    this.bounceTween = this.tweens.add({
      targets: this.critterGfx,
      scaleX: 1.14, scaleY: 0.88,
      duration: 80, yoyo: true, repeat: 2, ease: "Sine.InOut",
    });
  }

  private walkAnim(): void {
    this.bounceTween?.stop();
    const startX = this.critterGfx.x;
    this.bounceTween = this.tweens.add({
      targets: this.critterGfx,
      x: startX + 30,
      duration: 200, yoyo: true, repeat: 2, ease: "Sine.InOut",
      onComplete: () => { this.critterGfx.x = startX; },
    });
  }

  private save(): void {
    writeSave({
      animal: this.animal, hunger: this.hunger, happy: this.happy,
      energy: this.energy, age: this.age, score: this.score,
      sleeping: this.sleeping, dead: this.dead, lastTime: Date.now(),
    });
  }

  update(_time: number, delta: number): void {
    this.applyDecay(delta / 1000);
    this.refreshUI();
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export function startGame(parent: HTMLElement, onScore: (n: number) => void): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VW,
    height: VH,
    backgroundColor: "#0f0f1a",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
    scene: [new SelectScene(onScore), new DigiScene()],
    banner: false,
  });
  return () => game.destroy(true);
}
