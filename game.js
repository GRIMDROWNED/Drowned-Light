(()=>{
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),$=id=>document.getElementById(id);
let W,H,scale;function resize(){scale=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*scale;canvas.height=H*scale;ctx.setTransform(scale,0,0,scale,0,0);ctx.imageSmoothingEnabled=false;}addEventListener("resize",resize);resize();
const TILE=48,CHUNK=8,seed=1937,objects=new Map(),collected=new Set(),keys=new Set();
function hash(x,y,s=0){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s+seed,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
const dist=(x,y)=>Math.hypot(x,y);let player,enemies,bullets,level,clock,total,spawn,attack,over,noticeTime;
const SAVEKEY="drowned-light-v04";let save={level:1,wood:0,stone:0,shard:0,forge:0,armory:0};try{Object.assign(save,JSON.parse(localStorage.getItem(SAVEKEY)||"{}"));}catch(e){}
function persist(){try{localStorage.setItem(SAVEKEY,JSON.stringify(save));}catch(e){}}
let dashDir={x:0,y:1},dashTrail=[],facing={x:0,y:-1},dashCooldown=0;let animation={direction:2,state:"idle",walkTime:0};
function message(t){$("notification").textContent=t;noticeTime=5;}
function reset(){player={x:0,y:70,hp:100+save.armory*20,corrupt:0,wood:0,stone:0,shard:0,boost:0,invuln:0};enemies=[];bullets=[];level=save.level;dashCooldown=0;dashTrail=[];facing={x:0,y:1};animation={direction:2,state:"idle",walkTime:0};clock=0;total=0;spawn=0;attack=0;over=false;objects.clear();collected.clear();$("upgradePanel").classList.add("hidden");message("Explore by day. Seek light at night. Defend your camp.");}
function night(){return clock>=50;}
function chunk(cx,cy){let key=cx+","+cy;if(objects.has(key))return;const a=[];for(let i=0;i<14;i++){const x=(cx*CHUNK+hash(cx,cy,i*2)*CHUNK)*TILE,y=(cy*CHUNK+hash(cx,cy,i*2+1)*CHUNK)*TILE;if(dist(x,y)<135)continue;const n=hash(cx*71+i,cy*53-i),type=n<.31?"wood":n<.57?"stone":n<.75?"shard":n<.88?"plant":"tree";const id=key+":"+i;a.push({x,y,type,id,alive:!collected.has(id)});}objects.set(key,a);}
function startDash(){if(over||dashCooldown>0||$("upgradePanel").classList.contains("hidden")===false)return;let v=dist(joystick.x,joystick.y)>0.2?joystick:facing;let len=dist(v.x,v.y)||1;dashDir={x:v.x/len,y:v.y/len};player.boost=.24;player.invuln=Math.max(player.invuln,.2);dashCooldown=3;dashTrail=[];facing={...dashDir};animation.direction=direction8(dashDir.x,dashDir.y);animation.state="dash";message("Dash!");}
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
function direction8(dx,dy){return (Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8;}
function update(dt){if(over)return;total+=dt;clock=total%100;let dx=joystick.x+(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),dy=joystick.y+(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0),m=dist(dx,dy);if(m>0.08&&player.boost<=0){facing={x:dx/m,y:dy/m};animation.direction=direction8(dx,dy);}animation.state=player.boost>0?"dash":m>0.08?"walk":"idle";if(animation.state==="walk")animation.walkTime+=dt;else animation.walkTime=0;if(player.boost>0){player.x+=dashDir.x*420*dt;player.y+=dashDir.y*420*dt;dashTrail.push({x:player.x,y:player.y,life:.26});}else if(m){player.x+=dx/m*150*dt;player.y+=dy/m*150*dt;}player.boost=Math.max(0,player.boost-dt);dashCooldown=Math.max(0,dashCooldown-dt);for(const t of dashTrail)t.life-=dt;dashTrail=dashTrail.filter(t=>t.life>0);$("dash").textContent=dashCooldown>0?dashCooldown.toFixed(1)+"s":"DASH";player.invuln=Math.max(0,player.invuln-dt);
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
// Eight-direction pixel sprite, state driven: idle, walk, dash.
// Directions in screen coordinates: 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE.
const spriteCanvas=document.createElement("canvas");spriteCanvas.width=40;spriteCanvas.height=48;
const sk=spriteCanvas.getContext("2d");sk.imageSmoothingEnabled=false;
function drawKnightSprite(x,y,enemy=false,corruption=0,alpha=1,dir=2,state="idle",walkTime=0){
 const k=sk;k.clearRect(0,0,40,48);
 const p=(a,b,w,h,color)=>{k.fillStyle=color;k.fillRect(a|0,b|0,w,h);};
 const stage=enemy?4:corruption>=300?4:corruption>=200?3:corruption>=100?2:1;
 const dark=stage>=3,deep=stage===4;
 const edge=dark?"#1b2b32":"#47403d",ivory=dark?"#68747a":"#ded2bf",highlight=dark?"#7c989e":"#fff0d8";
 const metal=dark?"#425765":"#838b94",metalHi=dark?"#6a94a2":"#bec3c1",shadow="#141b21";
 const shine=dark?"#4ce5ef":"#ffb954",leather="#55453b";
 const toBack=[5,6,7].includes(dir),side=[0,4].includes(dir),diag=[1,3,5,7].includes(dir);
 const left=[3,4,5].includes(dir),right=[0,1,7].includes(dir);
 const stride=state==="walk"?Math.floor(walkTime*9)%4:0;
 const foot=state==="walk"?[0,2,0,-2][stride]:0;
 const lean=state==="dash"?3:0;
 // Rear cloak with jagged hem; diagonal silhouette leans to movement.
 const leanX=state==="dash"?(left?-lean:right?lean:0):0;
 p(10+leanX,14,20,25,edge);p(9+leanX,20,22,17,ivory);
 p(7+leanX,32,7,7,ivory);p(25+leanX,31,8,8,ivory);
 p(5+leanX,37,6,5,edge);p(27+leanX,37,7,5,edge);
 p(6+leanX,39,5,4,ivory);p(29+leanX,39,4,4,ivory);
 if(dark){p(7+leanX,32,4,8,"#1e8291");p(30+leanX,35,3,6,"#1b6f82");}
 // Legs use animation only when walking, stable when idle.
 p(14+leanX,33+foot,5,10,shadow);p(22+leanX,33-foot,5,10,shadow);
 p(14+leanX,33+foot,4,8,metal);p(22+leanX,33-foot,4,8,metal);
 p(13+leanX,42+foot,7,3,shadow);p(21+leanX,42-foot,7,3,shadow);
 // Armored chest + mantle, angle-aware broad upper body.
 p(11+leanX,21,19,14,shadow);p(13+leanX,22,15,11,metal);
 p(15+leanX,23,11,7,metalHi);p(12+leanX,32,18,3,leather);
 p(9+leanX,20,6,10,edge);p(25+leanX,20,6,10,edge);
 p(10+leanX,21,5,7,metalHi);p(25+leanX,21,5,7,metalHi);
 // Pointed layered hood with crisp highlighted ridge.
 const hx=diag?(left?16:18):17;
 p(hx-10+leanX,10,24,12,edge);
 p(hx-8+leanX,7,20,13,ivory);
 p(hx-5+leanX,4,13,6,ivory);p(hx-3+leanX,2,9,4,highlight);
 p(hx+leanX,0,3,6,edge);
 p(hx-4+leanX,5,9,3,highlight);
 if(toBack){
   // Rear view: no visor, visible hood seams and cloak fold.
   p(hx+1+leanX,8,3,15,edge);p(hx-6+leanX,17,16,4,highlight);
   p(hx-4+leanX,23,7,11,ivory);p(hx+4+leanX,23,5,11,edge);
 } else {
   // 3 front-facing quarters + full side: correctly offset faceplate and visor.
   const visorX=hx+(left?-5:right?3:0)+leanX;
   if(side){
     p(visorX-2,10,9,11,shadow);p(visorX,10,6,9,metalHi);
     p(visorX+(left?0:3),13,3,6,shadow);
     p(visorX+(left?0:3),13,2,3,dark?shine:shadow);
   }else{
     p(visorX-6,9,16,12,shadow);
     p(visorX-4,10,12,10,metalHi);
     p(visorX+1,10,3,12,shadow);
     p(visorX-4,14,12,3,shadow);
     if(dark)p(visorX-3,14,10,2,shine);
     p(visorX-8,20,20,3,ivory);
   }
 }
 // Sword and lantern swap screen sides depending on direction.
 const swordLeft=left||(!right&&!toBack),bladeX=swordLeft?5:30,lanternX=swordLeft?32:6;
 p(bladeX,28,3,9,leather);
 p(bladeX-2,32,7,2,"#c5a36c");
 p(bladeX+(swordLeft?-2:1),36,3,8,metalHi);
 p(bladeX+(swordLeft?-4:2),43,3,4,highlight);
 p(lanternX,26,2,5,"#a98a51");p(lanternX-2,31,7,2,"#7c663f");
 p(lanternX-2,33,7,10,edge);p(lanternX-1,34,5,7,shine);
 p(lanternX-2,42,7,2,"#c79c54");p(lanternX+1,35,2,3,dark?"#b2fcff":"#ffe9aa");
 if(stage===2){p(7,30,3,4,"#36778a");}if(stage===4){p(4,36,2,6,"#249aaf");p(34,37,3,6,"#26aac1");}
 // The attack/dash lean is integrated into the direction; no foot-cycle when stopped.
 ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(spriteCanvas,Math.round(x-26),Math.round(y-48),52,62);ctx.restore();
 circle(x+(swordLeft?-14:14),y+7,9,dark?"#2ac9dc18":"#ffaf2718");
}
function knight(x,y,enemy=false){drawKnightSprite(x,y,enemy,enemy?400:player.corrupt,1,enemy?2:animation.direction,enemy?"idle":animation.state,enemy?0:animation.walkTime);}
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