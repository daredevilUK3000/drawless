'use client';
// Simple account panel: who you're signed in as, streak, and sign out.
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase-client';

export default function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supa = browserClient();
    supa.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setUsername(d.username); setStreak(d.current_streak || 0); }
    }).catch(() => {});
  }, []);

  async function signOut() {
    const supa = browserClient();
    await supa.auth.signOut();
    window.location.reload();
  }

  if (!email) return null;

  return (
    <div style={{ marginTop: 14, fontSize: 12.5, color: '#5A6772' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#5A6772', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 12.5 }}>
        {open ? 'Hide account' : 'Account'}
      </button>
      {open && (
        <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
          <div>Signed in as <b style={{ color: '#1B2733' }}>{email}</b></div>
          {username && <div style={{ marginTop: 4 }}>Username: <b style={{ color: '#1B2733' }}>{username}</b></div>}
          <div style={{ marginTop: 4 }}>{streak > 0 ? `🔥 ${streak}-day streak` : 'No streak yet'}</div>
          <button onClick={signOut} style={{ marginTop: 10, background: '#F1F3F0', color: '#1B2733', border: '1px solid #DEE4DD', borderRadius: 5, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
