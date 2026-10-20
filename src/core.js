/* Drowned Light — core helpers: math, deterministic noise, input, sound. */
"use strict";
window.DL = window.DL || {};
(function (DL) {
  const TAU = Math.PI * 2;

  Object.assign(DL, {
    TAU,
    SEED: 1937,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    angleDiff(a, b) {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU;
      else if (d < -Math.PI) d += TAU;
      return d;
    },
    fmtTime(s) {
      s = Math.max(0, Math.ceil(s));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    },
    // Weighted pick from {key: weight}; r in [0,1).
    weighted(table, r = Math.random()) {
      let total = 0;
      for (const k in table) total += table[k];
      let x = r * total;
      for (const k in table) {
        x -= table[k];
        if (x < 0) return k;
      }
      return Object.keys(table)[0];
    },
  });

  // Deterministic hash in [0,1) so the world is the same every visit.
  DL.hash = function (x, y, s = 0) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s + DL.SEED) | 0, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };

  DL.noise = function (x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = DL.hash(xi, yi, s), b = DL.hash(xi + 1, yi, s), c = DL.hash(xi, yi + 1, s), d = DL.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  DL.fbm = (x, y, s = 0) =>
    DL.noise(x, y, s) * 0.55 + DL.noise(x * 2.1, y * 2.1, s + 7) * 0.3 + DL.noise(x * 4.3, y * 4.3, s + 13) * 0.15;

  /* ---------------- Input ---------------- */
  const Input = (DL.Input = {
    keys: new Set(),
    actions: new Set(),
    joy: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    touch: false,

    init() {
      const keymap = {
        " ": "dash", shift: "dash", q: "ability", e: "ability",
        f: "torch", t: "torch", c: "camp", escape: "pause", p: "pause",
      };
      addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(k);
        if (keymap[k]) this.actions.add(keymap[k]);
      });
      addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
      addEventListener("blur", () => this.keys.clear());

      // Floating joystick: touch anywhere on the left side of the screen.
      const zone = document.getElementById("touchzone");
      const base = document.getElementById("joy");
      const knob = document.getElementById("joyKnob");
      const R = 52;
      const move = (e) => {
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
        this.joy.x = dx / R;
        this.joy.y = dy / R;
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      };
      zone.addEventListener("pointerdown", (e) => {
        if (this.joy.id !== null) return;
        e.preventDefault();
        if (e.pointerType === "touch") this.touch = true;
        this.joy.id = e.pointerId;
        this.joy.ox = e.clientX;
        this.joy.oy = e.clientY;
        zone.setPointerCapture(e.pointerId);
        base.style.left = e.clientX + "px";
        base.style.top = e.clientY + "px";
        base.classList.remove("hidden");
        move(e);
      });
      zone.addEventListener("pointermove", (e) => { if (e.pointerId === this.joy.id) move(e); });
      const end = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.joy.id = null;
        this.joy.x = this.joy.y = 0;
        knob.style.transform = "";
        base.classList.add("hidden");
      };
      zone.addEventListener("pointerup", end);
      zone.addEventListener("pointercancel", end);
      addEventListener("touchstart", () => { this.touch = true; document.body.classList.add("touch"); }, { once: true, passive: true });
    },

    trigger(a) { this.actions.add(a); },
    take(a) {
      if (this.actions.has(a)) { this.actions.delete(a); return true; }
      return false;
    },
    clear() { this.actions.clear(); },

    axis() {
      let x = this.joy.x, y = this.joy.y;
      const k = this.keys;
      if (k.has("d") || k.has("arrowright")) x += 1;
      if (k.has("a") || k.has("arrowleft")) x -= 1;
      if (k.has("s") || k.has("arrowdown")) y += 1;
      if (k.has("w") || k.has("arrowup")) y -= 1;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y, m: Math.min(1, m) };
    },
  });

  /* ---------------- Sound (tiny WebAudio synth, no files) ---------------- */
  DL.Sound = {
    ctx: null,
    muted: false,
    last: {},
    init() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(f, d = 0.1, type = "sine", v = 0.12, slide = 0, delay = 0) {
      const c = this.ctx;
      if (!c || this.muted) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + d + 0.05);
    },
    noise(d = 0.15, v = 0.15, freq = 1200, delay = 0) {
      const c = this.ctx;
      if (!c || this.muted) return;
      const t = c.currentTime + delay;
      const len = Math.ceil(c.sampleRate * d);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf;
      f.type = "bandpass";
      f.frequency.value = freq;
      g.gain.value = v;
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
    },
    play(name) {
      const now = performance.now();
      if (this.last[name] && now - this.last[name] < 45) return;
      this.last[name] = now;
      switch (name) {
        case "swing": this.noise(0.09, 0.1, 2600); break;
        case "hit": this.noise(0.07, 0.16, 700); this.tone(150, 0.08, "square", 0.05, -60); break;
        case "kill": this.noise(0.25, 0.12, 500); this.tone(320, 0.3, "sine", 0.05, -220); break;
        case "hurt": this.tone(200, 0.22, "sawtooth", 0.09, -110); break;
        case "pickup": this.tone(660, 0.07, "triangle", 0.08); this.tone(990, 0.1, "triangle", 0.07, 0, 0.06); break;
        case "dash": this.noise(0.18, 0.12, 900); break;
        case "ability": this.tone(330, 0.5, "triangle", 0.1, 500); this.noise(0.4, 0.08, 3000); break;
        case "build": this.tone(220, 0.12, "square", 0.06); this.tone(330, 0.15, "square", 0.06, 0, 0.1); this.tone(440, 0.25, "triangle", 0.07, 0, 0.2); break;
        case "night": this.tone(98, 2.2, "sine", 0.16); this.tone(147, 1.8, "sine", 0.07, 0, 0.05); break;
        case "dawn": [523, 659, 784].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.06, 0, i * 0.15)); break;
        case "whisper": this.noise(0.8, 0.05, 400); this.tone(70, 0.9, "sine", 0.08, -20); break;
        case "death": this.tone(130, 2.2, "sawtooth", 0.08, -90); this.noise(1.6, 0.08, 300); break;
        case "arrow": this.noise(0.12, 0.07, 3500); break;
        case "torch": this.noise(0.3, 0.1, 1500); this.tone(500, 0.2, "triangle", 0.04); break;
        case "flameHit": this.noise(0.2, 0.12, 400); break;
        case "deny": this.tone(140, 0.12, "square", 0.05); break;
      }
    },
  };
})(window.DL);
