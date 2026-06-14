// Username management.
//   GET  /api/profile          -> { username, current_streak, longest_streak }
//   POST /api/profile { username } -> claims a unique username for the logged-in user
//
// Uniqueness is enforced by a case-insensitive unique index (see migration).
// We surface a friendly "taken" error rather than a raw DB constraint message.
import { NextRequest, NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const RESERVED = new Set(['anonymous', 'admin', 'drawless', 'system', 'null', 'undefined']);

function validate(name: string): string | null {
  if (typeof name !== 'string') return 'Username required.';
  const n = name.trim();
  if (n.length < 3) return 'Too short (min 3 characters).';
  if (n.length > 18) return 'Too long (max 18 characters).';
  if (!/^[a-zA-Z0-9_]+$/.test(n)) return 'Letters, numbers and underscore only.';
  if (RESERVED.has(n.toLowerCase())) return 'That name is reserved.';
  return null;
}

export async function GET() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { data } = await supa.from('profiles')
    .select('display_name,current_streak,longest_streak').eq('user_id', user.id).single();
  return NextResponse.json({
    username: data?.display_name ?? null,
    current_streak: data?.current_streak ?? 0,
    longest_streak: data?.longest_streak ?? 0
  });
}

export async function POST(req: NextRequest) {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const name = (body?.username ?? '').trim();
  const invalid = validate(name);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Pre-check (friendly): is it already taken by someone else?
  const { data: existing } = await supa.from('profiles')
    .select('user_id').ilike('display_name', name).maybeSingle();
  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'That username is taken — try another.' }, { status: 409 });
  }

  // Claim it. The unique index is the real guard against races.
  const { error } = await supa.from('profiles')
    .update({ display_name: name }).eq('user_id', user.id);
  if (error) {
    // 23505 = unique_violation (someone grabbed it microseconds before us)
    if ((error as any).code === '23505') return NextResponse.json({ error: 'That username is taken — try another.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ username: name });
}
