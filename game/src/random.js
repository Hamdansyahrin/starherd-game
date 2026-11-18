// Seeded randomness for STARHERD: one mulberry32 stream per run so a
// given ?seed= always deals the same nights, drafts and spawns.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  // Fisher-Yates shuffle driven by this stream; returns a new array.
  shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}

// Smooth wander steering: a cheap value-noise from summed sines keyed by
// an entity's own phase, so Strays drift organically without a noise table.
export function wanderAngle(phase, t) {
  return Math.sin(t * 0.7 + phase) * 1.4 + Math.sin(t * 1.7 + phase * 2.3) * 0.7;
}
