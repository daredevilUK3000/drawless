// Home page (server component): loads today's SET of puzzles and the player's
// progress, then hands off to the set client.
import { getTodaysSet, getTodaysProgress } from '@/lib/daily';
import { userClient } from '@/lib/supabase-server';
import SetClient from '@/components/SetClient';
import AuthGate from '@/components/AuthGate';
import UsernamePrompt from '@/components/UsernamePrompt';
import PremiumPanel from '@/components/PremiumPanel';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const puzzles = await getTodaysSet();
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  let username: string | null = null;
  if (user) {
    const { data: prof } = await supa.from('profiles').select('display_name').eq('user_id', user.id).single();
    username = prof?.display_name ?? null;
  }
  const progress = await getTodaysProgress(user?.id ?? null);

  if (!puzzles || !puzzles.length) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '.14em' }}>
          DRAW<span style={{ color: '#3346D3' }}>LESS</span>
        </h1>
        <p>No puzzle set scheduled for today yet. Run the seed script to populate the daily rotation.</p>
        <Footer />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 12 }}>
      {!user && <AuthGate />}
      {user && <UsernamePrompt />}
      <SetClient puzzles={puzzles} progress={progress} signedIn={!!user} username={username} />
      {user && <PremiumPanel />}
      <Footer />
    </main>
  );
}
