/* Drowned Light — player animation rig v0.8
 * Uses the existing illustrated atlas. The torso stays steady when walking.
 * Feet move in alternating directions, and the sword is a separate moving
 * layer cut from the same source artwork, rather than rotating the knight.
 * Atlas: 8 cols x 3 rows, cells 240x336, directions:
 * down, down-right, right, up-right, up, up-left, left, down-left.
 */
"use strict";
class PlayerAnimator {
  constructor(image) {
    this.image = image;
    this.frames = [];
    this.prepared = false;
    // Sword handle and blade tip within the original 240x336 frame.
    this.blades = [
      [[100, 201], [122, 310]],
      [[104, 209], [193, 296]],
      [[118, 211], [209, 300]],
      [[128, 209], [226, 291]],
      null,
      null,
      [[103, 210], [21, 308]],
      [[129, 222], [57, 314]]
    ];
    this.directionOrder = [2,1,0,7,6,5,4,3];
  }
  canvas() {
    const c = document.createElement("canvas");
    c.width = 240; c.height = 336;
    return c;
  }
  swordPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 16;
    ctx.stroke();
  }
  prepare() {
    if(this.image.naturalWidth!==1920||this.image.naturalHeight!==1008) return false;
    this.frames = [];
    for(let state=0;state<3;state++) {
      const row = [];
      for(let dir=0;dir<8;dir++) {
        const body = this.canvas(),b = body.getContext("2d");
        b.imageSmoothingEnabled = false;
        b.drawImage(this.image,dir*240,state*336,240,336,0,0,240,336);
        let sword = null;
        let handle = this.blades[dir] ? this.blades[dir][0] : null;
        if(handle && state!==2) {
          sword = this.canvas();
          const w=sword.getContext("2d");
          w.drawImage(body,0,0);
          // Isolate the sword pixels from the original illustrated frame.
          w.globalCompositeOperation = "destination-in";
          w.strokeStyle = "#fff";
          this.swordPath(w,this.blades[dir]);
          w.globalCompositeOperation = "source-over";
          // Remove the original *static* sword before drawing the animated sword.
          b.globalCompositeOperation = "destination-out";
          b.strokeStyle = "#fff";
          this.swordPath(b,this.blades[dir]);
          b.globalCompositeOperation = "source-over";
        }
        row.push({body,sword,handle});
      }
      this.frames.push(row);
    }
    this.prepared = true;
    return true;
  }
  draw(ctx,x,y,gameDir,state,walkTime,attack,corruption) {
    if(!this.prepared)return false;
    const direction=this.directionOrder[gameDir] ?? 0;
    const stateRow=state==="dash"?2:state==="walk"?1:0;
    const frame=this.frames[stateRow][direction];
    if(!frame)return false;
    const dx=Math.round(x-35),dy=Math.round(y-62),w=70,h=94;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(corruption>=200)ctx.filter="hue-rotate(140deg) brightness(.8)";
    if(state==="dash")ctx.globalAlpha=.94;
    if(state==="walk"){
      // Keep the head, torso, arms and lantern anchored in place. Only the
      // lower section steps. The previous code flashed the entire sprite
      // between mismatched illustrated poses every 125 ms.
      const seam=267,upperH=seam/336*h;
      ctx.drawImage(frame.body,0,0,240,seam,dx,dy,w,upperH);
      const step=Math.sin(walkTime*12.5);
      const shift=step*2.7;
      // Two independent lower-leg strips moving in opposing phases.
      for(let side=0;side<2;side++){
        const clipX=dx+side*w/2;
        ctx.save();ctx.beginPath();
        ctx.rect(clipX,dy+upperH-.5,w/2+.5,h-upperH+6);
        ctx.clip();
        ctx.drawImage(frame.body,dx+(side===0?-.4:.4),dy+(side===0?shift:-shift),w,h);
        ctx.restore();
      }
    }else ctx.drawImage(frame.body,dx,dy,w,h);
    // Pivot only the extracted illustrated sword around the hand.
    if(frame.sword && frame.handle){
      const pivotX=dx+frame.handle[0]/240*w,pivotY=dy+frame.handle[1]/336*h;
      ctx.save();ctx.translate(pivotX,pivotY);
      if(attack&&attack.active&&state!=="dash"){
        const t=Math.min(1,Math.max(0,attack.time/attack.duration));
        const eased=t*t*(3-2*t);
        const side=direction>=5?-1:1;
        // The blade traverses over two radians; the knight stays still.
        ctx.rotate(side*(-1.12+2.32*eased));
      }
      ctx.drawImage(frame.sword,-frame.handle[0]/240*w,-frame.handle[1]/336*h,w,h);
      ctx.restore();
    } else if(attack&&attack.active&&state!=="dash"){
      // Rear-facing poses hide the sword under the cloak. Show a blade
      // moving out from behind the shoulder during the attack.
      const ref=this.frames[0][0],p=ref.handle;
      if(ref.sword&&p){
        const t=Math.min(1,attack.time/attack.duration);
        ctx.save();ctx.translate(dx+18,dy+55);
        ctx.rotate(-.65+1.7*t);
        ctx.drawImage(ref.sword,-p[0]/240*w,-p[1]/336*h,w,h);
        ctx.restore();
      }
    }
    ctx.restore();
    return true;
  }
}
