// STARHERD tuning constants: field, palette, nights and the omen pool.
// Everything numeric that balances the game lives here so the simulation
// and the renderer read from one shared table.

export const FIELD_W = 1280;
export const FIELD_H = 720;
export const PLAY_TOP = 64;
export const PLAY_BOTTOM = 648;

export const PALETTE = {
  indigo: '#141433',
  violet: '#2a1e4f',
  deepViolet: '#1d1440',
  aurora: '#37f2c8',
  auroraSoft: '#2bd9a8',
  gold: '#ffd76a',
  warmWhite: '#fff3d6',
  ember: '#ff5a48',
  umbra: '#12081f',
  umbraEdge: '#4b2a7a',
  moonPale: '#f4ead0',
  dawnTop: '#ff9d5c',
  dawnBottom: '#ffe9a8',
};

export const WISP = {
  maxSpeed: 520,
  seek: 14,
  radius: 11,
  baseRibbonWidth: 10,
  baseTrailSamples: 140,
  trailSampleDist: 6,
  minLoopSamplesBack: 25,
  minLoopArea: 2600,
  wideLoopArea: 26000,
  wideLoopAreaSynergy: 18000,
};

export const SCORE = {
  stray: 50,
  comet: 150,
  umbra: 400,
  bossHit: 250,
  bossDefeat: 3000,
  nightClearPerNight: 500,
  dissolve: 100,
};

export const GLOW = {
  max: 100,
  umbraHit: 18,
  bossHit: 22,
  boltHit: 10,
  perStray: 2,
  perUmbra: 8,
  idleDrain: 0.55,
  idleDrainNight1: 0.3,
  idleGraceSeconds: 8,
};

export const COMBO = {
  windowSeconds: 4,
  windowSynergy: 6.5,
  cap: 40,
  perStep: 0.1,
};

export const HALO = {
  lifeSeconds: 6,
  herdSeconds: 0.9,
  maxAlive: 4,
};

export const CAPS = { particles: 700, enemies: 70 };

// Night table: duration, banner name, spawn pacing and Umbra ceiling.
export const NIGHTS = [
  { n: 1, name: 'First Drift', seconds: 45, strayEvery: 2.6, cometEvery: 0, umbraMax: 0, umbraEvery: 0 },
  { n: 2, name: 'The Comets Come', seconds: 50, strayEvery: 2.4, cometEvery: 7, umbraMax: 0, umbraEvery: 0 },
  { n: 3, name: 'Umbra Season', seconds: 50, strayEvery: 2.2, cometEvery: 11, umbraMax: 3, umbraEvery: 9 },
  { n: 4, name: 'The Long Dark', seconds: 50, strayEvery: 2.0, cometEvery: 6, umbraMax: 4, umbraEvery: 8 },
  { n: 5, name: 'Starfall', seconds: 50, strayEvery: 1.5, cometEvery: 5, umbraMax: 4, umbraEvery: 8 },
  { n: 6, name: 'The Hollow Dark', seconds: 50, strayEvery: 1.4, cometEvery: 5.5, umbraMax: 5, umbraEvery: 6.5 },
];

export const BANNERS = {
  1: 'NIGHT 1 — FIRST DRIFT',
  2: 'NIGHT 2 — THE COMETS COME',
  3: 'NIGHT 3 — UMBRA SEASON',
  4: 'NIGHT 4 — THE LONG DARK',
  5: 'NIGHT 5 — STARFALL',
  6: 'NIGHT 6 — THE HOLLOW DARK',
};

// Constellation omens drafted between nights. `apply` mutates world.mods.
export const OMENS = [
  {
    id: 'wide-ribbon', name: 'WIDE RIBBON', tag: 'WEAVE',
    text: 'Ribbon width +5. Bigger loops, easier herding.',
    apply(m) { m.ribbonBonus += 5; },
  },
  {
    id: 'long-tail', name: 'LONG TAIL', tag: 'WEAVE',
    text: 'Trail holds +40 more samples of light.',
    apply(m) { m.trailBonus += 40; },
  },
  {
    id: 'halo-memory', name: 'HALO MEMORY', tag: 'HALO',
    text: 'Echo halos last +3 s and herd 40% faster.',
    apply(m) { m.haloLifeBonus += 3; m.haloRate += 0.4; },
  },
  {
    id: 'second-halo', name: 'SECOND HALO', tag: 'HALO',
    text: 'Keep +2 echo halos alive at once.',
    apply(m) { m.haloMaxBonus += 2; },
  },
  {
    id: 'star-magnet', name: 'STAR MAGNET', tag: 'CALL',
    text: 'Strays within 170 px drift gently toward you.',
    apply(m) { m.magnet = true; },
  },
  {
    id: 'shepherds-call', name: "SHEPHERD'S CALL", tag: 'CALL',
    text: 'Each capture pulls nearby Strays 60 px inward.',
    apply(m) { m.callPull = true; },
  },
  {
    id: 'combo-grace', name: 'COMBO GRACE', tag: 'EMBER',
    text: 'Combo timer stretches from 4 s to 6.5 s.',
    apply(m) { m.comboGrace = true; },
  },
  {
    id: 'ember-heart', name: 'EMBER HEART', tag: 'EMBER',
    text: 'Glow +25 now, and captures restore +0.4 more.',
    apply(m) { m.glowGainBonus += 0.4; },
  },
];

export const SYNERGIES = {
  WEAVE: { need: 2, name: 'Cathedral Ribbon', text: 'Wide-loop Umbra threshold drops to 18000.' },
  HALO: { need: 2, name: 'Choir of Halos', text: 'Halos also stagger Umbra that wander inside.' },
  CALL: { need: 2, name: 'Grand Procession', text: 'Your followers capture Strays they touch.' },
  EMBER: { need: 2, name: 'Undying Ember', text: 'Once per night, Glow at 0 refills to 30 instead.' },
};

export const FONT = '"Trebuchet MS", "Segoe UI", Verdana, system-ui, sans-serif';
