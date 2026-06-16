'use client';
// Premium panel: shows unlock (Gumroad licence) for free users, or archive/stats
// links + streak-freeze count for premium users. Self-contained; uses /api/premium.
import { useEffect, useState } from 'react';

const GUMROAD_URL = process.env.NEXT_PUBLIC_GUMROAD_URL || '#';

// Premium isn't launched yet. While false, the upsell prompt is hidden entirely
// so we never advertise a tier that can't be bought. Flip to true (and set the
// Gumroad env vars) on launch day — no other change needed.
const PREMIUM_LAUNCHED = false;

export default function PremiumPanel() {
  const [loaded, setLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [freezes, setFreezes] = useState(0);
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/premium').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setIsPremium(!!d.isPremium); setFreezes(d.streakFreezes || 0); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function unlock() {
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/premium', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ license: key }) });
      const d = await res.json();
      if (!res.ok) setErr(d.error || 'Could not verify.');
      else { setIsPremium(true); setOpen(false); }
    } catch { setErr('Network error.'); }
    setBusy(false);
  }

  if (!loaded) return null;

  // Hide the upsell until premium actually launches (but still show the panel to
  // anyone already flagged premium, e.g. for testing).
  if (!isPremium && !PREMIUM_LAUNCHED) return null;

  if (isPremium) {
    return (
      <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: '#C99A2E', marginBottom: 4 }}>★ Premium</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/archive" style={linkBtn}>📚 Puzzle archive</a>
          <a href="/stats" style={linkBtn}>📊 My stats</a>
          <span style={{ color: '#5A6772' }}>❄️ {freezes} streak freeze{freezes === 1 ? '' : 's'}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '12px 14px', marginTop: 14, fontSize: 13 }}>
      {!open ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ color: '#5A6772' }}>
            <b style={{ color: '#1B2733' }}>Go Premium</b> — replay the full puzzle archive, see your stats, and protect your streak.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={GUMROAD_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, background: '#3346D3', color: '#fff', border: 'none' }}>Get it</a>
            <button onClick={() => setOpen(true)} style={{ ...linkBtn, cursor: 'pointer' }}>I have a key</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 6, color: '#1B2733', fontWeight: 600 }}>Enter your DrawLess license key</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={key} onChange={e => setKey(e.target.value)} placeholder="XXXXXXXX-XXXXXXXX-…"
              style={{ flex: 1, minWidth: 200, padding: '7px 10px', border: '1px solid #DEE4DD', borderRadius: 5 }} />
            <button onClick={unlock} disabled={busy} style={{ ...linkBtn, background: '#3346D3', color: '#fff', border: 'none', cursor: 'pointer' }}>{busy ? '…' : 'Unlock'}</button>
          </div>
          {err && <div style={{ color: '#C8472F', marginTop: 6 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  textDecoration: 'none', color: '#1B2733', border: '1px solid #DEE4DD', borderRadius: 5,
  padding: '7px 12px', fontWeight: 600, fontSize: 13, display: 'inline-block'
};
