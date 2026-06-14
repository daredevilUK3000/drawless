// Magic-link callback: exchanges the email link code for a session, then redirects home.
import { NextRequest, NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  if (code) {
    const supa = userClient();
    await supa.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, req.url));
}
