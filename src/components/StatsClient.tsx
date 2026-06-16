'use client';
import { useEffect, useState } from 'react';

export default function StatsClient() {
  const [state, setState] = useState<'loading'|'ok'|'locked'|'error'>('loading');
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    fetch('/api/stats').then(async r => {
      if (r.status === 403) { setState('locked'); return; }
      if (!r.ok) { setState('error'); return; }
      setS(await r.json()); setState('ok');
    }).catch(() => setState('error'));
  }, []);

  if (state === 'loading') return <p style={{ color: '#5A6772' }}>Loading…</p>;
  if (state === 'locked') return <p>Stats are a Premium feature. <a href="/" style={{ color:'#3346D3' }}>Unlock on the home page.</a></p>;
  if (state === 'error' || !s) return <p>Could not load stats.</p>;

  const Stat = ({ label, value }: { label: string; value: any }) => (
    <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '14px 16px', textAlign: 'center', minWidth: 120 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#3346D3', fontFamily: 'ui-monospace, Menlo, monospace' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#5A6772' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="puzzles solved" value={s.totalSolved} />
        <Stat label="best ink" value={s.bestInk != null ? s.bestInk + 'px' : '—'} />
        <Stat label="average ink" value={s.avgInk != null ? s.avgInk + 'px' : '—'} />
        <Stat label="record ties" value={s.recordTies} />
        <Stat label="current streak" value={'🔥 ' + s.currentStreak} />
        <Stat label="longest streak" value={s.longestStreak} />
      </div>
      {s.history?.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Recent solves</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {s.history.slice(-15).reverse().map((h: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#5A6772', borderBottom: '1px dashed #DEE4DD', paddingBottom: 4 }}>
                <span>#{String(h.number).padStart(3, '0')} {h.name}</span>
                <span style={{ color: h.worldBest != null && h.ink <= h.worldBest + 2 ? '#C99A2E' : '#1B2733' }}>
                  {h.ink}px{h.worldBest != null && h.ink <= h.worldBest + 2 ? ' 🏆' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
