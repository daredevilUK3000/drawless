'use client';
// DrawLess game client — full-featured.
// Server-matched physics + rest-to-win rule. On solve: POST /api/solve, show the
// SERVER's verified result, fetch ghost lines, celebrate, and offer a share card.
//
// Features ported from the offline build:
//   - ghost lines (overlay + watch-replay)
//   - generative ambient audio + SFX (Web Audio, header toggle)
//   - celebration card with tiered praise
//   - visual share card (puzzle + your line + ink + username) -> PNG download
//   - per-tier background tints, major/minor grid

import { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';

const VW = 800, VH = 600, STROKE_W = 12, MIN_POINT_DIST = 5, STEP = 1000 / 60;
const SETTLE_FRAMES = 10, REST_SPEED = 0.4;

type Pt = [number, number];
type Ghost = { tag?: string; ink: number; line: Pt[]; display_name?: string };
type Puzzle = { id: string; number: number; name: string; difficulty: string; definition: any; world_best: number | null; };

// ---------- generative audio (Web Audio; no files) ----------
function makeAudio() {
  let ctx: AudioContext | null = null, master: GainNode | null = null, padGain: GainNode | null = null;
  let on = false, padTimer: any = null;
  const PADS = [174.6, 196.0, 220.0, 261.6, 293.7, 329.6];
  function ensure() {
    if (ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    padGain = ctx.createGain(); padGain.gain.value = 0; padGain.connect(master);
  }
  function note(freq: number, dur: number, peak: number, type: OscillatorType, dest?: AudioNode) {
    if (!ctx || !master) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = freq;
    const t = ctx.currentTime; g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.08, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedulePad() {
    if (!on || !ctx || !padGain) return;
    const base = PADS[Math.floor(Math.random() * PADS.length)]; const dur = 6 + Math.random() * 5;
    [base, base * 1.5].forEach((fr, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = 'sine'; o.frequency.value = fr * (i ? 1.003 : 0.997);
      const t = ctx!.currentTime; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(padGain!); o.start(t); o.stop(t + dur + 0.1);
    });
    padTimer = setTimeout(schedulePad, (2.5 + Math.random() * 3) * 1000);
  }
  return {
    toggle() {
      ensure(); if (!ctx || !master || !padGain) return false;
      if (ctx.state === 'suspended') ctx.resume();
      on = !on; const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.linearRampToValueAtTime(on ? 0.5 : 0, t + 0.6);
      padGain.gain.cancelScheduledValues(t); padGain.gain.linearRampToValueAtTime(on ? 0.6 : 0, t + 0.6);
      if (on) { if (!padTimer) schedulePad(); } else { clearTimeout(padTimer); padTimer = null; }
      return on;
    },
    draw() { if (on && ctx) note(660, 0.04, 0.015, 'triangle'); },
    release() { if (on && ctx) { note(160, 0.5, 0.12, 'sine'); note(240, 0.4, 0.05, 'sine'); } },
    win() { if (on && ctx) [523.3, 659.3, 784.0].forEach((fr, i) => setTimeout(() => note(fr, 1.1, 0.16, 'sine'), i * 90)); },
    miss() { if (on && ctx) { note(196, 0.5, 0.10, 'sine'); note(185, 0.55, 0.06, 'sine'); } }
  };
}

export default function GameClient({ puzzle, signedIn, username }: { puzzle: Puzzle; signedIn: boolean; username?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ink, setInk] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [solved, setSolved] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [ghostsOn, setGhostsOn] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const ghostsOnRef = useRef(false);
  const ghostsRef = useRef<Ghost[]>([]);
  const replayRef = useRef<{ active: boolean; name: string }>({ active: false, name: '' });
  const stateRef = useRef<any>({ phase: 'ready', pts: [] as Pt[] });
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const myLineRef = useRef<Pt[]>([]);

  const def = puzzle.definition;

  useEffect(() => { ghostsOnRef.current = ghostsOn; }, [ghostsOn]);
  useEffect(() => { ghostsRef.current = ghosts; }, [ghosts]);
  useEffect(() => { audioRef.current = makeAudio(); }, []);

  const loadGhosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard?puzzle=${encodeURIComponent(puzzle.id)}`);
      const data = await res.json();
      if (Array.isArray(data.ghosts) && data.ghosts.length) setGhosts(data.ghosts);
      else if (Array.isArray(data.top) && data.top.length) setGhosts(data.top.slice(0, 3));
    } catch { /* optional */ }
  }, [puzzle.id]);

  useEffect(() => {
    const { Engine, Bodies, Body, Composite } = Matter;
    const engine = Engine.create(); engine.gravity.y = def.world.gravity;
    const statics: any[] = [];
    for (const d of def.bodies) {
      const o: any = { isStatic: true, friction: d.friction ?? 0.05, restitution: d.restitution ?? 0.05 };
      statics.push(d.type === 'rect' ? Bodies.rectangle(d.x, d.y, d.w, d.h, { angle: d.angle || 0, ...o }) : Bodies.circle(d.x, d.y, d.r, o));
    }
    statics.push(Bodies.rectangle(-12, VH/2, 24, VH*2, { isStatic: true }));
    statics.push(Bodies.rectangle(VW+12, VH/2, 24, VH*2, { isStatic: true }));
    const ball = Bodies.circle(def.ball.x, def.ball.y, def.ball.r, { restitution: def.ball.restitution, friction: def.ball.friction, frictionAir: def.ball.frictionAir, density: def.ball.density });
    Composite.add(engine.world, [...statics, ball]);
    const S = stateRef.current;

    let lineBodies: any[] = [];
    let insideFrames = 0, simMs = 0, acc = 0, last = performance.now(), raf = 0, ghostAnim = 0;
    let settleMs = 0; const GRACE = 260, SETTLE_DURATION = 900;

    function polyLen(pts: Pt[]) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); return Math.round(L); }
    function buildLine(pts: Pt[]) {
      const opts: any = { isStatic: true, friction: 0.05, restitution: 0.05 };
      for (let i = 1; i < pts.length; i++) { const [x1,y1]=pts[i-1],[x2,y2]=pts[i]; const d=Math.hypot(x2-x1,y2-y1); if(d<0.5)continue; lineBodies.push(Bodies.rectangle((x1+x2)/2,(y1+y2)/2,d,STROKE_W,{angle:Math.atan2(y2-y1,x2-x1),...opts})); }
      for (const p of pts) lineBodies.push(Bodies.circle(p[0],p[1],STROKE_W/2,opts));
      Composite.add(engine.world, lineBodies);
    }
    function clearLine() { for (const b of lineBodies) Composite.remove(engine.world, b); lineBodies = []; }
    function resetBall() { Body.setPosition(ball,{x:def.ball.x,y:def.ball.y}); Body.setVelocity(ball,{x:0,y:0}); Body.setAngularVelocity(ball,0); }
    function startSim(pts: Pt[]) { buildLine(pts); Body.setVelocity(ball,{x:def.ball.nudge.x,y:def.ball.nudge.y}); simMs=0; insideFrames=0; S.phase='running'; }

    function loop(now: number) {
      const dt = now - last; last = now;
      if (S.phase === 'running') {
        acc += dt; if (acc > STEP*8) acc = STEP*8; let steps = 0;
        const g = def.goal; const gx1=g.x-g.w/2,gx2=g.x+g.w/2,gy1=g.y-g.h/2,gy2=g.y+g.h/2;
        while (acc >= STEP && steps < 8) {
          Engine.update(engine, STEP); acc -= STEP; simMs += STEP; steps++;
          const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
          const inGoal = ball.position.x>=gx1 && ball.position.x<=gx2 && ball.position.y>=gy1 && ball.position.y<=gy2;
          if (inGoal && sp < REST_SPEED) { if (++insideFrames >= SETTLE_FRAMES) { beginSettle(); break; } } else insideFrames = 0;
          if (ball.position.y > def.world.killY) { onEnd(false); break; }
          if (simMs >= def.world.simMaxMs) { onEnd(false); break; }
        }
      } else if (S.phase === 'settling') {
        // gentle natural come-to-rest after the win is locked
        let steps = 0; acc += dt; if (acc > STEP*8) acc = STEP*8;
        while (acc >= STEP && steps < 8) {
          Engine.update(engine, STEP); acc -= STEP; settleMs += STEP; steps++;
          if (settleMs > GRACE) { const prog = Math.min(1,(settleMs-GRACE)/(SETTLE_DURATION-GRACE)); const damp = 1-(0.06+0.20*prog); Body.setVelocity(ball,{x:ball.velocity.x*damp,y:ball.velocity.y*damp}); }
          const slow = Math.hypot(ball.velocity.x,ball.velocity.y) < 0.25;
          if (settleMs >= SETTLE_DURATION || (settleMs > GRACE+120 && slow)) { Body.setVelocity(ball,{x:0,y:0}); finishWin(); break; }
        }
      }
      draw(); raf = requestAnimationFrame(loop);
    }

    function beginSettle() {
      S.phase = 'settling'; settleMs = 0;
      if (!replayRef.current.active) audioRef.current?.win();
    }
    function finishWin() {
      S.phase = 'cooldown';
      if (replayRef.current.active) {
        setTimeout(() => { clearLine(); resetBall(); S.pts=[]; S.phase='ready'; replayRef.current.active=false; }, 1000);
      } else {
        myLineRef.current = S.pts.slice();
        submitSolve(S.pts.slice());
        setTimeout(() => { clearLine(); resetBall(); S.pts=[]; S.phase='ready'; }, 1400);
      }
    }
    function onEnd(_win: boolean) {
      S.phase = 'cooldown'; const wasReplay = replayRef.current.active;
      if (!wasReplay) audioRef.current?.miss();
      setTimeout(() => { clearLine(); resetBall(); S.pts=[]; S.phase='ready'; if (wasReplay) replayRef.current.active=false; }, 800);
    }

    function draw() {
      const ctx = canvasRef.current!.getContext('2d')!;
      const tint = TIER_BG[def.difficulty] || TIER_BG['easy'];
      const grad = ctx.createLinearGradient(0,0,0,VH); grad.addColorStop(0,tint.top); grad.addColorStop(1,tint.bot);
      ctx.fillStyle = grad; ctx.fillRect(0,0,VW,VH);
      ctx.strokeStyle = '#DEE4DD'; ctx.lineWidth=1; ctx.globalAlpha=0.55; ctx.beginPath();
      for (let x=40;x<VW;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,VH);} for (let y=40;y<VH;y+=40){ctx.moveTo(0,y);ctx.lineTo(VW,y);} ctx.stroke(); ctx.globalAlpha=1;
      ctx.lineWidth=1.5; ctx.globalAlpha=0.9; ctx.beginPath();
      for (let x=200;x<VW;x+=200){ctx.moveTo(x,0);ctx.lineTo(x,VH);} for (let y=200;y<VH;y+=200){ctx.moveTo(0,y);ctx.lineTo(VW,y);} ctx.stroke(); ctx.globalAlpha=1;
      const g = def.goal; ctx.strokeStyle='#1E9E6A'; ctx.lineWidth=2.5; ctx.setLineDash([8,7]); ctx.strokeRect(g.x-g.w/2,g.y-g.h/2,g.w,g.h); ctx.setLineDash([]);
      ctx.font='700 12px ui-monospace,Menlo,monospace'; ctx.textAlign='center'; ctx.fillStyle='#1E9E6A'; ctx.fillText('TARGET', g.x, g.y-g.h/2-8);
      ctx.fillStyle='#1B2733';
      for (const d of def.bodies) { ctx.save(); if (d.type==='rect'){ctx.translate(d.x,d.y);ctx.rotate(d.angle||0);ctx.fillRect(-d.w/2,-d.h/2,d.w,d.h);} else {ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);ctx.fill();} ctx.restore(); }
      if (ghostsOnRef.current && ghostsRef.current.length) {
        if (ghostAnim<1) ghostAnim=Math.min(1,ghostAnim+0.02); const gs=ghostsRef.current;
        for (let i=0;i<gs.length;i++){ const gl=gs[i]; if(!gl.line||gl.line.length<2)continue; const best=i===0; const n=Math.max(2,Math.ceil(gl.line.length*ghostAnim));
          ctx.save(); ctx.globalAlpha=0.4; ctx.strokeStyle=best?'#C8472F':'#5A6772'; ctx.lineWidth=STROKE_W; ctx.lineJoin='round'; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(gl.line[0][0],gl.line[0][1]); for(let k=1;k<n;k++)ctx.lineTo(gl.line[k][0],gl.line[k][1]); ctx.stroke(); ctx.restore();
          if (ghostAnim>=1){ const e=gl.line[gl.line.length-1]; ctx.save(); ctx.font='11px ui-monospace,Menlo,monospace'; ctx.fillStyle=best?'#C8472F':'#5A6772'; ctx.textAlign='left'; ctx.fillText((gl.display_name||'player')+' — '+gl.ink+'px'+(best?' (BEST)':''), e[0]+10, e[1]+4); ctx.restore(); }
        }
      } else ghostAnim=0;
      if (S.pts.length>=2){ ctx.strokeStyle=replayRef.current.active?'#C8472F':'#3346D3'; ctx.lineWidth=STROKE_W; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(S.pts[0][0],S.pts[0][1]); for(let i=1;i<S.pts.length;i++)ctx.lineTo(S.pts[i][0],S.pts[i][1]); ctx.stroke(); }
      ctx.fillStyle='#3346D3'; ctx.beginPath(); ctx.arc(ball.position.x,ball.position.y,def.ball.r,0,Math.PI*2); ctx.fill();
    }

    const canvas = canvasRef.current!;
    function toV(e: PointerEvent): Pt { const r=canvas.getBoundingClientRect(); return [(e.clientX-r.left)*VW/r.width,(e.clientY-r.top)*VH/r.height]; }
    function down(e: PointerEvent){ if(S.phase!=='ready')return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); S.phase='drawing'; S.pts=[toV(e)]; }
    function move(e: PointerEvent){ if(S.phase!=='drawing')return; e.preventDefault(); const p=toV(e); const lp=S.pts[S.pts.length-1]; if(Math.hypot(p[0]-lp[0],p[1]-lp[1])>=MIN_POINT_DIST && S.pts.length<500){ S.pts.push(p); setInk(polyLen(S.pts)); if(S.pts.length%3===0) audioRef.current?.draw(); } }
    function up(e: PointerEvent){ if(S.phase!=='drawing')return; e.preventDefault(); if(S.pts.length<2||polyLen(S.pts)<12){S.pts=[];S.phase='ready';setInk(0);return;} audioRef.current?.release(); startSim(S.pts); }
    canvas.addEventListener('pointerdown',down); canvas.addEventListener('pointermove',move); canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);

    S.replay = (line: Pt[], name: string) => { if (S.phase!=='ready') return; replayRef.current={active:true,name}; S.pts=line.map(q=>[q[0],q[1]] as Pt); startSim(S.pts); };

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown',down); canvas.removeEventListener('pointermove',move); canvas.removeEventListener('pointerup',up); canvas.removeEventListener('pointercancel',up); Engine.clear(engine); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  async function submitSolve(line: Pt[]) {
    setSolved(true);
    if (!signedIn) { setResult({ solved: true, local: true, localInk: localInk(line) }); loadGhosts(); return; }
    setSubmitting(true);
    try { const res = await fetch('/api/solve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ line }) }); setResult(await res.json()); }
    catch { setResult({ error: 'network' }); }
    setSubmitting(false); loadGhosts();
  }
  function localInk(line: Pt[]) { let L=0; for(let i=1;i<line.length;i++)L+=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]); return Math.round(L); }

  function toggleSound() { const now = audioRef.current?.toggle() ?? false; setSoundOn(now); }

  // ---------- visual share card ----------
  function downloadShareCard() {
    const myInk = result?.local ? result.localInk : result?.ink;
    if (myInk == null) return;
    const W=1080,H=1080; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d')!;
    const tint = TIER_BG[def.difficulty] || TIER_BG['easy'];
    const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,tint.top); g.addColorStop(1,tint.bot); x.fillStyle=g; x.fillRect(0,0,W,H);
    x.fillStyle='#1B2733'; x.textAlign='left'; x.font='800 52px ui-monospace,Menlo,monospace'; x.fillText('DRAWLESS',70,110);
    x.fillStyle='#3346D3'; x.fillText('#'+String(puzzle.number).padStart(3,'0'), 70+x.measureText('DRAWLESS ').width, 110);
    x.fillStyle='#5A6772'; x.font='26px -apple-system,Segoe UI,sans-serif'; x.textAlign='right'; x.fillText(puzzle.name+'  ·  '+puzzle.difficulty.toUpperCase(), W-70, 104);
    const pad=70, fw=W-pad*2, fh=fw*(VH/VW), oy=180, ox=pad, sc=fw/VW;
    x.save(); x.translate(ox,oy); x.scale(sc,sc);
    x.fillStyle='#F1F3F0'; x.fillRect(0,0,VW,VH);
    x.strokeStyle='#DEE4DD'; x.lineWidth=1; x.globalAlpha=0.5; x.beginPath();
    for(let gx=40;gx<VW;gx+=40){x.moveTo(gx,0);x.lineTo(gx,VH);} for(let gy=40;gy<VH;gy+=40){x.moveTo(0,gy);x.lineTo(VW,gy);} x.stroke(); x.globalAlpha=1;
    x.fillStyle='#1B2733'; for (const d of def.bodies){ x.save(); if(d.type==='rect'){x.translate(d.x,d.y);x.rotate(d.angle||0);x.fillRect(-d.w/2,-d.h/2,d.w,d.h);} else {x.beginPath();x.arc(d.x,d.y,d.r,0,Math.PI*2);x.fill();} x.restore(); }
    const G=def.goal; x.strokeStyle='#1E9E6A'; x.lineWidth=3; x.setLineDash([10,8]); x.strokeRect(G.x-G.w/2,G.y-G.h/2,G.w,G.h); x.setLineDash([]);
    const pts=myLineRef.current||[];
    if (pts.length>=2){ x.strokeStyle='#3346D3'; x.lineWidth=STROKE_W; x.lineJoin='round'; x.lineCap='round'; x.beginPath(); x.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]); x.stroke(); }
    x.fillStyle='#3346D3'; x.beginPath(); x.arc(def.ball.x,def.ball.y,def.ball.r,0,Math.PI*2); x.fill();
    x.restore();
    x.textAlign='center'; x.fillStyle='#3346D3'; x.font='800 130px ui-monospace,Menlo,monospace'; x.fillText(String(myInk), W/2, oy+fh+170);
    x.fillStyle='#5A6772'; x.font='34px ui-monospace,Menlo,monospace'; x.fillText('PIXELS OF INK', W/2, oy+fh+212);
    x.fillStyle='#1B2733'; x.font='28px -apple-system,Segoe UI,sans-serif';
    const who = username ? username+'  ·  ' : '';
    x.fillText(who+'Can you draw less?', W/2, oy+fh+260);
    const fname='drawless-'+String(puzzle.number).padStart(3,'0')+'-'+myInk+'px.png';
    const caption='DrawLess #'+String(puzzle.number).padStart(3,'0')+' — '+myInk+'px. Can you draw less?';
    c.toBlob(async (blob) => {
      if(!blob) return;
      const file = new File([blob], fname, { type: 'image/png' });
      // 1) Native share sheet (mobile) — share the IMAGE if the device supports it.
      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
        try { await navAny.share({ files: [file], text: caption, title: 'DrawLess' }); return; }
        catch (e:any) { if (e && e.name === 'AbortError') return; /* user cancelled */ }
      }
      // 2) Fallback (desktop / unsupported): download the PNG.
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),2000);
    }, 'image/png');
  }

  const praise = (() => {
    const myInk = result?.local ? result.localInk : result?.ink;
    if (myInk == null) return null;
    const wb = result?.worldBest ?? puzzle.world_best;
    const avg = result?.worldAvg ?? def?.stats?.worldAvg;
    if (wb && myInk <= wb * 1.15) return { text: 'Masterful line. 🏆', color: '#C99A2E' };
    if (avg && myInk < avg) return { text: 'Beautifully efficient! ✨', color: '#1E9E6A' };
    return { text: 'Solved! 🎉', color: '#1E9E6A' };
  })();

  return (
    <div>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <h1 style={{ fontFamily:'ui-monospace, Menlo, monospace', letterSpacing:'.14em', fontSize:20, margin:0 }}>
          DRAW<span style={{color:'#3346D3'}}>LESS</span> #{String(puzzle.number).padStart(3,'0')}
        </h1>
        <button onClick={toggleSound} aria-pressed={soundOn}
          style={{ fontFamily:'ui-monospace,Menlo,monospace', fontSize:13, fontWeight:700, border:'1px solid '+(soundOn?'#3346D3':'#DEE4DD'), background:'#fff', color:soundOn?'#3346D3':'#5A6772', padding:'8px 14px', borderRadius:6, cursor:'pointer', whiteSpace:'nowrap' }}>
          ♪ SOUND: {soundOn?'ON':'OFF'}
        </button>
      </header>
      <p style={{ fontSize:13.5, color:'#5A6772', margin:'4px 0 2px' }}>Draw one line. Get the ball to <b>come to rest</b> in the target. Shortest ink wins.</p>
      <p style={{ fontSize:12, color:'#5A6772', margin:'0 0 8px' }}>🗓️ One new puzzle every day — come back tomorrow for the next one.</p>
      <div style={{ textAlign:'right', fontFamily:'ui-monospace,Menlo,monospace', color:'#3346D3', fontWeight:700, fontSize:14, marginBottom:6 }}>INK {ink}px</div>
      <canvas ref={canvasRef} width={VW} height={VH}
        style={{ display:'block', width:'100%', height:'auto', border:'1px solid #DEE4DD', borderRadius:8, background:'#F1F3F0', touchAction:'none', cursor:'crosshair', boxShadow:'0 8px 30px rgba(27,39,51,.12)' }} />

      {solved && ghosts.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:10 }}>
          <button onClick={()=>setGhostsOn(o=>!o)}
            style={{ fontFamily:'ui-monospace,Menlo,monospace', fontSize:12.5, border:'1px solid '+(ghostsOn?'#3346D3':'#DEE4DD'), color:ghostsOn?'#3346D3':'#5A6772', background:'#fff', padding:'7px 12px', borderRadius:4, cursor:'pointer', fontWeight:ghostsOn?700:400 }}>
            GHOST LINES: {ghostsOn?'ON':'OFF'}
          </button>
          {ghostsOn && ghosts.map((gh,i)=>(
            <button key={i} onClick={()=>stateRef.current.replay && stateRef.current.replay(gh.line, gh.display_name||'player')}
              style={{ fontFamily:'ui-monospace,Menlo,monospace', fontSize:11.5, border:'1px solid #C8472F', color:'#C8472F', background:'#fff', padding:'6px 9px', borderRadius:4, cursor:'pointer' }}>
              ▶ watch {(gh.display_name||'player')} ({gh.ink}px)
            </button>
          ))}
        </div>
      )}

      {submitting && <p style={{ fontSize:13, color:'#5A6772' }}>Verifying…</p>}
      {result && result.solved && (
        <div style={{ marginTop:12, padding:18, border:'1px solid #DEE4DD', borderRadius:8, background:'#fff' }}>
          {praise && <div style={{ color:praise.color, fontWeight:800, fontSize:20 }}>{praise.text}</div>}
          <div style={{ fontSize:48, fontWeight:800, color:'#3346D3', fontFamily:'ui-monospace, Menlo, monospace', lineHeight:1, margin:'8px 0 2px' }}>
            {result.local ? result.localInk : result.ink}<span style={{ fontSize:18, color:'#5A6772' }}>px</span>
          </div>
          {result.local
            ? <p style={{ fontSize:13, color:'#5A6772' }}>Sign in to record this and join the leaderboard.</p>
            : <p style={{ fontSize:13, color:'#5A6772' }}>World avg {result.worldAvg}px · Top {result.percentile}% · {result.total} solved today</p>}
          <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
            <button onClick={downloadShareCard}
              style={{ background:'#3346D3', color:'#fff', border:'none', borderRadius:6, padding:'11px 16px', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              📤 Share my result
            </button>
            <button onClick={()=>setGhostsOn(true)}
              style={{ background:'#F1F3F0', color:'#1B2733', border:'1px solid #DEE4DD', borderRadius:6, padding:'11px 16px', fontWeight:600, fontSize:14, cursor:'pointer' }}>
              See ghost lines
            </button>
          </div>
          <p style={{ fontSize:12.5, color:'#5A6772', marginTop:12, borderTop:'1px dashed #DEE4DD', paddingTop:10 }}>
            That's today's puzzle done. 🗓️ A new one unlocks tomorrow.
          </p>
        </div>
      )}
    </div>
  );
}

const TIER_BG: Record<string, { top: string; bot: string }> = {
  'easy':         { top:'#F4F7F4', bot:'#E7EEE9' },
  'easy-medium':  { top:'#F2F6F7', bot:'#E3ECEF' },
  'medium':       { top:'#F1F4F8', bot:'#E1E8F1' },
  'medium-hard':  { top:'#F2F2F8', bot:'#E4E2F0' },
  'hard':         { top:'#F3F0F6', bot:'#E7E0EE' },
  'grand-master': { top:'#F2EEF3', bot:'#E6DCE8' }
};
