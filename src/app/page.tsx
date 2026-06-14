// Home page (server component): loads today's puzzle and the player's session,
// then hands off to the client game component.
import { getTodaysPuzzle } from '@/lib/daily';
import { userClient } from '@/lib/supabase-server';
import GameClient from '@/components/GameClient';
import AuthGate from '@/components/AuthGate';
import UsernamePrompt from '@/components/UsernamePrompt';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const puzzle = await getTodaysPuzzle();
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  let username: string | null = null;
  if (user) {
    const { data: prof } = await supa.from('profiles').select('display_name').eq('user_id', user.id).single();
    username = prof?.display_name ?? null;
  }

  if (!puzzle) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '.14em' }}>
          DRAW<span style={{ color: '#3346D3' }}>LESS</span>
        </h1>
        <p>No puzzle scheduled for today yet. Run the seed script to populate the daily rotation.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 12 }}>
      {!user && <AuthGate />}
      {user && <UsernamePrompt />}
      <GameClient puzzle={puzzle} signedIn={!!user} username={username} />
    </main>
  );
}
