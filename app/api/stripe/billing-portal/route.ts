import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe-server";
import { getSupabaseServiceRole } from "@/lib/supabase-service-role";

/**
 * Opens Stripe Customer Billing Portal for users with `stripe_customer_id` (typically monthly Pro subscribers).
 * Body: { userId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (error || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account on file" },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const stripe = getStripeServer();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[billing-portal]", e);
    return NextResponse.json({ error: "Portal failed" }, { status: 500 });
  }
}
