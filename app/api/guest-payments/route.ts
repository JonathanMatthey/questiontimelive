import { NextResponse } from "next/server";
import {
  addIncomingPaymentUrl,
  getGuestBalance,
  updateGuestBalance,
  getGuestPayment,
} from "@/lib/server-store";
import { getIncomingPayment } from "@/lib/open-payments";

// POST /api/guest-payments - Register an incoming payment URL from Web Monetization
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guestId, sessionId, incomingPaymentUrl, assetCode, assetScale } = body;

    if (!guestId || !sessionId || !incomingPaymentUrl) {
      return NextResponse.json(
        { error: "guestId, sessionId, and incomingPaymentUrl are required" },
        { status: 400 }
      );
    }

    console.log("[PAYMENT EVENT] Registering incoming payment URL", {
      guestId,
      sessionId,
      incomingPaymentUrl,
      assetCode: assetCode || "USD",
      assetScale: assetScale || 2,
      timestamp: new Date().toISOString(),
    });

    // Add the incoming payment URL to the guest's payment tracking
    const guestPayment = await addIncomingPaymentUrl(
      guestId,
      sessionId,
      incomingPaymentUrl,
      assetCode || "USD",
      assetScale || 2
    );

    console.log("[PAYMENT EVENT] Incoming payment URL registered successfully", {
      guestId,
      sessionId,
      incomingPaymentUrl,
      totalUrlsTracked: guestPayment.incomingPaymentUrls.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, guestPayment });
  } catch (error) {
    console.error("[PAYMENT ERROR] Register incoming payment URL error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to register incoming payment URL" },
      { status: 500 }
    );
  }
}

// GET /api/guest-payments?guestId=xxx&sessionId=xxx - Get guest balance
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get("guestId");
    const sessionId = searchParams.get("sessionId");

    if (!guestId || !sessionId) {
      return NextResponse.json(
        { error: "guestId and sessionId are required" },
        { status: 400 }
      );
    }

    const balance = await getGuestBalance(guestId, sessionId);

    if (!balance) {
      console.log("[BALANCE CHECK] Guest balance not found (new guest)", {
        guestId,
        sessionId,
        balance: 0,
        credits: 0,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({
        guestId,
        sessionId,
        balance: 0,
        totalReceived: 0,
        questionCredits: 0,
        assetCode: "USD",
        assetScale: 2,
      });
    }

    const balanceDisplay = (balance.balance / Math.pow(10, balance.assetScale)).toFixed(balance.assetScale);
    const totalDisplay = (balance.totalReceived / Math.pow(10, balance.assetScale)).toFixed(balance.assetScale);
    
    console.log("[BALANCE CHECK] Guest balance retrieved", {
      guestId,
      sessionId,
      balance: `${balanceDisplay} ${balance.assetCode}`,
      totalReceived: `${totalDisplay} ${balance.assetCode}`,
      questionCredits: balance.questionCredits,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(balance);
  } catch (error) {
    console.error("[PAYMENT ERROR] Get guest balance error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to get guest balance" },
      { status: 500 }
    );
  }
}

// PATCH /api/guest-payments - Update guest balance (called by polling service)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { guestId, sessionId, totalReceived, assetCode, assetScale } = body;

    if (!guestId || !sessionId || totalReceived === undefined) {
      return NextResponse.json(
        { error: "guestId, sessionId, and totalReceived are required" },
        { status: 400 }
      );
    }

    // Get current balance to log the change
    const currentBalance = await getGuestBalance(guestId, sessionId);
    const previousTotal = currentBalance?.totalReceived || 0;
    const amountIncrease = totalReceived - previousTotal;

    console.log("[PAYMENT EVENT] Updating guest balance", {
      guestId,
      sessionId,
      previousTotal,
      newTotal: totalReceived,
      amountIncrease,
      assetCode: assetCode || "USD",
      assetScale: assetScale || 2,
      timestamp: new Date().toISOString(),
    });

    const guestPayment = await updateGuestBalance(
      guestId,
      sessionId,
      totalReceived,
      assetCode || "USD",
      assetScale || 2
    );

    if (amountIncrease > 0) {
      const displayAmount = (amountIncrease / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2);
      console.log("[PAYMENT EVENT] Guest balance updated - payment received", {
        guestId,
        sessionId,
        amountReceived: displayAmount,
        currency: assetCode || "USD",
        newBalance: (totalReceived / Math.pow(10, assetScale || 2)).toFixed(assetScale || 2),
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, guestPayment });
  } catch (error) {
    console.error("[PAYMENT ERROR] Update guest balance error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "Failed to update guest balance" },
      { status: 500 }
    );
  }
}

