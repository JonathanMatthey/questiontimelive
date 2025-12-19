import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@interledger/open-payments";
import * as crypto from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentUrl = searchParams.get("paymentUrl");

    if (!paymentUrl) {
      return NextResponse.json(
        { error: "paymentUrl is required" },
        { status: 400 }
      );
    }

    // Check if we have the necessary environment variables for real payments
    const walletAddress = process.env.OPEN_PAYMENTS_WALLET_ADDRESS;
    const keyId = process.env.OPEN_PAYMENTS_KEY_ID;
    const privateKey = process.env.OPEN_PAYMENTS_PRIVATE_KEY;

    if (!walletAddress || !keyId || !privateKey) {
      // Return mock completed response when credentials aren't configured
      // Simulate a 70% chance of completion after being called
      const isCompleted = Math.random() > 0.3;
      return NextResponse.json({
        completed: isCompleted,
        receivedAmount: isCompleted ? { value: "100", assetCode: "USD", assetScale: 2 } : null,
        mock: true,
      });
    }

    // Create authenticated client
    // Convert base64 DER key to PEM format
    let privateKeyBuffer: Buffer;
    try {
      const keyDer = Buffer.from(privateKey, "base64");
      const keyObj = crypto.createPrivateKey({
        key: keyDer,
        format: "der",
        type: "pkcs8",
      });
      const pemKey = keyObj.export({ type: "pkcs8", format: "pem" });
      privateKeyBuffer = Buffer.from(pemKey);
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to parse private key", details: String(e) },
        { status: 500 }
      );
    }

    const client = await createAuthenticatedClient({
      walletAddressUrl: walletAddress,
      keyId,
      privateKey: privateKeyBuffer,
    });

    // Get the incoming payment status
    // Note: We need a grant to read the payment
    // For simplicity, we'll try to extract the wallet from the payment URL
    const paymentUrlObj = new URL(paymentUrl);
    const walletHost = `https://${paymentUrlObj.host}`;

    // Get wallet info to find auth server
    const hostWallet = await client.walletAddress.get({
      url: walletHost,
    });

    // Request a read grant
    const grant = await client.grant.request(
      { url: hostWallet.authServer },
      {
        access_token: {
          access: [
            {
              type: "incoming-payment",
              actions: ["read"],
              identifier: walletHost,
            },
          ],
        },
      }
    );

    // Check if we got a completed grant with access token (not a pending grant)
    if (!("access_token" in grant) || !grant.access_token) {
      return NextResponse.json(
        { error: "Failed to get read grant - interaction required" },
        { status: 500 }
      );
    }

    const accessToken = grant.access_token;

    const payment = await client.incomingPayment.get({
      url: paymentUrl,
      accessToken: accessToken.value,
    });

    return NextResponse.json({
      completed: payment.completed,
      receivedAmount: payment.receivedAmount,
      incomingAmount: payment.incomingAmount,
    });
  } catch (error) {
    console.error("Payment status error:", error);
    return NextResponse.json(
      { error: "Failed to get payment status", details: String(error) },
      { status: 500 }
    );
  }
}
