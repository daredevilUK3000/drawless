// GET  /api/theme        -> { theme }   (the user's saved theme)
// POST /api/theme {theme} -> save it; premium themes require premium (or dev).
import { NextRequest, NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';
import { THEMES } from '@/lib/themes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ theme: 'daylight' });
  const { data } = await supa.from('profiles').select('theme').eq('user_id', user.id).single();
  return NextResponse.json({ theme: data?.theme || 'daylight' });
}

export async function POST(req: NextRequest) {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const themeId = body?.theme;
  const theme = THEMES.find(t => t.id === themeId);
  if (!theme) return NextResponse.json({ error: 'unknown_theme' }, { status: 400 });

  // Premium themes require premium (dev email always allowed).
  if (theme.premium) {
    const devEmail = process.env.DEV_EMAIL?.toLowerCase();
    const isDev = !!devEmail && user.email?.toLowerCase() === devEmail;
    const { data: prof } = await supa.from('profiles').select('is_premium').eq('user_id', user.id).single();
    if (!isDev && !prof?.is_premium) {
      return NextResponse.json({ error: 'premium_required' }, { status: 403 });
    }
  }

  const { error } = await supa.from('profiles').update({ theme: theme.id }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ theme: theme.id });
}
