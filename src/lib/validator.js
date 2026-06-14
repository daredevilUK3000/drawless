// Validator: REST-IN-BOX win rule, NO walls.
// Win = ball centre inside the goal AND speed < REST_SPEED, for SETTLE frames.
"use strict";
const Matter = require('matter-js');
const { Engine, Bodies, Body, Composite } = Matter;
const STEP=1000/60, STROKE_W=12, VH=600, SETTLE=10, REST_SPEED=0.4;

function polyLen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return Math.round(L);}
function buildWorld(p,pts){
  const engine=Engine.create();engine.gravity.y=p.world.gravity;const all=[];
  for(const d of p.bodies){const o={isStatic:true,friction:d.friction!=null?d.friction:0.05,restitution:d.restitution!=null?d.restitution:0.05,label:'static'};
    all.push(d.type==='rect'?Bodies.rectangle(d.x,d.y,d.w,d.h,Object.assign({angle:d.angle||0},o)):Bodies.circle(d.x,d.y,d.r,o));}
  all.push(Bodies.rectangle(-12,VH/2,24,VH*2,{isStatic:true,label:'wall'}));
  all.push(Bodies.rectangle(812,VH/2,24,VH*2,{isStatic:true,label:'wall'}));
  const ball=Bodies.circle(p.ball.x,p.ball.y,p.ball.r,{restitution:p.ball.restitution,friction:p.ball.friction,frictionAir:p.ball.frictionAir,density:p.ball.density,label:'ball'});
  all.push(ball);
  if(pts&&pts.length>=2){const lo={isStatic:true,friction:0.05,restitution:0.05,label:'line'};
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<0.5)continue;all.push(Bodies.rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,d,STROKE_W,Object.assign({angle:Math.atan2(b[1]-a[1],b[0]-a[0])},lo)));}
    for(const q of pts)all.push(Bodies.circle(q[0],q[1],STROKE_W/2,lo));}
  Composite.add(engine.world,all);
  return {engine,ball};
}
function simulate(p,pts,dvx,dvy){
  const {engine,ball}=buildWorld(p,pts);
  Body.setVelocity(ball,{x:p.ball.nudge.x+(dvx||0),y:p.ball.nudge.y+(dvy||0)});
  const gx1=p.goal.x-p.goal.w/2,gx2=p.goal.x+p.goal.w/2,gy1=p.goal.y-p.goal.h/2,gy2=p.goal.y+p.goal.h/2;
  let t=0,rest=0,solved=false;
  while(t<p.world.simMaxMs){Engine.update(engine,STEP);t+=STEP;const c=ball.position;
    const sp=Math.hypot(ball.velocity.x,ball.velocity.y);
    const inGoal=c.x>=gx1&&c.x<=gx2&&c.y>=gy1&&c.y<=gy2;
    if(inGoal&&sp<REST_SPEED){if(++rest>=SETTLE){solved=true;break;}}else rest=0;
    if(c.y>p.world.killY)break;
    // if it's come to a dead stop OUTSIDE the goal, no point continuing
    if(t>1500&&!inGoal&&sp<0.04)break;}
  Engine.clear(engine);return {solved,ms:t};
}
function robust(p,pts){if(!simulate(p,pts).solved)return false;
  const P=[[0.04,0],[-0.04,0],[0,0.04],[0,-0.04],[0.03,0.03],[-0.03,-0.03]];let ok=0;
  for(const[a,b]of P)if(simulate(p,pts,a,b).solved)ok++;return ok>=P.length;}
module.exports={simulate,robust,polyLen,REST_SPEED};

// ---- ink measurement matching the client's canonical simplification ----
// The client samples points only when >= MIN_POINT_DIST apart; the server must
// measure the SAME way so its ink number matches what the player saw.
const MIN_POINT_DIST = 5;
function simplify(points){
  if(!Array.isArray(points) || points.length < 2) return [];
  const out = [points[0]];
  for(let i=1;i<points.length;i++){
    const last = out[out.length-1];
    if(Math.hypot(points[i][0]-last[0], points[i][1]-last[1]) >= MIN_POINT_DIST) out.push(points[i]);
  }
  if(out.length < 2) out.push(points[points.length-1]);
  return out;
}
module.exports.simplify = simplify;
module.exports.MIN_POINT_DIST = MIN_POINT_DIST;
