'use client';
// Magic-link sign-in. Player enters email, gets a link, returns logged in.
// Until signed in they can still PLAY, but scores aren't recorded.
import { useState } from 'react';
import { browserClient } from '@/lib/supabase-client';

export default function AuthGate() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!email) return;
    setBusy(true);
    const supa = browserClient();
    await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
    });
    setSent(true); setBusy(false);
  }

  return (
    <div style={{ border: '1px solid #DEE4DD', background: '#fff', borderRadius: 8, padding: '12px 14px', marginBottom: 10, fontSize: 14 }}>
      {sent ? (
        <span>Check your email for a magic link to save your scores and streak.</span>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#5A6772' }}>Play free below. Sign in to save your score &amp; streak:</span>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
            style={{ flex: 1, minWidth: 180, padding: '7px 10px', border: '1px solid #DEE4DD', borderRadius: 5 }} />
          <button onClick={send} disabled={busy}
            style={{ background: '#3346D3', color: '#fff', border: 'none', borderRadius: 5, padding: '8px 14px', fontWeight: 600, cursor: 'pointer' }}>
            {busy ? '…' : 'Send link'}
          </button>
        </div>
      )}
    </div>
  );
}
