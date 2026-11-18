// STARHERD simulation: the Wisp, its ribbon trail and loop captures, echo
// halos, the follower flock, Strays / Comets / Umbra, the six nights, the
// constellation draft, and the two bosses. No drawing lives here; render.js
// reads this state. All randomness flows from one seeded Rng.

import {
  FIELD_W, FIELD_H, PLAY_TOP, PLAY_BOTTOM, WISP, SCORE, GLOW, COMBO,
  HALO, CAPS, NIGHTS, BANNERS, OMENS, SYNERGIES,
} from './config.js';
import { Rng, wanderAngle } from './random.js';

let nextId = 1;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonArea(poly) {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(sum / 2);
}

function polygonCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p.x; y += p.y; }
  return { x: x / poly.length, y: y / poly.length };
}

export class World {
  constructor(seed) {
    this.rng = new Rng(seed);
    this.time = 0;
    this.screen = 'title'; // title | playing | draft | victory | gameover | paused
    this.screenBeforePause = 'playing';
    this.score = 0;
    this.best = 0;
    this.glow = GLOW.max;
    this.night = 1;
    this.nightTime = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastCaptureAt = -99;
    this.emberSavedThisNight = false;
    this.shake = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.banner = '';
    this.bannerTimer = 0;
    this.bigText = '';
    this.bigTextTimer = 0;
    this.hintSmallLoopShown = 0;
    this.muted = false;
    this.soundEvents = [];

    this.wisp = { x: 640, y: 380, vx: 0, vy: 0, angle: 0 };
    this.trail = [];       // ribbon points, oldest first
    this.history = [];     // dense wisp positions for the flock train
    this.followers = [];   // captured strays trailing the wisp
    this.strays = [];
    this.comets = [];
    this.umbras = [];
    this.halos = [];
    this.particles = [];
    this.popups = [];
    this.bolts = [];
    this.boss = null;
    this.draftCards = [];
    this.draftTimer = 0;
    this.draftAfter = 'night'; // night | boss1
    this.pendingNight = 2;
    this.mods = null;
    this.resetMods();
    this.timers = { stray: 0, comet: 4, umbra: 6, bossUmbra: 12, bossComet: 8, bossStray: 6, bossBolt: 5 };
    this.tutorialStep = 0;
    this.titleOrbit = 0;
  }

  resetMods() {
    this.mods = {
      ribbonBonus: 0, trailBonus: 0, haloLifeBonus: 0, haloRate: 1,
      haloMaxBonus: 0, magnet: false, callPull: false, comboGrace: false,
      glowGainBonus: 0, picks: {}, tagCounts: {},
    };
  }

  get flock() { return this.followers.length; }

  ribbonWidth() {
    return WISP.baseRibbonWidth + this.mods.ribbonBonus +
      Math.min(12, Math.floor(this.followers.length / 5) * 2);
  }

  trailCap() {
    return WISP.baseTrailSamples + this.mods.trailBonus +
      Math.min(90, Math.floor(this.followers.length / 10) * 30);
  }

  comboWindow() { return this.mods.comboGrace ? COMBO.windowSynergy : COMBO.windowSeconds; }

  wideThreshold() {
    return (this.mods.tagCounts.WEAVE || 0) >= 2 ? WISP.wideLoopAreaSynergy : WISP.wideLoopArea;
  }

  haloMax() { return HALO.maxAlive + this.mods.haloMaxBonus; }

  // ---- run / night flow -------------------------------------------------

  startRun() {
    this.score = 0;
    this.glow = GLOW.max;
    this.combo = 0;
    this.comboTimer = 0;
    this.followers = [];
    this.strays = [];
    this.comets = [];
    this.umbras = [];
    this.halos = [];
    this.particles = [];
    this.popups = [];
    this.bolts = [];
    this.boss = null;
    this.trail = [];
    this.history = [];
    this.resetMods();
    this.tutorialStep = 0;
    this.beginNight(1);
  }

  beginNight(n) {
    this.night = n;
    const def = NIGHTS[n - 1];
    this.nightTime = def.seconds;
    this.screen = 'playing';
    this.emberSavedThisNight = false;
    this.umbras = [];
    this.bolts = [];
    this.boss = null;
    this.banner = BANNERS[n];
    this.bannerTimer = 2.6;
    this.timers.stray = 0.4;
    this.timers.comet = Math.max(2, def.cometEvery - 2);
    this.timers.umbra = 5;
    // Opening cluster near the centre so circling scores within seconds.
    this.spawnStrayCluster(640 + this.rng.range(-90, 90), 360 + this.rng.range(-60, 60), 5);
    if (n >= 2) this.spawnStrayCluster(this.rng.range(250, 1030), this.rng.range(200, 520), 4);
  }

  endNight() {
    // Leftover Umbra dissolve in moonbeams for a few points each.
    for (const u of this.umbras) {
      this.addScore(SCORE.dissolve, u.x, u.y, 'dissolved');
      this.burst(u.x, u.y, 12, '#b9a7ff');
    }
    this.umbras = [];
    const bonus = SCORE.nightClearPerNight * this.night;
    this.score += bonus;
    this.bigText = `NIGHT ${this.night} CLEAR  +${bonus}`;
    this.bigTextTimer = 2.2;
    this.soundEvents.push('night');
    if (this.night === 3) {
      this.startBoss('vorath');
    } else if (this.night === 6) {
      this.startBoss('moon');
    } else {
      this.openDraft('night', this.night + 1);
    }
  }

  openDraft(after, pendingNight) {
    this.draftAfter = after;
    this.pendingNight = pendingNight;
    const stacks = this.mods.picks;
    const pool = OMENS.filter((o) => (stacks[o.id] || 0) < 2);
    this.draftCards = this.rng.shuffled(pool).slice(0, 3);
    this.draftTimer = 6;
    this.screen = 'draft';
  }

  pickDraft(index) {
    const card = this.draftCards[index];
    if (!card) return;
    card.apply(this.mods);
    this.mods.picks[card.id] = (this.mods.picks[card.id] || 0) + 1;
    this.mods.tagCounts[card.tag] = (this.mods.tagCounts[card.tag] || 0) + 1;
    if (card.id === 'ember-heart') this.glow = Math.min(GLOW.max, this.glow + 25);
    this.soundEvents.push('draft');
    this.draftCards = [];
    this.beginNight(this.pendingNight);
  }

  synergyFor(tag) {
    const s = SYNERGIES[tag];
    if (!s) return null;
    return (this.mods.tagCounts[tag] || 0) >= s.need ? s : null;
  }

  startBoss(kind) {
    this.screen = 'playing';
    if (kind === 'vorath') {
      this.boss = {
        kind, name: 'VORATH, THE ECLIPSE HOUND', hp: 3, maxHp: 3,
        x: 900, y: 300, vx: -40, vy: 20, radius: 95, speed: 95,
        state: 'prowl', stateTimer: 2.4, sealCooldown: 0, flashTimer: 0,
      };
      this.banner = 'VORATH STIRS…';
    } else {
      this.boss = {
        kind, name: 'THE HOLLOW MOON', hp: 4, maxHp: 4,
        x: 640, y: 150, vx: 55, vy: 0, radius: 120, speed: 55,
        state: 'drift', stateTimer: 3, sealCooldown: 0, flashTimer: 0,
      };
      this.banner = 'THE MOON TURNS HOLLOW…';
    }
    this.bannerTimer = 2.6;
    this.timers = { stray: 1, comet: 5, umbra: 12, bossUmbra: 12, bossComet: 8, bossStray: 5, bossBolt: 4 };
    this.spawnStrayCluster(420, 420, 4);
    this.spawnStrayCluster(860, 430, 4);
  }

  defeatBoss() {
    const b = this.boss;
    this.score += SCORE.bossDefeat;
    this.bigText = `${b.kind === 'vorath' ? 'VORATH UNVEILED' : 'THE MOON IS SEALED'}  +${SCORE.bossDefeat}`;
    this.bigTextTimer = 2.6;
    this.burst(b.x, b.y, 90, '#ffd76a');
    this.burst(b.x, b.y, 60, '#fff3d6');
    this.shake = Math.max(this.shake, 12);
    this.soundEvents.push('bossdown');
    const wasVorath = b.kind === 'vorath';
    this.boss = null;
    this.bolts = [];
    if (wasVorath) {
      this.openDraft('boss1', 4);
    } else {
      this.screen = 'victory';
      this.best = Math.max(this.best, this.score);
    }
  }

  gameOver() {
    this.screen = 'gameover';
    this.best = Math.max(this.best, this.score);
    this.soundEvents.push('over');
  }

  togglePause() {
    if (this.screen === 'playing' || this.screen === 'draft') {
      this.screenBeforePause = this.screen;
      this.screen = 'paused';
    } else if (this.screen === 'paused') {
      this.screen = this.screenBeforePause;
    }
  }

  // ---- spawning -----------------------------------------------------------

  spawnStrayCluster(cx, cy, count) {
    for (let i = 0; i < count; i++) {
      if (this.strays.length + this.umbras.length + this.comets.length >= CAPS.enemies) return;
      this.strays.push({
        id: nextId++, kind: 'stray',
        x: cx + this.rng.range(-70, 70), y: cy + this.rng.range(-50, 50),
        vx: 0, vy: 0, speed: this.rng.range(25, 45),
        phase: this.rng.range(0, Math.PI * 2), haloTime: 0, scale: this.rng.range(0.85, 1.15),
      });
    }
  }

  spawnStray() {
    this.spawnStrayCluster(
      this.rng.range(140, FIELD_W - 140), this.rng.range(150, PLAY_BOTTOM - 60),
      this.rng.int(3, 5),
    );
  }

  spawnComet() {
    const fromLeft = this.rng.chance(0.5);
    const y = this.rng.range(140, 520);
    const speed = this.rng.range(260, 340);
    this.comets.push({
      id: nextId++, kind: 'comet',
      x: fromLeft ? -30 : FIELD_W + 30, y,
      vx: (fromLeft ? 1 : -1) * speed, vy: this.rng.range(-24, 24),
      phase: this.rng.range(0, 6), baseY: y,
    });
    this.popups.push({ x: fromLeft ? 90 : FIELD_W - 90, y: 96, text: 'COMET!', t: 0, life: 1.1, big: false, color: '#7df9ff' });
  }

  spawnUmbra(x, y) {
    if (this.strays.length + this.umbras.length + this.comets.length >= CAPS.enemies) return;
    this.umbras.push({
      id: nextId++, kind: 'umbra',
      x: x ?? this.rng.range(120, FIELD_W - 120), y: y ?? this.rng.range(140, 480),
      vx: 0, vy: 0, speed: this.rng.range(55, 78), radius: 24,
      phase: this.rng.range(0, 6), stun: 0, eaten: 0,
    });
  }

  // ---- scoring / effects --------------------------------------------------

  addScore(base, x, y, label) {
    this.combo = Math.min(COMBO.cap, this.combo + 1);
    this.comboTimer = this.comboWindow();
    this.lastCaptureAt = this.time;
    const mult = 1 + COMBO.perStep * this.combo;
    const pts = Math.round(base * mult);
    this.score += pts;
    this.popups.push({
      x, y, t: 0, life: 1.0, big: false, color: '#ffd76a',
      text: `+${pts} ×${mult.toFixed(1)}${label ? ' ' + label : ''}`,
    });
    return pts;
  }

  burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= CAPS.particles) return;
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(40, 260);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: this.rng.range(0.35, 0.9), size: this.rng.range(1.5, 3.6), color,
      });
    }
  }

  // ---- capture --------------------------------------------------------------

  captureStray(s, viaFollower) {
    this.addScore(SCORE.stray, s.x, s.y, '');
    this.glow = Math.min(GLOW.max, this.glow + GLOW.perStray + this.mods.glowGainBonus);
    this.burst(s.x, s.y, 20, '#ffd76a');
    this.followers.push({ phase: this.rng.range(0, 6), scale: s.scale || 1 });
    this.soundEvents.push('capture');
    if (this.mods.callPull && !viaFollower) {
      for (const other of this.strays) {
        if (other === s) continue;
        const d = Math.sqrt(dist2(other.x, other.y, s.x, s.y));
        if (d > 1 && d < 190) {
          other.x += ((s.x - other.x) / d) * 60;
          other.y += ((s.y - other.y) / d) * 60;
        }
      }
    }
    if (this.tutorialStep === 0) this.tutorialStep = 1;
  }

  captureComet(c) {
    this.addScore(SCORE.comet, c.x, c.y, 'COMET');
    this.burst(c.x, c.y, 26, '#7df9ff');
    this.followers.push({ phase: this.rng.range(0, 6), scale: 1.1 });
    this.soundEvents.push('capture');
  }

  captureUmbra(u) {
    this.addScore(SCORE.umbra, u.x, u.y, 'UMBRA');
    this.glow = Math.min(GLOW.max, this.glow + GLOW.perUmbra);
    this.burst(u.x, u.y, 34, '#b9a7ff');
    this.shake = Math.max(this.shake, 3);
    this.soundEvents.push('umbra');
  }

  closeLoop(poly, area) {
    const centre = polygonCentroid(poly);
    let radius = 0;
    for (const p of poly) radius += Math.sqrt(dist2(p.x, p.y, centre.x, centre.y));
    radius /= poly.length;
    this.flash = 1;
    this.burst(centre.x, centre.y, 26, '#fff3d6');
    this.popups.push({ x: centre.x, y: centre.y - radius - 8, text: 'LOOP!', t: 0, life: 0.8, big: false, color: '#fff3d6' });

    // Halo left behind by the loop.
    this.halos.push({ x: centre.x, y: centre.y, radius, t: 0, life: HALO.lifeSeconds + this.mods.haloLifeBonus });
    while (this.halos.length > this.haloMax()) this.halos.shift();

    const wide = area >= this.wideThreshold();
    this.strays = this.strays.filter((s) => {
      if (pointInPolygon(s.x, s.y, poly)) { this.captureStray(s, false); return false; }
      return true;
    });
    this.comets = this.comets.filter((c) => {
      if (pointInPolygon(c.x, c.y, poly)) { this.captureComet(c); return false; }
      return true;
    });
    this.umbras = this.umbras.filter((u) => {
      if (!pointInPolygon(u.x, u.y, poly)) return true;
      if (wide) { this.captureUmbra(u); return false; }
      // Too small: stagger it and teach the wide-loop rule.
      const dx = u.x - centre.x, dy = u.y - centre.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      u.x += (dx / d) * 46; u.y += (dy / d) * 46;
      u.stun = 1.1;
      if (this.hintSmallLoopShown < 3) {
        this.hintSmallLoopShown++;
        this.popups.push({ x: u.x, y: u.y - 34, text: 'TOO SMALL — GO WIDE!', t: 0, life: 1.4, big: false, color: '#ff5a48' });
      }
      return true;
    });

    const b = this.boss;
    if (b && b.sealCooldown <= 0 && pointInPolygon(b.x, b.y, poly)) {
      b.hp -= 1;
      b.sealCooldown = 1;
      b.flashTimer = 0.5;
      this.addScore(SCORE.bossHit, b.x, b.y - b.radius, 'SEAL');
      this.burst(b.x, b.y, 44, '#ffd76a');
      this.shake = Math.max(this.shake, 9);
      this.hitStop = 0.06;
      this.soundEvents.push('bosshit');
      if (b.kind === 'vorath') { b.speed += 22; b.radius = Math.max(64, b.radius - 9); }
      if (b.hp <= 0) this.defeatBoss();
    }
  }

  checkTrailLoop() {
    const tr = this.trail;
    const n = tr.length;
    if (n < WISP.minLoopSamplesBack + 4) return;
    const head = tr[n - 1];
    // Proximity closure first: the head coming back within a ribbon's
    // width of an older trail point closes the loop. This keeps closure
    // reliable for step-wise movement (autopilots, low frame rates),
    // where the head stops at vertices instead of overshooting them.
    for (let i = 0; i < n - WISP.minLoopSamplesBack; i++) {
      if (dist2(head.x, head.y, tr[i].x, tr[i].y) < 15 * 15) {
        const poly = tr.slice(i);
        const area = polygonArea(poly);
        if (area >= WISP.minLoopArea) {
          this.closeLoop(poly, area);
          this.trail = [this.wispPos()];
        }
        return;
      }
    }
    const a = tr[n - 2], b = tr[n - 1];
    for (let i = 0; i < n - WISP.minLoopSamplesBack - 1; i++) {
      const c = tr[i], d = tr[i + 1];
      if (segmentsCross(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) {
        const poly = tr.slice(i);
        const area = polygonArea(poly);
        if (area >= WISP.minLoopArea) {
          this.closeLoop(poly, area);
          this.trail = [this.wispPos()];
        }
        return;
      }
    }
  }

  wispPos() { return { x: this.wisp.x, y: this.wisp.y }; }

  // ---- damage -----------------------------------------------------------------

  hurt(amount) {
    // Undying Ember synergy: once per night, refill instead of dying.
    if (this.glow - amount <= 0 && (this.mods.tagCounts.EMBER || 0) >= 2 && !this.emberSavedThisNight) {
      this.emberSavedThisNight = true;
      this.glow = 30;
      this.bigText = 'UNDYING EMBER!';
      this.bigTextTimer = 1.6;
      return;
    }
    this.glow -= amount;
    if (this.glow <= 0) {
      this.glow = 0;
      this.gameOver();
    }
  }

  umbraTouch(u) {
    this.hurt(GLOW.umbraHit);
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = Math.max(this.shake, 5);
    this.burst(this.wisp.x, this.wisp.y, 24, '#ff5a48');
    this.soundEvents.push('hurt');
    // Three followers scatter back into wild Strays.
    for (let i = 0; i < 3 && this.followers.length > 0; i++) {
      this.followers.pop();
      this.strays.push({
        id: nextId++, kind: 'stray',
        x: this.wisp.x + this.rng.range(-70, 70), y: this.wisp.y + this.rng.range(-60, 60),
        vx: 0, vy: 0, speed: this.rng.range(25, 45), phase: this.rng.range(0, 6),
        haloTime: 0, scale: 1,
      });
    }
    u.x += (u.x - this.wisp.x) * 1.6;
    u.y += (u.y - this.wisp.y) * 1.6;
    u.stun = 0.8;
  }

  // ---- main update ---------------------------------------------------------------

  update(dt, input) {
    this.time += dt;
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.bigTextTimer > 0) this.bigTextTimer -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    this.updateParticles(dt);
    this.updatePopups(dt);

    if (this.screen === 'title') {
      this.titleOrbit += dt;
      return;
    }
    if (this.screen !== 'playing' && this.screen !== 'draft') return;

    if (this.screen === 'draft') {
      this.draftTimer -= dt;
      if (this.draftTimer <= 0) this.pickDraft(0);
      return;
    }

    if (this.hitStop > 0) { this.hitStop -= dt; return; }

    // Wisp movement: seek the target with a capped speed.
    input.steer(dt);
    const w = this.wisp;
    const dx = input.targetX - w.x;
    const dy = input.targetY - w.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, WISP.maxSpeed * dt * Math.min(1, dist / 60 + 0.35));
    if (dist > 1) {
      w.vx = (dx / dist) * (step / dt);
      w.vy = (dy / dist) * (step / dt);
      w.x += (dx / dist) * step;
      w.y += (dy / dist) * step;
      w.angle = Math.atan2(dy, dx);
    }
    w.x = Math.max(14, Math.min(FIELD_W - 14, w.x));
    w.y = Math.max(PLAY_TOP, Math.min(PLAY_BOTTOM + 40, w.y));

    // Trail sampling by distance.
    const last = this.trail[this.trail.length - 1];
    if (!last || dist2(last.x, last.y, w.x, w.y) >= WISP.trailSampleDist * WISP.trailSampleDist) {
      this.trail.push(this.wispPos());
      while (this.trail.length > this.trailCap()) this.trail.shift();
      this.checkTrailLoop();
    }
    this.history.push(this.wispPos());
    while (this.history.length > 420) this.history.shift();
    if (this.rng.chance(0.5) && this.particles.length < CAPS.particles) {
      this.particles.push({
        x: w.x + this.rng.range(-6, 6), y: w.y + this.rng.range(-6, 6),
        vx: this.rng.range(-14, 14), vy: this.rng.range(-14, 14),
        t: 0, life: 0.5, size: this.rng.range(1, 2.2), color: '#ffd76a',
      });
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updateHalos(dt);
    this.updateStrays(dt);
    this.updateComets(dt);
    this.updateUmbras(dt);
    this.updateBoss(dt);
    this.updateBolts(dt);
    this.checkFollowerCaptures();

    // Idle darkness drain once the grace window lapses.
    if (this.time - this.lastCaptureAt > GLOW.idleGraceSeconds) {
      const rate = this.night === 1 && !this.boss ? GLOW.idleDrainNight1 : GLOW.idleDrain;
      this.hurt(rate * dt);
      if (this.screen !== 'playing') return;
    }

    if (!this.boss) {
      this.runDirector(dt);
      this.nightTime -= dt;
      if (this.nightTime <= 0) {
        this.nightTime = 0;
        this.endNight();
      }
    } else {
      this.runBossDirector(dt);
    }
  }

  runDirector(dt) {
    const def = NIGHTS[this.night - 1];
    this.timers.stray -= dt;
    if (this.timers.stray <= 0) {
      this.timers.stray = def.strayEvery;
      if (this.strays.length < 16) this.spawnStray();
    }
    if (def.cometEvery > 0) {
      this.timers.comet -= dt;
      if (this.timers.comet <= 0) {
        this.timers.comet = def.cometEvery;
        this.spawnComet();
        if (this.night >= 4 && this.rng.chance(0.5)) this.spawnComet();
      }
    }
    const umbraCap = this.night === 1
      ? (this.nightTime < 15 ? 1 : 0)
      : def.umbraMax;
    if (umbraCap > 0 && def.umbraEvery > 0 || (this.night === 1 && this.nightTime < 15)) {
      this.timers.umbra -= dt;
      if (this.timers.umbra <= 0) {
        this.timers.umbra = Math.max(4, def.umbraEvery || 9);
        if (this.umbras.length < umbraCap) {
          this.spawnUmbra();
          if (this.night === 1) this.umbras[this.umbras.length - 1].speed = 42;
        }
      }
    }
  }

  runBossDirector(dt) {
    const b = this.boss;
    if (!b) return;
    if (b.kind === 'vorath') {
      this.timers.bossUmbra -= dt;
      if (this.timers.bossUmbra <= 0) {
        this.timers.bossUmbra = 12;
        if (this.umbras.length < 2) this.spawnUmbra();
      }
      this.timers.bossStray -= dt;
      if (this.timers.bossStray <= 0) {
        this.timers.bossStray = 7;
        if (this.strays.length < 8) this.spawnStray();
      }
    } else {
      this.timers.bossComet -= dt;
      if (this.timers.bossComet <= 0) { this.timers.bossComet = 8; this.spawnComet(); }
      this.timers.bossStray -= dt;
      if (this.timers.bossStray <= 0) {
        this.timers.bossStray = 6;
        if (this.strays.length < 10) this.spawnStray();
      }
      this.timers.bossBolt -= dt;
      if (this.timers.bossBolt <= 0) {
        this.timers.bossBolt = 5;
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(this.wisp.y - b.y, this.wisp.x - b.x) + i * 0.22;
          this.bolts.push({ x: b.x, y: b.y + 60, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, t: 0 });
        }
        this.soundEvents.push('bolt');
      }
    }
  }

  updateHalos(dt) {
    const need = HALO.herdSeconds / this.mods.haloRate;
    for (const h of this.halos) h.t += dt;
    this.halos = this.halos.filter((h) => h.t < h.life);
    const choir = (this.mods.tagCounts.HALO || 0) >= 2;
    for (const h of this.halos) {
      const r = h.radius * (1 - 0.25 * (h.t / h.life));
      this.strays = this.strays.filter((s) => {
        if (dist2(s.x, s.y, h.x, h.y) < r * r) {
          s.haloTime += dt;
          s.x += (h.x - s.x) * dt * 0.8;
          s.y += (h.y - s.y) * dt * 0.8;
          if (s.haloTime >= need) { this.captureStray(s, false); return false; }
        } else {
          s.haloTime = Math.max(0, s.haloTime - dt);
        }
        return true;
      });
      if (choir) {
        for (const u of this.umbras) {
          if (dist2(u.x, u.y, h.x, h.y) < r * r && u.stun <= 0) u.stun = 0.5;
        }
      }
    }
  }

  updateStrays(dt) {
    for (const s of this.strays) {
      let ax = Math.cos(wanderAngle(s.phase, this.time)) * s.speed;
      let ay = Math.sin(wanderAngle(s.phase + 2, this.time)) * s.speed;
      // Flee nearby Umbra.
      for (const u of this.umbras) {
        const d2 = dist2(s.x, s.y, u.x, u.y);
        if (d2 < 90 * 90 && d2 > 1) {
          const d = Math.sqrt(d2);
          ax += ((s.x - u.x) / d) * 130;
          ay += ((s.y - u.y) / d) * 130;
        }
      }
      if (this.mods.magnet) {
        const d2 = dist2(s.x, s.y, this.wisp.x, this.wisp.y);
        if (d2 < 170 * 170 && d2 > 4) {
          const d = Math.sqrt(d2);
          ax += ((this.wisp.x - s.x) / d) * 42;
          ay += ((this.wisp.y - s.y) / d) * 42;
        }
      }
      s.x += ax * dt;
      s.y += ay * dt;
      s.x = Math.max(24, Math.min(FIELD_W - 24, s.x));
      s.y = Math.max(PLAY_TOP + 16, Math.min(PLAY_BOTTOM - 8, s.y));
    }
  }

  updateComets(dt) {
    for (const c of this.comets) {
      c.x += c.vx * dt;
      c.baseY += c.vy * dt;
      c.y = c.baseY + Math.sin(this.time * 3 + c.phase) * 16;
      if (this.rng.chance(0.6) && this.particles.length < CAPS.particles) {
        this.particles.push({
          x: c.x - Math.sign(c.vx) * 14, y: c.y, vx: -c.vx * 0.12, vy: this.rng.range(-12, 12),
          t: 0, life: 0.4, size: 2, color: '#7df9ff',
        });
      }
    }
    this.comets = this.comets.filter((c) => c.x > -60 && c.x < FIELD_W + 60);
  }

  updateUmbras(dt) {
    for (const u of this.umbras) {
      if (u.stun > 0) { u.stun -= dt; continue; }
      let tx = this.wisp.x, ty = this.wisp.y;
      let best = Infinity;
      for (const s of this.strays) {
        const d2 = dist2(u.x, u.y, s.x, s.y);
        if (d2 < best) { best = d2; tx = s.x; ty = s.y; }
      }
      const d = Math.max(1, Math.hypot(tx - u.x, ty - u.y));
      const sp = u.speed + u.eaten * 4;
      u.x += ((tx - u.x) / d) * sp * dt;
      u.y += ((ty - u.y) / d) * sp * dt;
      // Devour a reached Stray.
      if (best < 26 * 26) {
        const prey = this.strays.find((s) => dist2(u.x, u.y, s.x, s.y) < 26 * 26);
        if (prey) {
          this.strays = this.strays.filter((s) => s !== prey);
          u.eaten += 1;
          u.radius = Math.min(38, u.radius + 2);
          this.burst(prey.x, prey.y, 12, '#4b2a7a');
        }
      }
      // Touch the Wisp.
      if (dist2(u.x, u.y, this.wisp.x, this.wisp.y) < (u.radius + 12) * (u.radius + 12)) {
        this.umbraTouch(u);
        if (this.screen !== 'playing') return;
      }
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    if (b.sealCooldown > 0) b.sealCooldown -= dt;
    if (b.flashTimer > 0) b.flashTimer -= dt;
    b.stateTimer -= dt;
    if (b.kind === 'vorath') {
      if (b.state === 'prowl') {
        // Drift toward a prowling offset from the Wisp.
        const tx = this.wisp.x + Math.sin(this.time * 0.6) * 260;
        const ty = this.wisp.y + Math.cos(this.time * 0.45) * 150;
        const d = Math.max(1, Math.hypot(tx - b.x, ty - b.y));
        b.x += ((tx - b.x) / d) * b.speed * dt;
        b.y += ((ty - b.y) / d) * b.speed * dt;
        if (b.stateTimer <= 0) { b.state = 'telegraph'; b.stateTimer = 0.7; }
      } else if (b.state === 'telegraph') {
        if (b.stateTimer <= 0) {
          b.state = 'lunge';
          b.stateTimer = 0.55;
          const d = Math.max(1, Math.hypot(this.wisp.x - b.x, this.wisp.y - b.y));
          b.vx = ((this.wisp.x - b.x) / d) * 430;
          b.vy = ((this.wisp.y - b.y) / d) * 430;
        }
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.stateTimer <= 0) { b.state = 'prowl'; b.stateTimer = this.rng.range(1.8, 2.8); }
      }
      b.x = Math.max(90, Math.min(FIELD_W - 90, b.x));
      b.y = Math.max(120, Math.min(PLAY_BOTTOM - 30, b.y));
      if (dist2(b.x, b.y, this.wisp.x, this.wisp.y) < (b.radius * 0.62 + 12) * (b.radius * 0.62 + 12) && b.state !== 'hitcd') {
        b.state = 'hitcd';
        b.stateTimer = 1.2;
        this.hurt(GLOW.bossHit);
        this.combo = 0;
        this.comboTimer = 0;
        this.shake = Math.max(this.shake, 6);
        this.soundEvents.push('hurt');
      }
      if (b.state === 'hitcd' && b.stateTimer <= 0) { b.state = 'prowl'; b.stateTimer = 2; }
    } else {
      b.x += b.vx * dt;
      if (b.x < 300 || b.x > FIELD_W - 300) b.vx *= -1;
      b.x = Math.max(240, Math.min(FIELD_W - 240, b.x));
      b.y = 150 + Math.sin(this.time * 0.5) * 16;
    }
  }

  updateBolts(dt) {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.t += dt;
      if (dist2(bolt.x, bolt.y, this.wisp.x, this.wisp.y) < 20 * 20) {
        bolt.t = 99;
        this.hurt(GLOW.boltHit);
        this.burst(this.wisp.x, this.wisp.y, 14, '#b9a7ff');
        this.soundEvents.push('hurt');
        if (this.screen !== 'playing') return;
      }
    }
    this.bolts = this.bolts.filter((b) => b.t < 6 && b.x > -30 && b.x < FIELD_W + 30 && b.y < FIELD_H + 30);
  }

  checkFollowerCaptures() {
    if ((this.mods.tagCounts.CALL || 0) < 2) return;
    const pts = this.followerPoints();
    this.strays = this.strays.filter((s) => {
      for (const p of pts) {
        if (dist2(s.x, s.y, p.x, p.y) < 20 * 20) { this.captureStray(s, true); return false; }
      }
      return true;
    });
  }

  // Follower i rides the wisp history at an increasing delay, offset by a
  // gentle sine so the train reads as a sinuous line of stars.
  followerPoints() {
    const pts = [];
    const h = this.history;
    for (let i = 0; i < this.followers.length; i++) {
      const idx = h.length - 1 - (i + 1) * 7;
      const base = idx >= 0 ? h[idx] : this.wispPos();
      pts.push({
        x: base.x + Math.sin(this.time * 3 + i * 0.9) * 7,
        y: base.y + Math.cos(this.time * 2.6 + i * 0.8) * 7,
      });
    }
    return pts;
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
  }

  updatePopups(dt) {
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);
  }

  // Playtest / screenshot hook: set fields directly, with a few conveniences.
  debugSet(partial) {
    for (const [key, value] of Object.entries(partial)) {
      if (key === 'flock') {
        while (this.followers.length < value) this.followers.push({ phase: 0, scale: 1 });
        this.followers.length = value;
      } else if (key === 'boss') {
        this.startBoss(value);
      } else if (key === 'night') {
        this.beginNight(value);
      } else {
        this[key] = value;
      }
    }
    if (partial.glow !== undefined && partial.glow <= 0 && this.screen === 'playing') {
      this.glow = 0;
      this.gameOver();
    }
  }
}
