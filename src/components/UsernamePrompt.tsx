'use client';
// Shows once for a signed-in player who hasn't claimed a username yet.
// Also shows their current streak. Self-contained; talks to /api/profile.
import { useEffect, useState } from 'react';

export default function UsernamePrompt() {
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setUsername(d.username); setStreak(d.current_streak || 0); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function claim() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: input }) });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'Could not save.'); }
      else { setUsername(d.username); }
    } catch { setErr('Network error.'); }
    setBusy(false);
  }

  if (!loaded) return null;

  // Already has a username: show a small streak line.
  if (username) {
    return (
      <div style={{ fontSize: 12.5, color: '#5A6772', marginBottom: 8 }}>
        Playing as <b style={{ color: '#1B2733' }}>{username}</b>{streak > 0 ? ` · 🔥 ${streak}-day streak` : ''}
      </div>
    );
  }

  // No username yet: prompt to claim one.
  return (
    <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 10, fontSize: 14 }}>
      <div style={{ marginBottom: 6, color: '#1B2733', fontWeight: 600 }}>Choose a username</div>
      <div style={{ fontSize: 12.5, color: '#5A6772', marginBottom: 8 }}>
        It shows on the leaderboard and on the puzzles you share. 3–18 characters, letters/numbers/underscore.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. inkwizard" maxLength={18}
          onKeyDown={e => { if (e.key === 'Enter') claim(); }}
          style={{ flex: 1, minWidth: 160, padding: '7px 10px', border: '1px solid #DEE4DD', borderRadius: 5 }} />
        <button onClick={claim} disabled={busy}
          style={{ background: '#3346D3', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}>
          {busy ? '…' : 'Claim'}
        </button>
      </div>
      {err && <div style={{ color: '#C8472F', fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
