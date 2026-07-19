import Phaser from "phaser";

// ─── Constants ───────────────────────────────────────────────────────────────
const VW = 400;
const VH = 600;

// How fast stats decay per second
const HUNGER_DECAY  = 1.2;   // hunger rises (critter gets hungry)
const HAPPY_DECAY   = 0.8;   // happiness falls
const ENERGY_DECAY  = 0.6;   // energy falls while awake
const ENERGY_REGEN  = 2.0;   // energy rises while sleeping
const HUNGER_SLEEP  = 0.4;   // hunger rises slower while sleeping

// Stat ranges: 0–100
const STAT_MAX = 100;
const STAT_MIN = 0;

// ─── Critter mood thresholds ──────────────────────────────────────────────────
type Mood = "happy" | "content" | "sad" | "sick" | "sleeping" | "dead";

function getMood(hunger: number, happy: number, energy: number, sleeping: boolean, dead: boolean): Mood {
  if (dead) return "dead";
  if (sleeping) return "sleeping";
  if (hunger > 80 || energy < 10) return "sick";
  if (happy > 60 && hunger < 60) return "happy";
  if (happy < 30 || hunger > 70) return "sad";
  return "content";
}

// ─── Emoji faces per mood ─────────────────────────────────────────────────────
const MOOD_FACE: Record<Mood, string[]> = {
  happy:    ["^‿^", "^‿^", "◠‿◠"],
  content:  ["•‿•", "·‿·", "•‿•"],
  sad:      ["•︵•", "ó︵ò", "•︵•"],
  sick:     ["×﹏×", "×_×", "x﹏x"],
  sleeping: ["─ ‿ ─", "– ‿ –", "─ ‿ ─"],
  dead:     ["x_x", "†_†", "x_x"],
};

// ─── Particle colors ──────────────────────────────────────────────────────────
const PARTICLE_COLORS = [0xfcd34d, 0xf472b6, 0x34d399, 0x60a5fa, 0xfb923c];

// ─── Saved state ─────────────────────────────────────────────────────────────
const SAVE_KEY = "digicritter_save";

interface SaveData {
  hunger: number;
  happy: number;
  energy: number;
  age: number;          // in seconds
  score: number;
  sleeping: boolean;
  dead: boolean;
  lastTime: number;     // epoch ms
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch { return null; }
}

function writeSave(d: SaveData): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

function deleteSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// ─── Main Scene ───────────────────────────────────────────────────────────────
class DigiScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;

  // Stats
  private hunger  = 20;   // 0 = full, 100 = starving
  private happy   = 80;
  private energy  = 80;
  private age     = 0;    // seconds alive
  private score   = 0;
  private sleeping = false;
  private dead    = false;

  // UI objects
  private bodyCircle!: Phaser.GameObjects.Arc;
  private bodyEye1!: Phaser.GameObjects.Arc;
  private bodyEye2!: Phaser.GameObjects.Arc;
  private faceText!: Phaser.GameObjects.Text;
  private moodText!: Phaser.GameObjects.Text;
  private ageText!: Phaser.GameObjects.Text;

  private hungerBar!: Phaser.GameObjects.Rectangle;
  private happyBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;

  private feedBtn!: Phaser.GameObjects.Container;
  private playBtn!: Phaser.GameObjects.Container;
  private sleepBtn!: Phaser.GameObjects.Container;
  private healBtn!: Phaser.GameObjects.Container;
  private restartBtn!: Phaser.GameObjects.Container;

  // Animation
  private floatTween?: Phaser.Tweens.Tween;
  private bounceTween?: Phaser.Tweens.Tween;
  private faceFrame = 0;
  private faceTimer = 0;

  // Cooldowns (seconds)
  private feedCooldown  = 0;
  private playCooldown  = 0;
  private healCooldown  = 0;

  // Particle emitter
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(onScore: (n: number) => void) {
    super("digi");
    this.onScore = onScore;
  }

  create(): void {
    // ── Load save ──────────────────────────────────────────────────────────
    const save = loadSave();
    if (save) {
      // Advance stats for time away (max 5 minutes of decay offline)
      const elapsed = Math.min((Date.now() - save.lastTime) / 1000, 300);
      this.hunger  = save.hunger;
      this.happy   = save.happy;
      this.energy  = save.energy;
      this.age     = save.age;
      this.score   = save.score;
      this.sleeping = save.sleeping;
      this.dead    = save.dead;
      this.applyDecay(elapsed);
      this.onScore(this.score);
    }

    // ── Background gradient (two rectangles) ───────────────────────────────
    this.add.rectangle(VW / 2, VH / 2, VW, VH, 0x1e1b4b);  // deep indigo
    this.add.rectangle(VW / 2, VH * 0.75, VW, VH * 0.5, 0x312e81).setAlpha(0.5);

    // Stars
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, VW);
      const y = Phaser.Math.Between(0, VH * 0.6);
      const r = Math.random() < 0.3 ? 2 : 1;
      this.add.circle(x, y, r, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
    }

    // ── Ground ─────────────────────────────────────────────────────────────
    this.add.rectangle(VW / 2, VH - 60, VW, 120, 0x4c1d95).setAlpha(0.6);
    this.add.rectangle(VW / 2, VH - 110, VW, 4, 0x7c3aed).setAlpha(0.8);

    // ── Critter body ───────────────────────────────────────────────────────
    const cx = VW / 2;
    const cy = VH / 2 - 20;

    // Shadow
    this.add.ellipse(cx, cy + 68, 90, 18, 0x000000, 0.25);

    // Body
    this.bodyCircle = this.add.circle(cx, cy, 55, 0xa78bfa);

    // Cheeks
    this.add.circle(cx - 38, cy + 10, 14, 0xf9a8d4, 0.5);
    this.add.circle(cx + 38, cy + 10, 14, 0xf9a8d4, 0.5);

    // Ears
    this.add.triangle(cx - 40, cy - 48,  0, 0, 20, -36, 40, 0, 0xc4b5fd);
    this.add.triangle(cx + 40, cy - 48,  -40, 0, -20, -36, 0, 0, 0xc4b5fd);

    // Eyes
    this.bodyEye1 = this.add.circle(cx - 18, cy - 8, 9, 0x1e1b4b);
    this.bodyEye2 = this.add.circle(cx + 18, cy - 8, 9, 0x1e1b4b);
    // Eye shine
    this.add.circle(cx - 15, cy - 12, 3, 0xffffff);
    this.add.circle(cx + 21, cy - 12, 3, 0xffffff);

    // Face expression text
    this.faceText = this.add.text(cx, cy + 14, "^‿^", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "22px",
      color: "#1e1b4b",
    }).setOrigin(0.5);

    // Floating idle tween
    this.floatTween = this.tweens.add({
      targets: [this.bodyCircle, this.bodyEye1, this.bodyEye2, this.faceText],
      y: "-=8",
      duration: 1200,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });

    // ── Mood + Age label ───────────────────────────────────────────────────
    this.moodText = this.add.text(cx, cy - 90, "😊 Happy", {
      fontFamily: "Fraunces, serif",
      fontSize: "20px",
      color: "#c4b5fd",
    }).setOrigin(0.5);

    this.ageText = this.add.text(cx, cy - 68, "Age: 0s", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "13px",
      color: "#a78bfa",
    }).setOrigin(0.5);

    // ── Stat bars ──────────────────────────────────────────────────────────
    const barY0 = VH - 185;
    const barH  = 10;
    const barW  = 160;
    const barX  = VW / 2;

    this.makeStatLabel(barX - 90, barY0 + 0,  "🍎 Hunger");
    this.makeStatLabel(barX - 90, barY0 + 28, "⭐ Happy");
    this.makeStatLabel(barX - 90, barY0 + 56, "⚡ Energy");

    // Bar backgrounds
    this.add.rectangle(barX + 40, barY0 + 0,  barW, barH, 0x3b0764).setOrigin(0.5);
    this.add.rectangle(barX + 40, barY0 + 28, barW, barH, 0x3b0764).setOrigin(0.5);
    this.add.rectangle(barX + 40, barY0 + 56, barW, barH, 0x3b0764).setOrigin(0.5);

    // Bar fills (origin left-center so width shrinks right)
    this.hungerBar = this.add.rectangle(barX + 40 - barW / 2, barY0 + 0,  barW, barH, 0xef4444).setOrigin(0, 0.5);
    this.happyBar  = this.add.rectangle(barX + 40 - barW / 2, barY0 + 28, barW, barH, 0xfacc15).setOrigin(0, 0.5);
    this.energyBar = this.add.rectangle(barX + 40 - barW / 2, barY0 + 56, barW, barH, 0x34d399).setOrigin(0, 0.5);

    // ── Action buttons ─────────────────────────────────────────────────────
    const btnY = VH - 52;
    const gap  = 80;
    const bx0  = VW / 2 - gap * 1.5;

    this.feedBtn  = this.makeButton(bx0 + gap * 0, btnY, "🍎", "Feed",  () => this.doFeed());
    this.playBtn  = this.makeButton(bx0 + gap * 1, btnY, "🎾", "Play",  () => this.doPlay());
    this.sleepBtn = this.makeButton(bx0 + gap * 2, btnY, "💤", "Sleep", () => this.doSleep());
    this.healBtn  = this.makeButton(bx0 + gap * 3, btnY, "💊", "Heal",  () => this.doHeal());

    // Restart button (hidden until dead)
    this.restartBtn = this.makeButton(VW / 2, VH / 2 + 100, "🔄", "New Pet", () => this.doRestart());
    this.restartBtn.setVisible(false);

    // ── Particle emitter for celebrations ─────────────────────────────────
    this.particles = this.add.particles(0, 0, "__DEFAULT", {
      speed: { min: 60, max: 200 },
      angle: { min: 230, max: 310 },
      scale: { start: 0.6, end: 0 },
      lifespan: 700,
      quantity: 0,
      tint: PARTICLE_COLORS,
    });

    // ── Auto-save every 5 seconds ──────────────────────────────────────────
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.save() });

    // Refresh UI immediately
    this.refreshUI();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private makeStatLabel(x: number, y: number, label: string): void {
    this.add.text(x, y, label, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "12px",
      color: "#c4b5fd",
    }).setOrigin(0, 0.5);
  }

  private makeButton(x: number, y: number, emoji: string, label: string, cb: () => void): Phaser.GameObjects.Container {
    const bg = this.add.circle(0, 0, 28, 0x4c1d95).setInteractive({ useHandCursor: true });
    const em = this.add.text(0, -6, emoji, { fontSize: "20px" }).setOrigin(0.5);
    const lb = this.add.text(0, 16, label, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "10px",
      color: "#c4b5fd",
    }).setOrigin(0.5);

    bg.on("pointerdown", cb);
    bg.on("pointerover",  () => bg.setFillStyle(0x6d28d9));
    bg.on("pointerout",   () => bg.setFillStyle(0x4c1d95));

    const c = this.add.container(x, y, [bg, em, lb]);
    return c;
  }

  private applyDecay(dt: number): void {
    if (this.dead) return;
    if (this.sleeping) {
      this.hunger  = Phaser.Math.Clamp(this.hunger + HUNGER_SLEEP * dt, STAT_MIN, STAT_MAX);
      this.energy  = Phaser.Math.Clamp(this.energy + ENERGY_REGEN * dt, STAT_MIN, STAT_MAX);
    } else {
      this.hunger  = Phaser.Math.Clamp(this.hunger + HUNGER_DECAY  * dt, STAT_MIN, STAT_MAX);
      this.happy   = Phaser.Math.Clamp(this.happy  - HAPPY_DECAY   * dt, STAT_MIN, STAT_MAX);
      this.energy  = Phaser.Math.Clamp(this.energy - ENERGY_DECAY  * dt, STAT_MIN, STAT_MAX);
    }
    this.age += dt;
    // Cooldowns
    this.feedCooldown  = Math.max(0, this.feedCooldown  - dt);
    this.playCooldown  = Math.max(0, this.playCooldown  - dt);
    this.healCooldown  = Math.max(0, this.healCooldown  - dt);

    // Death condition
    if (this.hunger >= STAT_MAX || this.energy <= STAT_MIN && this.happy <= STAT_MIN) {
      this.dead = true;
    }
  }

  private refreshUI(): void {
    const mood = getMood(this.hunger, this.happy, this.energy, this.sleeping, this.dead);

    // Body color per mood
    const bodyColor: Record<Mood, number> = {
      happy:    0xa78bfa,
      content:  0x818cf8,
      sad:      0x6b7280,
      sick:     0x4b5563,
      sleeping: 0x6366f1,
      dead:     0x374151,
    };
    this.bodyCircle.setFillStyle(bodyColor[mood]);

    // Face expression (cycle through frames slowly)
    const faces = MOOD_FACE[mood];
    this.faceText.setText(faces[this.faceFrame % faces.length]);

    // Mood label
    const moodLabel: Record<Mood, string> = {
      happy:    "😊 Happy!",
      content:  "😌 Content",
      sad:      "😢 Sad...",
      sick:     "🤒 Sick!",
      sleeping: "💤 Sleeping",
      dead:     "💀 Gone...",
    };
    this.moodText.setText(moodLabel[mood]);

    // Age
    const ageS = Math.floor(this.age);
    const ageLabel = ageS < 60
      ? `Age: ${ageS}s`
      : ageS < 3600
        ? `Age: ${Math.floor(ageS / 60)}m ${ageS % 60}s`
        : `Age: ${Math.floor(ageS / 3600)}h`;
    this.ageText.setText(ageLabel);

    // Bars — hunger bar fills as critter gets hungry (inverse: 0=full=empty bar)
    const barW = 160;
    this.hungerBar.width = (this.hunger / STAT_MAX) * barW;
    this.happyBar.width  = (this.happy  / STAT_MAX) * barW;
    this.energyBar.width = (this.energy / STAT_MAX) * barW;

    // Hunger bar color (green → yellow → red)
    if (this.hunger < 40)       this.hungerBar.setFillStyle(0x34d399);
    else if (this.hunger < 70)  this.hungerBar.setFillStyle(0xfacc15);
    else                        this.hungerBar.setFillStyle(0xef4444);

    // Float tween active only when alive and awake
    if (this.dead || this.sleeping) {
      this.floatTween?.pause();
    } else {
      this.floatTween?.resume();
    }

    // Show/hide restart
    this.restartBtn.setVisible(this.dead);
    this.feedBtn.setVisible(!this.dead);
    this.playBtn.setVisible(!this.dead);
    this.sleepBtn.setVisible(!this.dead);
    this.healBtn.setVisible(!this.dead);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private doFeed(): void {
    if (this.dead || this.sleeping || this.feedCooldown > 0) return;
    if (this.hunger <= 5) return; // already full
    this.hunger     = Math.max(0, this.hunger - 30);
    this.happy      = Math.min(STAT_MAX, this.happy + 5);
    this.feedCooldown = 3;
    this.score      += 2;
    this.onScore(this.score);
    this.burst(VW / 2, VH / 2 - 20, 0xfcd34d);
    this.bounceAnim();
    this.save();
  }

  private doPlay(): void {
    if (this.dead || this.sleeping || this.playCooldown > 0) return;
    if (this.energy < 15) return; // too tired
    this.happy      = Math.min(STAT_MAX, this.happy + 25);
    this.energy     = Math.max(0, this.energy - 10);
    this.hunger     = Math.min(STAT_MAX, this.hunger + 8);
    this.playCooldown = 5;
    this.score      += 5;
    this.onScore(this.score);
    this.burst(VW / 2, VH / 2 - 20, 0xf472b6);
    this.bounceAnim();
    this.save();
  }

  private doSleep(): void {
    if (this.dead) return;
    this.sleeping = !this.sleeping;
    this.save();
  }

  private doHeal(): void {
    if (this.dead || this.healCooldown > 0) return;
    this.happy      = Math.min(STAT_MAX, this.happy + 15);
    this.energy     = Math.min(STAT_MAX, this.energy + 20);
    this.hunger     = Math.max(0, this.hunger - 10);
    this.healCooldown = 10;
    this.score      += 3;
    this.onScore(this.score);
    this.burst(VW / 2, VH / 2 - 20, 0x34d399);
    this.bounceAnim();
    this.save();
  }

  private doRestart(): void {
    deleteSave();
    this.hunger  = 20;
    this.happy   = 80;
    this.energy  = 80;
    this.age     = 0;
    this.score   = 0;
    this.sleeping = false;
    this.dead    = false;
    this.onScore(0);
    this.scene.restart();
  }

  private burst(x: number, y: number, tint: number): void {
    this.particles.setPosition(x, y);
    this.particles.setParticleTint(tint);
    this.particles.explode(18, x, y);
  }

  private bounceAnim(): void {
    this.bounceTween?.stop();
    this.bounceTween = this.tweens.add({
      targets: [this.bodyCircle, this.bodyEye1, this.bodyEye2, this.faceText],
      scaleX: 1.15,
      scaleY: 0.88,
      duration: 80,
      yoyo: true,
      repeat: 2,
      ease: "Sine.InOut",
    });
  }

  private save(): void {
    writeSave({
      hunger:   this.hunger,
      happy:    this.happy,
      energy:   this.energy,
      age:      this.age,
      score:    this.score,
      sleeping: this.sleeping,
      dead:     this.dead,
      lastTime: Date.now(),
    });
  }

  // ── Update loop ───────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.applyDecay(dt);

    // Cycle face expression every 2 seconds
    this.faceTimer += dt;
    if (this.faceTimer >= 2) {
      this.faceTimer = 0;
      this.faceFrame++;
    }

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
    backgroundColor: "#1e1b4b",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: new DigiScene(onScore),
    banner: false,
  });

  return () => game.destroy(true);
}
