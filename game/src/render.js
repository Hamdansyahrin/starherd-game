// All STARHERD drawing: layered night background (starfield, aurora, moon,
// candle-lit village), entities, juice (particles, popups, shockwaves),
// HUD, and every screen (title, draft, pause, victory, game over).
// Pure canvas paths, gradients, shadowBlur glow and 'lighter' composite.

import { FIELD_W, FIELD_H, PALETTE, FONT, NIGHTS, SYNERGIES } from './config.js';
import { mulberry32 } from './random.js';

// Static scenery generated once from a fixed seed (not the run seed).
const bgRng = mulberry32(20261118);
const STAR_LAYERS = [0, 1, 2].map((layer) => {
  const stars = [];
  const count = [90, 60, 36][layer];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: bgRng() * FIELD_W, y: bgRng() * 560,
      r: 0.7 + layer * 0.7 + bgRng() * 0.8, phase: bgRng() * 6.28, depth: layer,
    });
  }
  return stars;
});
const WINDOWS = [];
for (let i = 0; i < 44; i++) {
  WINDOWS.push({ x: 30 + bgRng() * (FIELD_W - 60), y: 664 + bgRng() * 40, phase: bgRng() * 6.28, speed: 0.3 + bgRng() * 0.9 });
}
const ROOFS = [];
{
  let x = -20;
  while (x < FIELD_W + 20) {
    const wdt = 70 + bgRng() * 90;
    ROOFS.push({ x, w: wdt, h: 26 + bgRng() * 30, spire: bgRng() < 0.14 });
    x += wdt + 6;
  }
}

function starPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', bold = true) {
  ctx.font = `${bold ? '700 ' : '400 '}${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(10,6,30,0.85)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(world, input) {
    const ctx = this.ctx;
    ctx.save();
    if (world.shake > 0) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    if (world.screen === 'victory') this.drawDawn(world);
    else this.drawBackground(world);
    if (world.screen === 'title') {
      this.drawTitleScene(world);
      this.drawTitle(world);
    } else {
      this.drawHalos(world);
      this.drawTrail(world);
      this.drawStrays(world);
      this.drawComets(world);
      this.drawUmbras(world);
      this.drawBoss(world);
      this.drawBolts(world);
      this.drawFollowers(world);
      this.drawWisp(world);
      this.drawParticles(world);
      this.drawPopups(world);
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(255,240,200,${world.flash * 0.22})`;
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
      }
      this.drawHud(world);
      if (world.screen === 'draft') this.drawDraft(world);
      if (world.screen === 'paused') this.drawPaused(world);
      if (world.screen === 'gameover') this.drawGameOver(world);
      if (world.screen === 'victory') this.drawVictory(world);
    }
    // Low-glow vignette pulse.
    if ((world.screen === 'playing') && world.glow < 30) {
      const a = 0.16 + 0.1 * Math.sin(world.time * 5);
      const g = ctx.createRadialGradient(640, 360, 300, 640, 360, 720);
      g.addColorStop(0, 'rgba(60,0,10,0)');
      g.addColorStop(1, `rgba(60,0,10,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    }
    ctx.restore();
  }

  drawBackground(world) {
    const ctx = this.ctx;
    const t = world.time;
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, PALETTE.indigo);
    g.addColorStop(0.55, PALETTE.deepViolet);
    g.addColorStop(1, PALETTE.violet);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    // Parallax starfield with twinkle.
    for (const layer of STAR_LAYERS) {
      for (const s of layer) {
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.5 + s.depth * 0.3) + s.phase));
        ctx.globalAlpha = tw * (0.4 + s.depth * 0.3);
        ctx.fillStyle = PALETTE.warmWhite;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Aurora ribbons: two additive sine bands.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [baseY, amp, col, alpha] of [[120, 34, '55,242,200', 0.10], [180, 26, '90,140,255', 0.07]]) {
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= FIELD_W; x += 32) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.006 + t * 0.35) * amp + Math.sin(x * 0.017 - t * 0.2) * 10);
      }
      for (let x = FIELD_W; x >= 0; x -= 32) {
        ctx.lineTo(x, baseY + 64 + Math.sin(x * 0.006 + t * 0.35 + 1) * amp);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${col},${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // The moon, top-right (hidden while the Hollow Moon boss is out).
    if (!world.boss || world.boss.kind !== 'moon') {
      const mx = 1090, my = 118, mr = 62;
      const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
      halo.addColorStop(0, 'rgba(244,234,208,0.30)');
      halo.addColorStop(1, 'rgba(244,234,208,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      ctx.fillStyle = PALETTE.moonPale;
      ctx.shadowColor = 'rgba(244,234,208,0.8)';
      ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(190,175,150,0.5)';
      for (const [cx, cy, cr] of [[-18, -10, 11], [16, 14, 8], [22, -22, 6], [-4, 26, 7]]) {
        ctx.beginPath(); ctx.arc(mx + cx, my + cy, cr, 0, 6.283); ctx.fill();
      }
    }

    this.drawVillage(world);
  }

  drawVillage(world) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0b0820';
    ctx.beginPath();
    ctx.moveTo(0, FIELD_H);
    for (const r of ROOFS) {
      ctx.lineTo(r.x, 700 - r.h);
      ctx.lineTo(r.x + r.w / 2, 678 - r.h);
      ctx.lineTo(r.x + r.w, 700 - r.h);
      ctx.lineTo(r.x + r.w, FIELD_H);
      ctx.lineTo(r.x, FIELD_H);
    }
    ctx.lineTo(FIELD_W, FIELD_H);
    ctx.closePath();
    ctx.fill();
    // Church spire.
    ctx.fillStyle = '#0b0820';
    ctx.beginPath();
    ctx.moveTo(596, 700); ctx.lineTo(618, 606); ctx.lineTo(640, 700); ctx.closePath(); ctx.fill();
    ctx.fillRect(614, 596, 8, 16);
    // Candle windows twinkling.
    for (const win of WINDOWS) {
      const on = Math.sin(world.time * win.speed + win.phase) > -0.25;
      ctx.fillStyle = on ? 'rgba(255,190,90,0.95)' : 'rgba(255,190,90,0.18)';
      ctx.fillRect(win.x, win.y, 5, 7);
    }
  }

  drawDawn(world) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, '#3a2a6e');
    g.addColorStop(0.5, PALETTE.dawnTop);
    g.addColorStop(1, PALETTE.dawnBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(640, 640, 10, 640, 640, 420);
    sun.addColorStop(0, 'rgba(255,250,220,0.95)');
    sun.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(220, 220, 840, 500);
    ctx.restore();
    this.drawVillage(world);
  }

  drawHalos(world) {
    const ctx = this.ctx;
    for (const h of world.halos) {
      const frac = h.t / h.life;
      const r = h.radius * (1 - 0.25 * frac);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,215,106,${0.55 * (1 - frac) + 0.1})`;
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(255,215,106,0.8)';
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = `rgba(255,243,214,${0.25 * (1 - frac)})`;
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
  }

  drawTrail(world) {
    const ctx = this.ctx;
    const tr = world.trail;
    if (tr.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const width = world.ribbonWidth();
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.moveTo(tr[0].x, tr[0].y);
      for (let i = 1; i < tr.length; i++) ctx.lineTo(tr[i].x, tr[i].y);
      if (pass === 0) {
        ctx.strokeStyle = 'rgba(255,170,60,0.35)';
        ctx.lineWidth = width + 9;
        ctx.shadowColor = 'rgba(255,190,80,0.9)';
        ctx.shadowBlur = 18;
      } else {
        const grad = ctx.createLinearGradient(tr[0].x, tr[0].y, world.wisp.x, world.wisp.y);
        grad.addColorStop(0, 'rgba(255,190,80,0.55)');
        grad.addColorStop(1, '#fff3d6');
        ctx.strokeStyle = grad;
        ctx.lineWidth = width;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStrays(world) {
    const ctx = this.ctx;
    for (const s of world.strays) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(255,215,106,0.95)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = s.haloTime > 0.1 ? '#ffffff' : PALETTE.gold;
      starPath(ctx, s.x, s.y, 9 * (s.scale || 1), world.time * 1.5 + s.phase);
      ctx.fill();
      ctx.restore();
    }
  }

  drawComets(world) {
    const ctx = this.ctx;
    for (const c of world.comets) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dir = Math.sign(c.vx);
      const grad = ctx.createLinearGradient(c.x - dir * 74, c.y, c.x, c.y);
      grad.addColorStop(0, 'rgba(125,249,255,0)');
      grad.addColorStop(1, 'rgba(125,249,255,0.85)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(c.x - dir * 74, c.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      ctx.shadowColor = 'rgba(125,249,255,1)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#eaffff';
      starPath(ctx, c.x, c.y, 10, world.time * 4);
      ctx.fill();
      ctx.restore();
    }
  }

  drawUmbras(world) {
    const ctx = this.ctx;
    for (const u of world.umbras) {
      ctx.save();
      ctx.fillStyle = PALETTE.umbra;
      ctx.strokeStyle = PALETTE.umbraEdge;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283 + u.phase;
        const rr = u.radius * (0.72 + 0.16 * Math.sin(world.time * 3 + i * 1.7));
        ctx.beginPath();
        ctx.arc(u.x + Math.cos(a) * u.radius * 0.34, u.y + Math.sin(a) * u.radius * 0.34, rr, 0, 6.283);
        ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(u.x, u.y, u.radius * 0.92, 0, 6.283); ctx.fill();
      // Ember eyes track the wisp.
      const ea = Math.atan2(world.wisp.y - u.y, world.wisp.x - u.x);
      ctx.fillStyle = u.stun > 0 ? '#ffb0a0' : PALETTE.ember;
      ctx.shadowColor = PALETTE.ember;
      ctx.shadowBlur = 10;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(u.x + Math.cos(ea) * 6 + side * 8, u.y + Math.sin(ea) * 4 - 3, 3.4, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      if (u.stun > 0) text(ctx, '✦', u.x, u.y - u.radius - 12, 16, '#b9a7ff');
    }
  }

  drawBoss(world) {
    const b = world.boss;
    if (!b) return;
    const ctx = this.ctx;
    ctx.save();
    if (b.kind === 'vorath') {
      const flash = b.flashTimer > 0 || b.state === 'telegraph';
      ctx.translate(b.x, b.y);
      const s = b.radius / 95;
      ctx.scale(b.vx >= 0 || b.state === 'lunge' ? s : s, s);
      ctx.fillStyle = flash && b.state === 'telegraph' ? '#2c1247' : PALETTE.umbra;
      ctx.strokeStyle = PALETTE.umbraEdge;
      ctx.lineWidth = 3;
      // Body, head, ears, legs, tail — a prowling hound silhouette.
      ctx.beginPath(); ctx.ellipse(0, 0, 96, 46, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(88, -18, 40, 27, 0.3, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(66, -40); ctx.lineTo(78, -74); ctx.lineTo(94, -42); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(96, -38); ctx.lineTo(114, -66); ctx.lineTo(118, -32); ctx.closePath(); ctx.fill();
      ctx.fillRect(-70, 30, 15, 44); ctx.fillRect(46, 30, 15, 44);
      ctx.fillRect(-34, 34, 13, 38); ctx.fillRect(74, 28, 13, 40);
      ctx.beginPath();
      ctx.moveTo(-94, -8); ctx.quadraticCurveTo(-140, -30, -128, -66); ctx.lineTo(-112, -64);
      ctx.quadraticCurveTo(-116, -34, -84, -20); ctx.closePath(); ctx.fill();
      // Veil bands: one gold slash per veil remaining.
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 5;
      for (let i = 0; i < b.hp; i++) {
        ctx.beginPath(); ctx.moveTo(-50 + i * 34, -40); ctx.lineTo(-28 + i * 34, 38); ctx.stroke();
      }
      // Eyes.
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.ember;
      ctx.shadowColor = PALETTE.ember; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(96, -24, 6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(116, -16, 5, 0, 6.283); ctx.fill();
    } else {
      // The Hollow Moon: a cracked pale disc with a face.
      ctx.translate(b.x, b.y);
      const r = 60 + b.hp * 15;
      const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.4);
      halo.addColorStop(0, 'rgba(185,167,255,0.35)');
      halo.addColorStop(1, 'rgba(185,167,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(-r * 2.5, -r * 2.5, r * 5, r * 5);
      ctx.fillStyle = b.flashTimer > 0 ? '#ffffff' : '#ddd3f5';
      ctx.shadowColor = 'rgba(185,167,255,0.9)'; ctx.shadowBlur = 26;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      // Cracks: one jagged seam per crack remaining.
      ctx.strokeStyle = '#241543';
      ctx.lineWidth = 4;
      for (let i = 0; i < b.hp; i++) {
        const a = (i / Math.max(1, b.hp)) * 6.283 + 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        ctx.lineTo(Math.cos(a + 0.3) * r * 0.6, Math.sin(a + 0.3) * r * 0.6);
        ctx.lineTo(Math.cos(a - 0.2) * r * 0.95, Math.sin(a - 0.2) * r * 0.95);
        ctx.stroke();
      }
      // Hollow face.
      ctx.fillStyle = '#241543';
      ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.12, r * 0.13, r * 0.2, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.32, -r * 0.12, r * 0.13, r * 0.2, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, r * 0.38, r * 0.24, r * 0.13, 0, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  drawBolts(world) {
    const ctx = this.ctx;
    for (const bolt of world.bolts) {
      ctx.save();
      ctx.fillStyle = '#1a0f33';
      ctx.strokeStyle = '#b9a7ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#b9a7ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bolt.x, bolt.y, 9, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  drawFollowers(world) {
    const ctx = this.ctx;
    const pts = world.followerPoints();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length; i++) {
      ctx.shadowColor = 'rgba(255,215,106,0.9)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = i % 3 === 0 ? '#fff3d6' : PALETTE.gold;
      starPath(ctx, pts[i].x, pts[i].y, 6.5, world.time * 2 + i);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWisp(world) {
    const ctx = this.ctx;
    const w = world.wisp;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Combo timer arc.
    if (world.combo > 0 && world.comboTimer > 0) {
      ctx.strokeStyle = 'rgba(255,215,106,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w.x, w.y, 22, -Math.PI / 2, -Math.PI / 2 + 6.283 * (world.comboTimer / world.comboWindow()));
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(w.x, w.y, 2, w.x, w.y, 40);
    glow.addColorStop(0, 'rgba(255,246,220,0.95)');
    glow.addColorStop(0.35, 'rgba(255,215,106,0.55)');
    glow.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(w.x - 42, w.y - 42, 84, 84);
    ctx.fillStyle = '#fffbe9';
    ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 20;
    starPath(ctx, w.x, w.y, 12, world.time * 2.4);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of world.particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawPopups(world) {
    const ctx = this.ctx;
    for (const p of world.popups) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      text(ctx, p.text, p.x, p.y - p.t * 34, p.big ? 30 : 17, p.color);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(world) {
    const ctx = this.ctx;
    text(ctx, 'SCORE', 26, 30, 15, 'rgba(255,243,214,0.75)', 'left');
    text(ctx, String(world.score), 24, 62, 42, PALETTE.warmWhite, 'left');
    text(ctx, `FLOCK ${world.flock}`, 26, 98, 19, PALETTE.gold, 'left');
    if (world.combo > 1) {
      text(ctx, `COMBO ×${(1 + 0.1 * world.combo).toFixed(1)}`, 26, 124, 19, '#7df9ff', 'left');
    }
    // Night + time bar, top centre.
    if (world.boss) {
      text(ctx, world.boss.name, 640, 30, 21, '#ffb0a0');
      for (let i = 0; i < world.boss.maxHp; i++) {
        ctx.save();
        ctx.fillStyle = i < world.boss.hp ? PALETTE.gold : 'rgba(255,255,255,0.18)';
        ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = i < world.boss.hp ? 8 : 0;
        starPath(ctx, 640 + (i - (world.boss.maxHp - 1) / 2) * 30, 58, 9, 0.4);
        ctx.fill();
        ctx.restore();
      }
    } else if (world.screen === 'playing' || world.screen === 'draft' || world.screen === 'paused') {
      text(ctx, `NIGHT ${world.night} — ${NIGHTS[world.night - 1].name.toUpperCase()}`, 640, 30, 20, PALETTE.warmWhite);
      const def = NIGHTS[world.night - 1];
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(490, 48, 300, 8);
      ctx.fillStyle = PALETTE.aurora;
      ctx.fillRect(490, 48, 300 * Math.max(0, world.nightTime / def.seconds), 8);
    }
    // Glow bar, top right.
    text(ctx, 'GLOW', 1254, 26, 15, 'rgba(255,243,214,0.75)', 'right');
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(1054, 38, 200, 16);
    const gg = ctx.createLinearGradient(1054, 0, 1254, 0);
    gg.addColorStop(0, '#ff5a48');
    gg.addColorStop(0.5, '#ffb35c');
    gg.addColorStop(1, '#ffd76a');
    ctx.fillStyle = gg;
    if (world.glow < 30) { ctx.shadowColor = '#ff5a48'; ctx.shadowBlur = 12; }
    ctx.fillRect(1054, 38, 200 * Math.max(0, world.glow / 100), 16);
    ctx.shadowBlur = 0;

    if (world.bannerTimer > 0 && world.banner) {
      ctx.globalAlpha = Math.min(1, world.bannerTimer);
      text(ctx, world.banner, 640, 150, 40, PALETTE.warmWhite);
      ctx.globalAlpha = 1;
    }
    if (world.bigTextTimer > 0 && world.bigText) {
      ctx.globalAlpha = Math.min(1, world.bigTextTimer);
      text(ctx, world.bigText, 640, 210, 34, PALETTE.gold);
      ctx.globalAlpha = 1;
    }
    if (world.screen === 'playing' && world.night === 1 && !world.boss) {
      if (world.tutorialStep === 0) {
        text(ctx, 'FLY A LOOP AROUND THE STRAYS!', 640, 640, 22, '#7df9ff');
      } else {
        text(ctx, 'WIDE LOOPS CATCH UMBRA', 640, 640, 19, 'rgba(255,243,214,0.8)');
      }
    }
    text(ctx, 'P pause · M mute', 1254, 700, 13, 'rgba(255,243,214,0.5)', 'right', false);
  }

  drawTitleScene(world) {
    const ctx = this.ctx;
    // The Wisp orbits with a flock train behind it.
    const cx = 640, cy = 400, r = 130;
    const a = world.titleOrbit * 0.9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,215,106,0.30)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const fa = a - i * 0.16;
      ctx.fillStyle = i % 2 ? PALETTE.gold : '#fff3d6';
      ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 12;
      starPath(ctx, cx + Math.cos(fa) * r, cy + Math.sin(fa) * r * 0.82, 7, fa * 3);
      ctx.fill();
    }
    ctx.fillStyle = '#fffbe9';
    ctx.shadowBlur = 22;
    starPath(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82, 14, a * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTitle(world) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(255,215,106,0.85)';
    ctx.shadowBlur = 34;
    text(ctx, 'STARHERD', 640, 168, 92, PALETTE.gold);
    ctx.restore();
    text(ctx, 'a shepherd-wisp herding tale', 640, 226, 21, PALETTE.warmWhite, 'center', false);
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'ENTER / CLICK — BEGIN THE HERD', 640, 566, 26, '#7df9ff');
    ctx.globalAlpha = 1;
    text(ctx, 'Loop your light around lost stars. Wide loops catch Umbra. Survive six nights.', 640, 606, 18, PALETTE.warmWhite, 'center', false);
    text(ctx, 'Mouse or WASD / arrows to fly · P pause · M mute', 640, 634, 15, 'rgba(255,243,214,0.65)', 'center', false);
  }

  drawDraft(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,6,28,0.72)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    text(ctx, 'THE STARS OFFER AN OMEN', 640, 128, 36, PALETTE.gold);
    text(ctx, `choose 1 · 2 · 3 or click — auto-pick in ${Math.max(0, world.draftTimer).toFixed(0)} s`, 640, 164, 17, PALETTE.warmWhite, 'center', false);
    world.draftCards.forEach((card, i) => {
      const x = 240 + i * 400;
      const y = 360;
      ctx.save();
      ctx.fillStyle = 'rgba(42,30,79,0.96)';
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255,215,106,0.5)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(x - 168, y - 140, 336, 280, 18);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      starPath(ctx, x, y - 96, 15, i * 1.3);
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
      text(ctx, card.name, x, y - 52, 24, PALETTE.warmWhite);
      text(ctx, `[ ${card.tag} ]`, x, y - 20, 15, '#7df9ff');
      this.wrapText(card.text, x, y + 22, 280, 20, PALETTE.warmWhite);
      const syn = world.synergyFor(card.tag);
      const nextCount = (world.mods.tagCounts[card.tag] || 0) + 1;
      if (syn) {
        text(ctx, `SYNERGY: ${syn.name}`, x, y + 96, 14, PALETTE.gold);
      } else if (nextCount >= SYNERGIES[card.tag].need) {
        text(ctx, `COMPLETES: ${SYNERGIES[card.tag].name}`, x, y + 96, 14, '#7df9ff');
      }
      text(ctx, `press ${i + 1}`, x, y + 122, 14, 'rgba(255,243,214,0.6)', 'center', false);
    });
  }

  wrapText(str, x, y, maxWidth, size, color) {
    const ctx = this.ctx;
    ctx.font = `400 ${size}px ${FONT}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((ln, i) => text(ctx, ln, x, y + i * (size + 5), size, color, 'center', false));
  }

  drawPaused(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,6,28,0.66)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    text(ctx, 'PAUSED', 640, 320, 54, PALETTE.warmWhite);
    text(ctx, 'P or Esc — resume', 640, 372, 20, PALETTE.gold, 'center', false);
  }

  drawGameOver(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,4,20,0.78)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    text(ctx, 'THE LIGHT GOES OUT', 640, 268, 52, '#ffb0a0');
    text(ctx, `FINAL SCORE  ${world.score}`, 640, 336, 32, PALETTE.warmWhite);
    text(ctx, `BEST  ${world.best}   ·   NIGHT ${world.night}   ·   FLOCK ${world.flock}`, 640, 378, 20, PALETTE.gold, 'center', false);
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'ENTER — HERD AGAIN', 640, 446, 26, '#7df9ff');
    ctx.globalAlpha = 1;
  }

  drawVictory(world) {
    const ctx = this.ctx;
    text(ctx, 'DAWN BREAKS', 640, 240, 64, '#fffbe9');
    text(ctx, 'The Hollow Moon is sealed and the valley wakes.', 640, 300, 22, '#2a1e4f', 'center', false);
    text(ctx, `FINAL SCORE  ${world.score}`, 640, 356, 34, '#2a1e4f');
    text(ctx, `FLOCK ${world.flock} · BEST ${world.best}`, 640, 398, 20, '#2a1e4f', 'center', false);
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 3);
    ctx.globalAlpha = pulse;
    text(ctx, 'ENTER — PLAY AGAIN', 640, 470, 26, '#2a1e4f');
    ctx.globalAlpha = 1;
  }
}
