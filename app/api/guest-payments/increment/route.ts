import { NextResponse } from "next/server";
import {
  getGuestPayment,
  updateGuestBalance,
  createOrUpdateGuestPayment,
} from "@/lib/server-store";

// POST /api/guest-payments/increment - Increment guest balance from Web Monetization streaming
// This is called when we receive amountSent events from Web Monetization
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guestId, sessionId, amountReceived, assetCode, assetScale } = body;

    if (!guestId || !sessionId || amountReceived === undefined) {
      return NextResponse.json(
        { error: "guestId, sessionId, and amountReceived are required" },
        { status: 400 }
      );
    }

    // Get current balance
    const guestPayment = await getGuestPayment(guestId, sessionId);
    const previousTotal = guestPayment?.totalReceived || 0;
    const newTotal = previousTotal + amountReceived;

    // Get session to log host wallet address
    const { getSession } = await import("@/lib/server-store");
    const session = await getSession(sessionId);
    const hostWalletAddress = session?.hostWalletAddress || "not set";

    console.log("[PAYMENT STREAM] Incrementing balance from Web Monetization stream", {
      guestId,
      sessionId,
      hostWalletAddress,
      amountReceived,
      amountDisplay: (amountReceived / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2),
      previousTotal: (previousTotal / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2),
      newTotal: (newTotal / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2),
      currency: assetCode || "USD",
      timestamp: new Date().toISOString(),
    });
    
    console.log("[PAYMENT VERIFICATION] Payment should be streaming to host wallet", {
      hostWalletAddress,
      amountStreamed: (amountReceived / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2),
      currency: assetCode || "USD",
      note: "Check host wallet to verify payment receipt",
      timestamp: new Date().toISOString(),
    });

    // Update balance by incrementing
    const updated = await updateGuestBalance(
      guestId,
      sessionId,
      amountReceived,
      assetCode || "USD",
      assetScale || 2,
      true // increment = true
    );

    return NextResponse.json({
      success: true,
      guestPayment: updated,
      previousTotal,
      newTotal,
      amountReceived,
    });
  } catch (error) {
    console.error("[PAYMENT ERROR] Increment guest balance error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to increment guest balance" },
      { status: 500 }
    );
  }
}

