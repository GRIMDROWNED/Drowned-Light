/* Drowned Light — smoother motion for the drawn units, all in code and all for show (nothing here
   touches gameplay). Art.drawUnit (src/units.js) passes a unit here when its caller names it with
   opt.body, and gets back how to draw it this frame:
     - facing: a little give before switching between the side, front and back views, so a unit
       walking on a diagonal doesn't flicker between them, and a quick squeeze-and-flip when it
       turns from left to right instead of snapping to the mirror image;
     - frame blending: the last frame fades out under the new one, so poses run into each other;
     - squash and stretch: a crouch before a blow and a reach into it, a stretch along a dash, a
       squash when struck, landing from a dash or stopping, and a slow breath when standing;
     - lean: the body tips into its run and into its swing, and settles back.
   Each unit's state lives in a WeakMap keyed by its object, so it goes when the unit does. */
"use strict";
(function (DL) {
  const M = (DL.Motion = {});
  const states = new WeakMap();
  const TURN = 0.11; // seconds for a left/right turn
  const K = 320, D = 17; // squash spring stiffness and damping: one quick bounce, then still

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (v, to, rate, dt) => v + (to - v) * Math.min(1, rate * dt);
  const now = () => (DL.Game && DL.Game.t) || performance.now() / 1000;

  // Front, back or side, keeping the current view until the facing is clearly past the line between them.
  function viewOf(st, angle) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    const side = st && st.dir === "side" ? Math.abs(cx) > 0.6 : Math.abs(cx) > 0.84;
    if (side) return { dir: "side", flip: cx < 0 };
    return { dir: cy > 0 ? "down" : "up", flip: false };
  }

  /* How to draw `body` this frame. idx is the frame's place in its animation (0 = an attack's wind-up);
     frameOf(dir) picks the sheet frame for a view.
     Returns { f, xs, sx, sy, shear, ox, oy, prev } with prev = { f, xs, a } (the fading last frame) or null. */
  M.pose = function (body, angle, x, y, anim, idx, scale, flash, frameOf) {
    const t = now();
    let st = states.get(body);
    const dt = st ? clamp(t - st.t, 0, 0.1) : 0;
    const { dir, flip } = viewOf(st, angle);
    const f = frameOf(dir);
    if (!st || Math.abs(t - st.t) > 1 || Math.hypot(x - st.x, y - st.y) > 120) {
      // new, or back after a pause or a jump across the map: start settled
      st = { t, x, y, vx: 0, vy: 0, dir, flip, turnT: 0, lean: 0, sq: 0, sqV: 0, sx: 1, sy: 1, ox: 0, oy: 0,
        anim, f, xs: flip ? -1 : 1, prev: null, blendT: 0, blendMax: 1, flash: flash || 0, seed: Math.random() * 6 };
      states.set(body, st);
      return { f, xs: st.xs, sx: 1, sy: 1, shear: 0, ox: 0, oy: 0, prev: null };
    }
    st.t = t;

    // how fast it's really moving on screen
    if (dt > 0) {
      st.vx = ease(st.vx, (x - st.x) / dt, 12, dt);
      st.vy = ease(st.vy, (y - st.y) / dt, 12, dt);
    }
    st.x = x; st.y = y;

    // turning between left and right: narrow and open up the other way
    if (dir === "side" && st.dir === "side" && flip !== st.flip) st.turnT = TURN;
    st.turnT = Math.max(0, st.turnT - dt);
    const sign = flip ? -1 : 1;
    let xs = sign;
    if (st.turnT > 0) {
      const c = -Math.cos((1 - st.turnT / TURN) * Math.PI); // -1 (the old way) to 1 (the new way)
      xs = sign * (c < 0 ? -1 : 1) * (0.4 + 0.6 * Math.abs(c)); // narrowest, not gone, mid-turn
    }

    // a new pose: the old one fades out beneath it (longer when the action or the view changes)
    const changed = anim !== st.anim, turned = dir !== st.dir;
    if (f !== st.f && st.f) {
      st.blendMax = changed || turned ? 0.09 : anim === "walk" ? 0.05 : 0.07;
      st.blendT = st.blendMax;
      st.prev = { f: st.f, xs: st.xs };
    }
    st.blendT = Math.max(0, st.blendT - dt);

    // kicks to the squash spring as the action changes
    if (changed) {
      if (anim === "hurt") st.sqV -= 5;
      else if (st.anim === "dash") st.sqV -= 3.5; // landing out of a dash
      else if (st.anim === "attack" || st.anim === "cast") st.sqV -= 1.6;
      else if (st.anim === "walk" && anim === "idle") st.sqV -= 1.4; // the weight settling as it stops
    }
    if ((flash || 0) - st.flash > 0.45 && anim !== "hurt") st.sqV -= 4.5; // struck
    st.flash = flash || 0;
    st.sqV += (-K * st.sq - D * st.sqV) * dt;
    st.sq = clamp(st.sq + st.sqV * dt, -0.16, 0.16);

    // held shapes for each action, eased into
    let sxT = 1, syT = 1, oxT = 0, oyT = 0, leanT = 0;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    if (anim === "idle") {
      const b = Math.sin(t * 2.3 + st.seed);
      syT = 1 + 0.014 * b; sxT = 1 - 0.007 * b; // breathing
    } else if (anim === "walk") {
      leanT = clamp(st.vx / 240, -1, 1) * 0.07;
    } else if (anim === "dash") {
      const along = Math.abs(ca);
      sxT = 1 + 0.14 * along; syT = 1 - 0.08 * along + 0.06 * (1 - along);
      leanT = clamp(st.vx / 400, -1, 1) * 0.12;
    } else if (anim === "attack" || anim === "cast") {
      if (idx === 0) { sxT = 1.05; syT = 0.94; leanT = -ca * 0.04; oxT = -ca * 1.5; oyT = -sa * 0.8; } // gathering for the blow
      else { sxT = 0.98; syT = 1.04; leanT = ca * 0.06; oxT = ca * 3.5; oyT = sa * 1.8; } // and into it
    }
    st.sx = ease(st.sx, sxT, 16, dt); st.sy = ease(st.sy, syT, 16, dt);
    st.ox = ease(st.ox, oxT * scale, 18, dt); st.oy = ease(st.oy, oyT * scale, 18, dt);
    st.lean = ease(st.lean, leanT, 10, dt);

    st.dir = dir; st.flip = flip; st.anim = anim; st.f = f; st.xs = xs;
    const prev = st.blendT > 0 && st.prev ? { f: st.prev.f, xs: st.prev.xs, a: (st.blendT / st.blendMax) ** 2 } : null;
    return { f, xs, sx: st.sx * (1 - st.sq * 0.6), sy: st.sy * (1 + st.sq), shear: st.lean, ox: st.ox, oy: st.oy, prev };
  };
})(window.DL);
