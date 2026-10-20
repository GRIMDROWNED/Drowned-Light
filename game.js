(()=>{
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),$=id=>document.getElementById(id);
let W,H,scale;function resize(){scale=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*scale;canvas.height=H*scale;ctx.setTransform(scale,0,0,scale,0,0);ctx.imageSmoothingEnabled=false;}addEventListener("resize",resize);resize();
const TILE=48,CHUNK=8,seed=1937,objects=new Map(),collected=new Set(),keys=new Set();
function hash(x,y,s=0){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s+seed,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
const dist=(x,y)=>Math.hypot(x,y);let player,enemies,bullets,level,clock,total,spawn,attack,over,noticeTime;
const SAVEKEY="drowned-light-v04";let save={level:1,wood:0,stone:0,shard:0,forge:0,armory:0};try{Object.assign(save,JSON.parse(localStorage.getItem(SAVEKEY)||"{}"));}catch(e){}
function persist(){try{localStorage.setItem(SAVEKEY,JSON.stringify(save));}catch(e){}}
let dashDir={x:0,y:1},dashTrail=[],facing={x:0,y:-1},dashCooldown=0;
function message(t){$("notification").textContent=t;noticeTime=5;}
function reset(){player={x:0,y:70,hp:100+save.armory*20,corrupt:0,wood:0,stone:0,shard:0,boost:0,invuln:0};enemies=[];bullets=[];level=save.level;dashCooldown=0;dashTrail=[];clock=0;total=0;spawn=0;attack=0;over=false;objects.clear();collected.clear();$("upgradePanel").classList.add("hidden");message("Explore by day. Seek light at night. Defend your camp.");}
function night(){return clock>=50;}
function chunk(cx,cy){let key=cx+","+cy;if(objects.has(key))return;const a=[];for(let i=0;i<14;i++){const x=(cx*CHUNK+hash(cx,cy,i*2)*CHUNK)*TILE,y=(cy*CHUNK+hash(cx,cy,i*2+1)*CHUNK)*TILE;if(dist(x,y)<135)continue;const n=hash(cx*71+i,cy*53-i),type=n<.31?"wood":n<.57?"stone":n<.75?"shard":n<.88?"plant":"tree";const id=key+":"+i;a.push({x,y,type,id,alive:!collected.has(id)});}objects.set(key,a);}
function startDash(){if(over||dashCooldown>0||$("upgradePanel").classList.contains("hidden")===false)return;let v=dist(joystick.x,joystick.y)>0.2?joystick:facing;let len=dist(v.x,v.y)||1;dashDir={x:v.x/len,y:v.y/len};player.boost=.24;player.invuln=Math.max(player.invuln,.2);dashCooldown=3;dashTrail=[];message("Dash!");}
const joystick={x:0,y:0};addEventListener("keydown",e=>{keys.add(e.key.toLowerCase());if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault();});addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
const pad=$("pad"),stick=$("stick");let lastPadTap=0;function padMove(e){let r=pad.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.max(1,dist(x,y)),m=Math.min(1,len/38);joystick.x=x/len*m;joystick.y=y/len*m;stick.style.transform="translate("+(joystick.x*36)+"px,"+(joystick.y*36)+"px)";}
// Track joystick pointer independently so a second finger can dash without canceling movement.
let movementPointer=null;
pad.addEventListener("pointerdown",e=>{
  if(movementPointer!==null)return;
  e.preventDefault();movementPointer=e.pointerId;
  pad.setPointerCapture(e.pointerId);padMove(e);
  if(performance.now()-lastPadTap<300)startDash();
  lastPadTap=performance.now();
});
pad.addEventListener("pointermove",e=>{if(e.pointerId===movementPointer){e.preventDefault();padMove(e);}});
function padReset(e){if(e.pointerId!==movementPointer)return;movementPointer=null;joystick.x=0;joystick.y=0;stick.style.transform="";}
pad.addEventListener("pointerup",padReset);pad.addEventListener("pointercancel",padReset);
const dashButton=$("dash");
dashButton.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();startDash();});
dashButton.addEventListener("contextmenu",e=>e.preventDefault());$("restart").onclick=reset;
$("upgrade").onclick=()=>{if(over||dist(player.x,player.y)>155){message("Return to the campfire to upgrade.");return;}$("upgradePanel").classList.remove("hidden");panel();};$("close").onclick=()=>$("upgradePanel").classList.add("hidden");
const pane=$("upgradePanel").querySelector(".panel");$("buy").textContent="UPGRADE CENTRAL FLAME";
const deposit=document.createElement("button");deposit.textContent="DEPOSIT ALL CARRIED SUPPLIES";pane.insertBefore(deposit,$("buy"));
const forge=document.createElement("button"),armory=document.createElement("button"),storage=document.createElement("div");pane.insertBefore(storage,$("close"));pane.insertBefore(forge,$("close"));pane.insertBefore(armory,$("close"));
function panel(){const cost=level*6;$("upgradeInfo").textContent="Flame Lv "+level+" (needs "+cost+" wood + "+cost+" stone). Carried: "+player.wood+"W / "+player.stone+"S / "+player.shard+" shards.";storage.textContent="Stored at camp: "+save.wood+" wood, "+save.stone+" stone, "+save.shard+" shards. Stored resources survive death.";forge.textContent="FORGE Lv "+save.forge+" → "+(save.forge+1)+" : "+((save.forge+1)*4)+" stone + "+((save.forge+1)*2)+" shards (attack damage/speed)";armory.textContent="ARMORY Lv "+save.armory+" → "+(save.armory+1)+" : "+((save.armory+1)*5)+" wood + "+((save.armory+1)*2)+" stone (maximum health)";}
deposit.onclick=()=>{for(const k of ["wood","stone","shard"]){save[k]+=player[k];player[k]=0;}persist();panel();message("Supplies safely stored.");};
$("buy").onclick=()=>{const cost=level*6;if(save.wood>=cost&&save.stone>=cost){save.wood-=cost;save.stone-=cost;level++;save.level=level;persist();message("Central Flame upgraded.");}else message("Deposit supplies, then collect more for this upgrade.");panel();};
forge.onclick=()=>{const c=save.forge+1;if(save.stone>=c*4&&save.shard>=c*2){save.stone-=c*4;save.shard-=c*2;save.forge++;persist();message("Weapon damage and speed increased.");}else message("Not enough stored resources for Forge.");panel();};
armory.onclick=()=>{const c=save.armory+1;if(save.wood>=c*5&&save.stone>=c*2){save.wood-=c*5;save.stone-=c*2;save.armory++;player.hp+=20;persist();message("Maximum health increased.");}else message("Not enough stored resources for Armory.");panel();};
function lights(){let a=[{x:0,y:0,r:125+level*28,kind:"human"}];if(night())for(const group of objects.values())for(const o of group)if(o.type==="plant"&&o.alive)a.push({x:o.x,y:o.y,r:95,kind:"plant"});return a;}
function update(dt){if(over)return;total+=dt;clock=total%100;let dx=joystick.x+(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),dy=joystick.y+(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0),m=dist(dx,dy);if(m){facing={x:dx/m,y:dy/m};}if(player.boost>0){player.x+=dashDir.x*420*dt;player.y+=dashDir.y*420*dt;dashTrail.push({x:player.x,y:player.y,life:.26});}else if(m){player.x+=dx/m*150*dt;player.y+=dy/m*150*dt;}player.boost=Math.max(0,player.boost-dt);dashCooldown=Math.max(0,dashCooldown-dt);for(const t of dashTrail)t.life-=dt;dashTrail=dashTrail.filter(t=>t.life>0);$("dash").textContent=dashCooldown>0?dashCooldown.toFixed(1)+"s":"DASH";player.invuln=Math.max(0,player.invuln-dt);
const cx=Math.floor(player.x/(TILE*CHUNK)),cy=Math.floor(player.y/(TILE*CHUNK));for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++)chunk(x,y);
for(const group of objects.values())for(const o of group)if(o.alive&&!["tree","plant"].includes(o.type)&&dist(o.x-player.x,o.y-player.y)<22){o.alive=false;collected.add(o.id);player[o.type]++;}
let light="none";for(const l of lights())if(dist(player.x-l.x,player.y-l.y)<l.r){light=l.kind;if(light==="human")break;}
if(light==="human")player.corrupt=Math.max(0,player.corrupt-16*dt);else if(night()&&light==="none")player.corrupt=Math.min(400,player.corrupt+20*dt);
if(player.corrupt>=400){over=true;message("DROWNED IN DARKNESS — RESTART TO TRY AGAIN.");}
if(night()){spawn-=dt;if(spawn<=0&&enemies.length<70){spawn=Math.max(.35,1.5-(clock-50)*.016);let a=Math.random()*6.283,r=300+Math.random()*130,depth=dist(player.x,player.y);enemies.push({x:player.x+Math.cos(a)*r,y:player.y+Math.sin(a)*r,hp:2+Math.floor(depth/900),speed:32+Math.min(45,depth/80)});}}else for(const e of enemies)e.hp-=dt*2;
for(const e of enemies){let d=dist(player.x-e.x,player.y-e.y)||1;e.x+=(player.x-e.x)/d*e.speed*dt;e.y+=(player.y-e.y)/d*e.speed*dt;if(d<20&&player.invuln<=0){player.hp-=8;player.invuln=.7;}}
attack-=dt;if(attack<=0){let target=null,best=145;for(const e of enemies){let d=dist(e.x-player.x,e.y-player.y);if(d<best){best=d;target=e;}}if(target){attack=Math.max(.22,.55-save.forge*.04);bullets.push({x:player.x,y:player.y,vx:(target.x-player.x)/best*350,vy:(target.y-player.y)/best*350,life:.75});}}
for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const e of enemies)if(dist(e.x-b.x,e.y-b.y)<16){e.hp-=2+save.forge;b.life=0;break;}}
enemies=enemies.filter(e=>e.hp>0);bullets=bullets.filter(b=>b.life>0);if(player.hp<=0){over=true;message("THE KNIGHT HAS FALLEN — RESTART TO TRY AGAIN.");}
$("hptext").textContent=Math.ceil(Math.max(0,player.hp))+" / "+(100+save.armory*20);$("health").style.width=Math.max(0,player.hp)/(100+save.armory*20)*100+"%";$("corrupttext").textContent=Math.floor(player.corrupt)+" / 400";$("corrupt").style.width=player.corrupt/4+"%";$("status").textContent="DAY "+(Math.floor(total/100)+1)+" · "+(night()?"NIGHT":"DAYLIGHT")+" · "+(light==="human"?"HEALING":light==="plant"?"PLANT SHELTER":night()?"EXPOSED":"SAFE");$("resources").textContent="WOOD "+player.wood+" · STONE "+player.stone+" · SHARDS "+player.shard;$("arrow").style.transform="rotate("+(Math.atan2(-player.x,player.y)*180/Math.PI)+"deg)";$("distance").textContent=Math.round(dist(player.x,player.y))+"m";noticeTime-=dt;if(noticeTime<=0)$("notification").textContent=night()?"Stay near light to avoid corruption.":"Explore for supplies before nightfall.";
}
function box(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}function line(x,y,xx,yy,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();}
// Pixel-art character renderer, designed from the approved Lantern Knight concept.
// Draw at a fixed 32x40 internal resolution, then enlarge with nearest-neighbor sampling.
const spriteCanvas=document.createElement("canvas");spriteCanvas.width=32;spriteCanvas.height=40;
const spriteCtx=spriteCanvas.getContext("2d");spriteCtx.imageSmoothingEnabled=false;
function drawKnightSprite(x,y,enemy=false,corruption=0,alpha=1,phase=0){
 const k=spriteCtx;k.clearRect(0,0,32,40);
 const pixel=(xx,yy,ww,hh,c)=>{k.fillStyle=c;k.fillRect(xx,yy,ww,hh);};
 const stage=enemy?4:corruption>=300?4:corruption>=200?3:corruption>=100?2:1;
 const drowned=stage>=3,abyss=stage===4;
 const rim=enemy?"#132731":abyss?"#12282f":drowned?"#25383d":"#4d423d";
 const cloth=enemy?"#354c51":abyss?"#273a45":drowned?"#756f71":"#d8cbbb";
 const shine=enemy?"#57747e":abyss?"#4b7c85":drowned?"#bbb6b0":"#fff0d8";
 const steel=enemy?"#3e5561":drowned?"#485766":"#90959a";
 const glow=enemy||drowned?"#44e2ef":"#ffc466";
 // trailing ragged cloak + cowl, recognizable ivory pointed silhouette
 pixel(9,5,15,24,rim);pixel(7,13,20,19,rim);pixel(4,23,23,7,rim);
 pixel(3,27,5,7,rim);pixel(22,27,8,8,rim);pixel(1,31,6,4,rim);
 pixel(6,15,18,15,cloth);pixel(4,22,22,6,cloth);pixel(3,27,6,5,cloth);
 pixel(22,27,6,6,cloth);pixel(1,30,5,4,cloth);
 pixel(9,2,13,17,rim);pixel(11,0,9,3,rim);pixel(12,1,7,2,shine);
 pixel(10,4,13,13,cloth);pixel(9,9,15,6,cloth);
 pixel(12,5,10,10,steel);pixel(14,4,6,10,shine);pixel(13,10,8,3,"#182127");
 // peaked visor: dark cross motif
 pixel(12,12,10,2,"#111719");pixel(15,11,4,8,"#111719");
 pixel(13,14,3,2,"#15252a");pixel(19,14,2,2,"#15252a");
 if(stage>=2){pixel(20,10,3,2,"#36b4c2");pixel(7,21,3,4,"#24383e");}
 if(drowned){pixel(14,12,8,2,glow);pixel(16,12,2,8,glow);pixel(23,26,3,6,"#195e70");}
 if(abyss){pixel(1,23,3,7,"#176b7c");pixel(26,23,4,9,"#1f7587");pixel(6,32,3,4,"#278da1");}
 // shoulder plates, torso, belt and boots
 pixel(7,18,6,7,steel);pixel(20,18,5,7,steel);pixel(12,18,9,11,"#4d5360");
 pixel(14,19,5,8,steel);pixel(12,27,11,3,"#523c30");pixel(14,29,4,8,steel);
 pixel(19,29,4,8,steel);pixel(13,36,6,3,"#282b31");pixel(20,36,6,3,"#282b31");
 // Sword, held to lower left; outlined blade
 pixel(7,25,3,7,"#483a30");pixel(5,28,7,2,"#bfa773");
 pixel(4,31,3,3,"#a9b5b9");pixel(2,34,3,3,"#e7eef0");pixel(1,37,3,2,"#a6b9c3");
 // Lantern held at right, pulsing orange unless corrupted
 pixel(25,23,2,5,"#9b8358");pixel(24,27,5,2,"#bca77e");pixel(24,29,6,7,"#3b3127");
 pixel(25,30,4,5,glow);pixel(24,35,6,2,"#ab8750");
 if(!enemy&&stage<3){pixel(26,31,2,2,"#fff2b9");}
 if(stage===4){pixel(27,31,2,3,"#b6fcff");}
 // tiny animated stride
 if(Math.floor(phase*8)%2===1){pixel(13,37,4,2,cloth);pixel(21,36,4,2,rim);}
 ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(spriteCanvas,Math.round(x-24),Math.round(y-42),48,60);
 ctx.restore();
 if(!enemy&&stage<3){circle(x+16,y+10,10,"#ffaf2723");circle(x+16,y+9,4,"#ffcf7555");}
 if(enemy||stage>=3)circle(x+15,y+9,8,"#2ac9dc24");
}
function knight(x,y,enemy=false){drawKnightSprite(x,y,enemy,enemy?400:player.corrupt,1,total);}
function draw(){box(0,0,W,H,"#091720");const ox=W/2-player.x,oy=H/2-player.y;
let left=Math.floor((player.x-W/2)/TILE)-1,right=Math.ceil((player.x+W/2)/TILE)+1,top=Math.floor((player.y-H/2)/TILE)-1,bottom=Math.ceil((player.y+H/2)/TILE)+1;
for(let ty=top;ty<=bottom;ty++)for(let tx=left;tx<=right;tx++){let x=tx*TILE+ox,y=ty*TILE+oy,h=hash(tx,ty);box(x,y,TILE+1,TILE+1,h<.3?"#182d37":h<.64?"#1c3330":"#273b34");if(h>.84)circle(x+22,y+19,10,"#284450");else{box(x+9,y+13,3,7,"#3b5652");box(x+34,y+29,3,4,"#3d5545");}}
for(const l of lights()){let x=l.x+ox,y=l.y+oy;if(x<-300||x>W+300||y<-300||y>H+300)continue;circle(x,y,l.r,l.kind==="human"?"#b7731425":"#18bccc19");circle(x,y,l.r*.65,l.kind==="human"?"#be812025":"#34d7df21");}
for(const group of objects.values())for(const o of group){if(!o.alive)continue;let x=o.x+ox,y=o.y+oy;if(x<-35||x>W+35||y<-35||y>H+35)continue;if(o.type==="wood"){box(x-7,y-3,15,8,"#9e7853");}else if(o.type==="stone"){circle(x,y,10,"#84929a");circle(x-3,y-3,4,"#aab7b7");}else if(o.type==="shard"){circle(x,y,15,"#11717f55");box(x-4,y-10,8,20,"#53dce9");}else if(o.type==="plant"){line(x-4,y+10,x,y-9,"#5c8071",4);if(night()){circle(x,y-10,12,"#24b6ca66");circle(x,y-10,6,"#85f9fb");}else circle(x,y-10,5,"#496f6d");}else{box(x-4,y+5,9,17,"#564734");circle(x,y-11,19,"#234435");}}
const x=ox,y=oy;
// The physical home base visually grows at campfire levels 5, 10 and 20.
const tier=level>=20?4:level>=10?3:level>=5?2:1;
function hut(a,b,w=42,h=31){box(x+a-3,y+b+7,w+6,6,"#302c2b");box(x+a,y+b,w,h,"#75614a");box(x+a-5,y+b-8,w+10,10,"#a18b69");box(x+a+13,y+b+8,9,13,"#302923");}
function torch(a,b){box(x+a-2,y+b,4,12,"#75644f");circle(x+a,y+b-5,6,"#ec913f");circle(x+a,y+b-7,3,"#ffdf87");}
hut(-68,-42);hut(34,-43);hut(-68,34);
if(tier>=2){hut(35,37,34,28);hut(-95,-1,22,24);torch(-105,-42);torch(103,-36);line(x-110,y-82,x+113,y-82,"#8e8570",5);line(x-110,y+92,x+113,y+92,"#8e8570",5);}
if(tier>=3){hut(-30,-113,60,34);hut(-28,83,58,32);for(let i=-2;i<=2;i++){box(x-125+i*50,y-103,10,15,"#8e9085");box(x-125+i*50,y+111,10,15,"#8e9085");}torch(-118,0);torch(118,0);}
if(tier>=4){for(const [a,b] of [[-130,-115],[118,-115],[-130,114],[118,114]]){box(x+a,y+b,22,42,"#868e89");box(x+a-5,y+b-10,32,13,"#bac0b2");torch(a+10,b-13);}for(let i=-2;i<=2;i++){line(x-130,y+i*28,x-147,y+i*28,"#b08e62",3);line(x+132,y+i*28,x+149,y+i*28,"#b08e62",3);}}
circle(x,y,17+tier*3,"#b66e26");circle(x,y-7,10+tier*3,"#ffbc69");circle(x,y-12,5+tier*2,"#ffe7af");
ctx.fillStyle="#f2d299";ctx.font="11px Georgia";ctx.textAlign="center";ctx.fillText("HOME BASE · LV "+level+" · TIER "+tier,x,y-(tier>=3?145:tier>=2?100:62));
for(const e of enemies)knight(e.x+ox,e.y+oy,true);for(const t of dashTrail){ctx.save();ctx.globalAlpha=Math.min(.35,t.life*1.3);knight(t.x+ox,t.y+oy);ctx.restore();}for(const b of bullets)circle(b.x+ox,b.y+oy,5,"#ffd486");knight(W/2,H/2);if(player.corrupt>=100)circle(W/2,H/2,24,"#1db7d01e");if(player.invuln>0)circle(W/2,H/2,20,"#e6313122");if(night())box(0,0,W,H,"#01071326");if(over){box(W/2-160,H/2-42,320,90,"#07131bef");ctx.fillStyle="#edc48d";ctx.font="bold 21px Georgia";ctx.fillText(player.corrupt>=400?"DROWNED IN DARKNESS":"THE KNIGHT HAS FALLEN",W/2,H/2);ctx.font="13px sans-serif";ctx.fillText("Press RESTART",W/2,H/2+23);}}
let last=performance.now();function frame(now){let dt=Math.min(.045,(now-last)/1000);last=now;if(!over&&$("upgradePanel").classList.contains("hidden"))update(dt);draw();requestAnimationFrame(frame);}reset();requestAnimationFrame(frame);
})();