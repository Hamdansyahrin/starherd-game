// Deterministic screenshot staging for STARHERD.
// ?shot=start|play|action|boss|end&seed=n builds a fixed scene, renders it
// for a few dozen frames, then sets window.__shot = 'ready'. Also exposes
// the window.__starherd debug handle the playtest driver uses.

export function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  const seedRaw = Number(params.get('seed'));
  return {
    shot: params.get('shot'),
    seed: Number.isFinite(seedRaw) && params.get('seed') ? seedRaw : 1,
  };
}

function placeWisp(world, x, y) {
  world.wisp.x = x;
  world.wisp.y = y;
  world.trail = [];
  world.history = [];
}

function circleTrail(world, cx, cy, r, points) {
  // Lay a ribbon trail as a near-closed circle around (cx, cy).
  world.trail = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 * 0.92 - Math.PI / 2;
    world.trail.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const head = world.trail[world.trail.length - 1];
  world.history = world.trail.slice();
  placeWispHead(world, head.x, head.y);
}

function placeWispHead(world, x, y) {
  world.wisp.x = x;
  world.wisp.y = y;
}

function addFollowers(world, n) {
  for (let i = 0; i < n; i++) world.followers.push({ phase: i * 0.8, scale: 1 });
}

export function stageShot(world, mode) {
  world.soundEvents = [];
  if (mode === 'start') {
    world.screen = 'title';
    return;
  }
  if (mode === 'end') {
    world.startRun();
    world.score = 28450;
    world.best = 28450;
    addFollowers(world, 14);
    world.screen = 'victory';
    return;
  }
  if (mode === 'play') {
    world.startRun();
    world.beginNight(2);
    world.score = 3150;
    world.combo = 6;
    world.comboTimer = 3;
    world.nightTime = 31;
    addFollowers(world, 8);
    circleTrail(world, 470, 400, 120, 34);
    world.spawnStrayCluster(760, 300, 4);
    world.spawnStrayCluster(980, 470, 3);
    world.spawnComet();
    const comet = world.comets[world.comets.length - 1];
    if (comet) { comet.x = 760; comet.y = 210; comet.baseY = 210; comet.vx = 300; }
    return;
  }
  if (mode === 'action') {
    world.startRun();
    world.score = 1200;
    world.combo = 4;
    world.comboTimer = 3.2;
    // Four Strays ringed by a closing loop, burst at peak brightness.
    world.strays = [];
    world.spawnStrayCluster(620, 350, 1);
    world.spawnStrayCluster(680, 390, 1);
    world.spawnStrayCluster(590, 420, 1);
    world.spawnStrayCluster(700, 320, 1);
    circleTrail(world, 640, 370, 130, 36);
    world.closeLoop(world.trail.slice(), 48000);
    addFollowers(world, 5);
    circleTrail(world, 640, 370, 130, 36);
    world.flash = 1;
    world.burst(640, 370, 30, '#ffd76a');
    return;
  }
  if (mode === 'boss') {
    world.startRun();
    world.beginNight(3);
    world.startBoss('vorath');
    world.boss.hp = 2;
    world.boss.x = 830;
    world.boss.y = 330;
    world.boss.state = 'prowl';
    world.boss.stateTimer = 99;
    world.score = 8600;
    world.combo = 9;
    world.comboTimer = 3;
    world.bannerTimer = 0;
    addFollowers(world, 10);
    world.spawnUmbra(300, 220);
    world.spawnUmbra(1020, 520);
    world.spawnStrayCluster(430, 470, 3);
    // A wide loop in progress around the hound.
    circleTrail(world, 830, 330, 175, 38);
    return;
  }
  // Unknown mode: leave the title screen up.
  world.screen = 'title';
}

export function installDebugHandle(world) {
  window.__starherd = { world };
}
