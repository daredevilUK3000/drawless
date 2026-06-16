'use client';
import { useEffect, useState } from 'react';

export default function ArchiveClient() {
  const [state, setState] = useState<'loading'|'ok'|'locked'|'error'>('loading');
  const [puzzles, setPuzzles] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/archive').then(async r => {
      if (r.status === 403) { setState('locked'); return; }
      if (!r.ok) { setState('error'); return; }
      const d = await r.json(); setPuzzles(d.puzzles || []); setState('ok');
    }).catch(() => setState('error'));
  }, []);

  if (state === 'loading') return <p style={{ color: '#5A6772' }}>Loading…</p>;
  if (state === 'locked') return <p>The archive is a Premium feature. <a href="/" style={{ color:'#3346D3' }}>Unlock it on the home page.</a></p>;
  if (state === 'error') return <p>Could not load the archive.</p>;
  if (!puzzles.length) return <p style={{ color: '#5A6772' }}>No past puzzles yet — they appear here the day after they run.</p>;

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      {puzzles.map(p => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #DEE4DD', background: '#fff', borderRadius: 6, padding: '10px 12px' }}>
          <div>
            <b style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>#{String(p.number).padStart(3, '0')}</b> {p.name}
            <span style={{ color: '#5A6772', fontSize: 12 }}> · {p.difficulty} · {p.play_date}</span>
          </div>
          <div style={{ fontSize: 13, color: p.myInk != null ? '#1E9E6A' : '#5A6772' }}>
            {p.myInk != null ? `✓ ${p.myInk}px` : 'unsolved'}
          </div>
        </div>
      ))}
    </div>
  );
}
