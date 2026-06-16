// Premium unlock via Gumroad licence verification.
//   GET  /api/premium            -> { isPremium, streakFreezes }
//   POST /api/premium { license } -> verifies the key with Gumroad, marks the account premium
//
// Uses Gumroad's license verification API. Set GUMROAD_PRODUCT_ID in env to your
// DrawLess product's permalink/id. Each key unlocks exactly one account (unique index).
import { NextRequest, NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { data } = await supa.from('profiles')
    .select('is_premium,streak_freezes').eq('user_id', user.id).single();
  return NextResponse.json({ isPremium: !!data?.is_premium, streakFreezes: data?.streak_freezes ?? 0 });
}

export async function POST(req: NextRequest) {
  const supa = userClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const license = (body?.license ?? '').trim();
  if (!license) return NextResponse.json({ error: 'License key required.' }, { status: 400 });

  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  // Verify with Gumroad. increment_uses_count=false so re-checking doesn't burn a use.
  let gumroad: any;
  try {
    const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ product_id: productId, license_key: license, increment_uses_count: 'false' })
    });
    gumroad = await res.json();
  } catch {
    return NextResponse.json({ error: 'Could not reach Gumroad. Try again.' }, { status: 502 });
  }

  if (!gumroad?.success) {
    return NextResponse.json({ error: 'That license key was not recognised.' }, { status: 400 });
  }
  // Optional hardening: reject refunded/chargeback/disputed purchases.
  const purchase = gumroad.purchase || {};
  if (purchase.refunded || purchase.chargebacked || purchase.disputed) {
    return NextResponse.json({ error: 'This purchase is no longer active.' }, { status: 400 });
  }

  // Claim it for this user. Unique index stops one key unlocking many accounts.
  const { error } = await supa.from('profiles').update({
    is_premium: true, premium_since: new Date().toISOString(), gumroad_license: license
  }).eq('user_id', user.id);
  if (error) {
    if ((error as any).code === '23505') return NextResponse.json({ error: 'That key is already linked to another account.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ isPremium: true });
}
