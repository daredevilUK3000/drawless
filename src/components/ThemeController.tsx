'use client';
// Applies the active theme to the page and offers a theme picker. Persists the
// choice to the player's profile (signed-in) via /api/theme. Premium themes show
// a lock for non-premium users. Broadcasts the active theme's canvas colours to
// SetClient via a window event + a shared module so the play surface tints too.
import { useEffect, useState } from 'react';
import { THEMES, getTheme, type Theme } from '@/lib/themes';

// simple shared current-theme holder the game canvas can read
export const themeStore: { current: Theme } = { current: getTheme('daylight') };

export default function ThemeController({ initialTheme, isPremium, isDev }:
  { initialTheme: string; isPremium: boolean; isDev: boolean }) {
  const [active, setActive] = useState(initialTheme);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  function apply(t: Theme) {
    themeStore.current = t;
    document.body.style.background = t.page;
    document.body.style.backgroundAttachment = 'fixed';
    // tell the canvas to repaint with new tint
    window.dispatchEvent(new CustomEvent('drawless-theme', { detail: t }));
  }

  useEffect(() => { apply(getTheme(initialTheme)); /* on mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(t: Theme) {
    if (t.premium && !isPremium && !isDev) { setMsg(t.name + ' is a Premium theme.'); return; }
    setMsg(''); setActive(t.id); apply(t); setOpen(false);
    try { await fetch('/api/theme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: t.id }) }); }
    catch { /* visual already applied; persistence is best-effort */ }
  }

  const cur = getTheme(active);
  return (
    <div style={{ marginTop: 10, fontSize: 12.5 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: '#fff', border: '1px solid #DEE4DD', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12.5, color: '#5A6772' }}>
        🎨 Theme: <b style={{ color: '#1B2733' }}>{cur.name}</b>
      </button>
      {open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {THEMES.map(t => {
            const locked = t.premium && !isPremium && !isDev;
            return (
              <button key={t.id} onClick={() => choose(t)} title={locked ? 'Premium theme' : t.name}
                style={{ position: 'relative', width: 56, height: 40, borderRadius: 6, cursor: 'pointer',
                  border: active === t.id ? '2px solid #3346D3' : '1px solid #DEE4DD',
                  background: t.page, backgroundSize: 'cover', opacity: locked ? 0.55 : 1 }}>
                {locked && <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 11 }}>🔒</span>}
              </button>
            );
          })}
        </div>
      )}
      {msg && <div style={{ color: '#5A6772', marginTop: 6 }}>{msg}{!isPremium && ' (coming soon)'}</div>}
    </div>
  );
}
