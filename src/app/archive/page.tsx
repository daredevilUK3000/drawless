// Premium archive page: replay past daily puzzles.
import { userClient } from '@/lib/supabase-server';
import ArchiveClient from '@/components/ArchiveClient';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default async function ArchivePage() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 12 }}>
      <a href="/" style={{ color: '#3346D3', fontSize: 13, textDecoration: 'none' }}>← Back to today's puzzle</a>
      <h1 style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '.12em', fontSize: 20 }}>PUZZLE ARCHIVE</h1>
      {!user
        ? <p>Please sign in.</p>
        : <ArchiveClient />}
      <Footer />
    </main>
  );
}
