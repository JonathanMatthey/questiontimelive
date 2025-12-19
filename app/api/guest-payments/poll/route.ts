import { NextResponse } from "next/server";
import { getGuestPayment, updateGuestBalance } from "@/lib/server-store";
import { getIncomingPayment } from "@/lib/open-payments";

// POST /api/guest-payments/poll - Poll incoming payment URLs and update balances
// This endpoint should be called periodically (e.g., every few seconds) to check payment status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guestId, sessionId } = body;

    if (!guestId || !sessionId) {
      return NextResponse.json(
        { error: "guestId and sessionId are required" },
        { status: 400 }
      );
    }

    const guestPayment = await getGuestPayment(guestId, sessionId);

    if (!guestPayment || guestPayment.incomingPaymentUrls.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No incoming payment URLs to poll",
        totalReceived: 0,
      });
    }

    // Poll all incoming payment URLs and sum up the received amounts
    let totalReceived = 0;
    const assetCode = guestPayment.assetCode;
    const assetScale = guestPayment.assetScale;

    console.log("[PAYMENT POLL] Starting payment poll", {
      guestId,
      sessionId,
      urlsToPoll: guestPayment.incomingPaymentUrls.length,
      currentTotal: guestPayment.totalReceived,
      timestamp: new Date().toISOString(),
    });

    for (const incomingPaymentUrl of guestPayment.incomingPaymentUrls) {
      try {
        // Extract resource server and payment ID from URL
        // Format: https://resource-server/incoming-payments/payment-id
        const urlParts = incomingPaymentUrl.split("/incoming-payments/");
        if (urlParts.length !== 2) {
          console.warn("[PAYMENT WARNING] Invalid incoming payment URL format:", {
            url: incomingPaymentUrl,
            guestId,
            sessionId,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const resourceServer = urlParts[0];
        const paymentId = urlParts[1];

        console.log("[PAYMENT POLL] Polling incoming payment URL", {
          guestId,
          sessionId,
          incomingPaymentUrl,
          resourceServer,
          paymentId,
          timestamp: new Date().toISOString(),
        });

        // Get the incoming payment status
        // For Web Monetization, these URLs should be publicly accessible
        // This verifies that payments actually ARRIVED at the host wallet
        const incomingPayment = await getIncomingPayment(incomingPaymentUrl);

        if (incomingPayment && incomingPayment.receivedAmount) {
          // Convert received amount to smallest unit of the incoming payment currency
          const receivedValue = parseFloat(incomingPayment.receivedAmount.value);
          const receivedInSmallestUnit = Math.floor(
            receivedValue * Math.pow(10, incomingPayment.receivedAmount.assetScale)
          );

          // Convert to our asset scale (guestPayment's currency)
          // Formula: convert from incoming currency smallest units to our currency smallest units
          // Step 1: Convert to display value: receivedInSmallestUnit / 10^incomingScale
          // Step 2: Convert to our smallest units: displayValue * 10^ourScale
          const convertedAmount =
            assetScale === incomingPayment.receivedAmount.assetScale
              ? receivedInSmallestUnit
              : Math.floor(
                  (receivedInSmallestUnit * Math.pow(10, assetScale)) /
                    Math.pow(10, incomingPayment.receivedAmount.assetScale)
                );

          const displayAmount = (convertedAmount / Math.pow(10, assetScale)).toFixed(assetScale);
          
          // Get session to log host wallet address
          const { getSession } = await import("@/lib/server-store");
          const session = await getSession(sessionId);
          const hostWalletAddress = session?.hostWalletAddress || "not set";
          
          console.log("[PAYMENT VERIFICATION] Payment verified at host wallet", {
            guestId,
            sessionId,
            hostWalletAddress,
            incomingPaymentUrl,
            receivedAmount: displayAmount,
            currency: incomingPayment.receivedAmount.assetCode,
            completed: incomingPayment.completed,
            note: "This confirms payment actually arrived at host wallet",
            timestamp: new Date().toISOString(),
          });

          totalReceived = Math.max(totalReceived, convertedAmount);
        } else {
          console.log("[PAYMENT POLL] No payment received yet at host wallet", {
            guestId,
            sessionId,
            incomingPaymentUrl,
            note: "Payment may still be in transit or not yet processed",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        // Log error but continue with other URLs
        console.error("[PAYMENT ERROR] Failed to poll incoming payment", {
          guestId,
          sessionId,
          incomingPaymentUrl,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update the guest balance with the new total
    const previousTotal = guestPayment.totalReceived;
    const amountIncrease = totalReceived - previousTotal;
    
    if (totalReceived > previousTotal) {
      const displayIncrease = (amountIncrease / Math.pow(10, assetScale)).toFixed(assetScale);
      const displayTotal = (totalReceived / Math.pow(10, assetScale)).toFixed(assetScale);
      
      console.log("[PAYMENT EVENT] New payment detected - updating balance", {
        guestId,
        sessionId,
        previousTotal: (previousTotal / Math.pow(10, assetScale)).toFixed(assetScale),
        newTotal: displayTotal,
        amountIncrease: displayIncrease,
        currency: assetCode,
        timestamp: new Date().toISOString(),
      });

      await updateGuestBalance(guestId, sessionId, totalReceived, assetCode, assetScale);
    } else {
      console.log("[PAYMENT POLL] No new payments detected", {
        guestId,
        sessionId,
        currentTotal: (totalReceived / Math.pow(10, assetScale)).toFixed(assetScale),
        currency: assetCode,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      totalReceived,
      previousTotal,
      updated: totalReceived > previousTotal,
    });
  } catch (error) {
    console.error("Poll guest payments error:", error);
    return NextResponse.json(
      { error: "Failed to poll guest payments" },
      { status: 500 }
    );
  }
}

