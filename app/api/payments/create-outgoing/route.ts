import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@interledger/open-payments";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      viewerWalletAddress, 
      viewerKeyId, 
      viewerPrivateKey,
      incomingPaymentUrl,
      amount,
      assetCode,
      assetScale 
    } = body;

    if (!incomingPaymentUrl) {
      return NextResponse.json(
        { error: "incomingPaymentUrl is required" },
        { status: 400 }
      );
    }

    // Check if we have viewer wallet credentials
    if (!viewerWalletAddress || !viewerKeyId || !viewerPrivateKey) {
      // In a real app, this would redirect to the viewer's wallet for authorization
      // For demo purposes, return a mock response
      console.log("Viewer wallet credentials not provided, simulating payment");
      return NextResponse.json({
        success: true,
        mock: true,
        message: "Payment simulated (viewer wallet credentials required for real payments)",
      });
    }

    // Create authenticated client for viewer's wallet
    const client = await createAuthenticatedClient({
      walletAddressUrl: viewerWalletAddress,
      keyId: viewerKeyId,
      privateKey: Buffer.from(viewerPrivateKey, "base64"),
    });

    // Get the incoming payment to verify it exists and get details
    // First, we need to get the wallet info from the incoming payment URL
    const incomingPaymentUrlObj = new URL(incomingPaymentUrl);
    const walletHost = `https://${incomingPaymentUrlObj.host}`;

    // Get wallet info to find auth server
    const hostWallet = await client.walletAddress.get({
      url: walletHost,
    });

    // Request a grant to read the incoming payment
    const readGrant = await client.grant.request(
      { url: hostWallet.authServer },
      {
        access_token: {
          access: [
            {
              type: "incoming-payment",
              actions: ["read"],
              identifier: incomingPaymentUrl,
            },
          ],
        },
      }
    );

    if (!("access_token" in readGrant) || !readGrant.access_token) {
      return NextResponse.json(
        { error: "Failed to get read grant for incoming payment" },
        { status: 500 }
      );
    }

    const incomingPayment = await client.incomingPayment.get({
      url: incomingPaymentUrl,
      accessToken: readGrant.access_token.value,
    });

    // Request a grant to create outgoing payments from viewer's wallet
    const viewerWallet = await client.walletAddress.get({
      url: viewerWalletAddress,
    });

    const outgoingGrant = await client.grant.request(
      { url: viewerWallet.authServer },
      {
        access_token: {
          access: [
            {
              type: "outgoing-payment",
              actions: ["create", "read"],
              identifier: viewerWalletAddress,
            },
          ],
        },
      }
    );

    if (!("access_token" in outgoingGrant) || !outgoingGrant.access_token) {
      return NextResponse.json(
        { error: "Failed to get grant for outgoing payment" },
        { status: 500 }
      );
    }

    // Create the outgoing payment
    const outgoingPayment = await client.outgoingPayment.create(
      {
        url: viewerWallet.resourceServer || viewerWalletAddress,
        accessToken: outgoingGrant.access_token.value,
      },
      {
        walletAddress: viewerWalletAddress,
        incomingPayment: incomingPaymentUrl,
        debitAmount: {
          value: amount.toString(),
          assetCode: assetCode || viewerWallet.assetCode,
          assetScale: assetScale || viewerWallet.assetScale,
        },
        metadata: {
          description: `Payment for question submission`,
        },
      }
    );

    return NextResponse.json({
      success: true,
      outgoingPaymentId: outgoingPayment.id,
      status: outgoingPayment.failed ? "failed" : "pending",
    });
  } catch (error) {
    console.error("Outgoing payment creation error:", error);
    return NextResponse.json(
      { error: "Failed to create outgoing payment", details: String(error) },
      { status: 500 }
    );
  }
}

