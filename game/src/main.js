// STARHERD boot and main loop: builds the world, wires input events to
// screen changes, steps the simulation with a clamped fixed timestep,
// drains the tiny WebAudio synth, and renders every frame.

import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { parseQuery, stageShot, installDebugHandle } from './shots.js';

const canvas = document.getElementById('game');
const { shot, seed } = parseQuery();
const world = new World(seed);
const input = new Input(canvas);
const renderer = new Renderer(canvas);
installDebugHandle(world);

if (shot) {
  stageShot(world, shot);
}

// --- tiny WebAudio synth (created lazily on first gesture, fully guarded)
let audioCtx = null;
let audioBroken = false;
function ensureAudio() {
  if (audioCtx || audioBroken) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { audioBroken = true; return; }
    audioCtx = new AC();
  } catch {
    audioBroken = true;
  }
}

function tone(freq, dur, type, gain, when = 0) {
  if (!audioCtx || world.muted) return;
  try {
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    audioBroken = true;
  }
}

function playSounds() {
  if (!world.soundEvents.length) return;
  const events = world.soundEvents.splice(0, world.soundEvents.length);
  if (!audioCtx || world.muted) return;
  for (const ev of events) {
    if (ev === 'capture') tone(520 + world.combo * 28, 0.12, 'sine', 0.08);
    else if (ev === 'umbra') tone(110, 0.3, 'triangle', 0.16);
    else if (ev === 'hurt') tone(180, 0.18, 'sawtooth', 0.07);
    else if (ev === 'bolt') tone(240, 0.14, 'square', 0.04);
    else if (ev === 'bosshit') { tone(82, 0.4, 'sine', 0.22); tone(660, 0.2, 'sine', 0.08, 0.03); }
    else if (ev === 'bossdown') { tone(65, 0.7, 'sine', 0.24); tone(880, 0.4, 'sine', 0.1, 0.08); }
    else if (ev === 'night') { tone(523, 0.16, 'sine', 0.09); tone(659, 0.16, 'sine', 0.09, 0.1); tone(784, 0.24, 'sine', 0.09, 0.2); }
    else if (ev === 'draft') tone(740, 0.14, 'sine', 0.08);
    else if (ev === 'over') tone(196, 0.5, 'triangle', 0.12);
  }
}

// --- input routing -------------------------------------------------------

function handleEvent(ev) {
  ensureAudio();
  if (ev === 'mute') { world.muted = !world.muted; return; }
  if (ev === 'pause') {
    if (world.screen === 'playing' || world.screen === 'draft' || world.screen === 'paused') {
      world.togglePause();
    }
    return;
  }
  if (ev === 'press') {
    if (world.screen === 'title' || world.screen === 'gameover' || world.screen === 'victory') {
      world.startRun();
    }
    return;
  }
  if (ev.startsWith('pick') && world.screen === 'draft') {
    world.pickDraft(Number(ev.slice(4)));
  }
}

function handleClicks() {
  for (const click of input.drainClicks()) {
    ensureAudio();
    if (world.screen === 'draft') {
      world.draftCards.forEach((card, i) => {
        const x = 240 + i * 400;
        if (Math.abs(click.x - x) < 168 && Math.abs(click.y - 360) < 140) {
          world.pickDraft(i);
        }
      });
    } else if (world.screen === 'paused') {
      world.togglePause();
    }
  }
}

// --- loop -----------------------------------------------------------------

let last = performance.now();
let shotFrames = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  for (const ev of input.drainEvents()) handleEvent(ev);
  handleClicks();

  // Fixed-step simulation, at most 4 steps per frame.
  let steps = Math.max(1, Math.round(dt / STEP));
  if (steps > 4) steps = 4;
  for (let i = 0; i < steps; i++) world.update(STEP, input);
  playSounds();
  renderer.draw(world, input);

  if (shot && window.__shot !== 'ready') {
    shotFrames++;
    if (shotFrames >= 30) window.__shot = 'ready';
  }
}

requestAnimationFrame(frame);
