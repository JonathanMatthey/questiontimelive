import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@interledger/open-payments";
import { nanoid } from "nanoid";
import { createPayment } from "@/lib/server-store";
import type { Payment } from "@/lib/types";
import * as crypto from "crypto";

export async function POST(request: Request) {
  let hostWalletAddress: string | undefined;
  let walletAddress: string | undefined;
  let keyId: string | undefined;
  let privateKey: string | undefined;
  
  try {
    const body = await request.json();
    ({ hostWalletAddress } = body);
    const { amount, questionId, sessionId, assetCode, assetScale } = body;

    if (!hostWalletAddress || !amount || !questionId || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // For now, return a mock response since we need proper wallet credentials
    // In production, this would use the authenticated client
    const mockPaymentUrl = `https://ilp.interledger-test.dev/incoming-payments/${questionId}`;

    // Check if we have the necessary environment variables for real payments
    walletAddress = process.env.OPEN_PAYMENTS_WALLET_ADDRESS;
    keyId = process.env.OPEN_PAYMENTS_KEY_ID;
    privateKey = process.env.OPEN_PAYMENTS_PRIVATE_KEY;

    let incomingPaymentUrl: string;
    let expiresAt: string;
    let receivedAmount: { value: string; assetCode: string; assetScale: number };
    let isMock = false;

    if (!walletAddress || !keyId || !privateKey) {
      // Return mock data when credentials aren't configured
      console.log("Open Payments credentials not configured, using mock response");
      incomingPaymentUrl = mockPaymentUrl;
      expiresAt = new Date(Date.now() + 3600000).toISOString();
      receivedAmount = {
        value: amount.toString(),
        assetCode: assetCode || "USD",
        assetScale: assetScale || 2,
      };
      isMock = true;
    } else {

      // Create authenticated client
      // The private key is base64-encoded DER format (PKCS8)
      // Convert to PEM format which the Open Payments SDK expects
      let privateKeyBuffer: Buffer;
      try {
        const keyDer = Buffer.from(privateKey, "base64");
        
        // Parse the DER-encoded PKCS8 key and convert to PEM
        const keyObj = crypto.createPrivateKey({
          key: keyDer,
          format: "der",
          type: "pkcs8",
        });
        
        // Export as PEM format (the SDK expects this)
        const pemKey = keyObj.export({ type: "pkcs8", format: "pem" });
        privateKeyBuffer = Buffer.from(pemKey);
        
        console.log("Successfully parsed private key as Ed25519");
      } catch (e) {
        console.error("Failed to parse private key:", e);
        throw new Error(`Invalid private key format: ${e instanceof Error ? e.message : String(e)}`);
      }

      const client = await createAuthenticatedClient({
        walletAddressUrl: walletAddress,
        keyId,
        privateKey: privateKeyBuffer,
      });

      // Get the host's wallet address info
      let hostWallet;
      try {
        console.log("Fetching host wallet info from:", hostWalletAddress);
        hostWallet = await client.walletAddress.get({
          url: hostWalletAddress,
        });
        console.log("Host wallet info retrieved:", {
          id: hostWallet.id,
          authServer: hostWallet.authServer,
          resourceServer: hostWallet.resourceServer,
          assetCode: hostWallet.assetCode,
          assetScale: hostWallet.assetScale,
        });
      } catch (walletError: any) {
        console.error("Failed to get host wallet info:", {
          error: walletError.message,
          status: walletError.status,
          url: hostWalletAddress,
        });
        throw new Error(`Failed to get host wallet info: ${walletError.message || String(walletError)}`);
      }

      // Request a grant to create incoming payments on the host's wallet
      let grant;
      try {
        console.log("Requesting grant from:", hostWallet.authServer);
        console.log("Grant request payload:", {
          type: "incoming-payment",
          actions: ["create", "read", "complete"],
          identifier: hostWalletAddress,
        });
        
        grant = await client.grant.request(
          { url: hostWallet.authServer },
          {
            access_token: {
              access: [
                {
                  type: "incoming-payment",
                  actions: ["create", "read", "complete"],
                  identifier: hostWalletAddress,
                },
              ],
            },
          }
        );
        console.log("Grant request successful:", {
          hasAccessToken: "access_token" in grant,
          grantKeys: Object.keys(grant),
        });
      } catch (grantError: any) {
        // Extract detailed error information
        const errorInfo: any = {
          message: grantError.message,
          name: grantError.name,
          authServer: hostWallet.authServer,
        };
        
        // Check for HTTP error details
        if (grantError.status) errorInfo.status = grantError.status;
        if (grantError.statusText) errorInfo.statusText = grantError.statusText;
        if (grantError.response) {
          try {
            errorInfo.responseBody = typeof grantError.response === 'string' 
              ? grantError.response 
              : JSON.stringify(grantError.response);
          } catch {}
        }
        if (grantError.body) {
          try {
            errorInfo.body = typeof grantError.body === 'string'
              ? grantError.body
              : JSON.stringify(grantError.body);
          } catch {}
        }
        if (grantError.cause) errorInfo.cause = grantError.cause;
        
        console.error("Grant request failed - full error details:", errorInfo);
        console.error("Grant error stack:", grantError.stack);
        
        // Return more detailed error message
        const detailedMessage = grantError.status 
          ? `HTTP ${grantError.status}: ${grantError.message || 'Unknown error'}`
          : grantError.message || String(grantError);
        
        throw new Error(`Failed to request grant: ${detailedMessage}`);
      }

      // Check if we got a completed grant with access token (not a pending grant)
      if (!("access_token" in grant) || !grant.access_token) {
        return NextResponse.json(
          { error: "Failed to get payment grant - interaction required" },
          { status: 500 }
        );
      }

      const accessToken = grant.access_token;

      // Create the incoming payment
      let incomingPayment;
      try {
        console.log("Creating incoming payment:", {
          resourceServer: hostWallet.resourceServer || hostWalletAddress,
          walletAddress: hostWalletAddress,
          amount: amount.toString(),
          assetCode: hostWallet.assetCode,
          assetScale: hostWallet.assetScale,
        });
        
        incomingPayment = await client.incomingPayment.create(
          {
            url: hostWallet.resourceServer || hostWalletAddress,
            accessToken: accessToken.value,
          },
          {
            walletAddress: hostWalletAddress,
            incomingAmount: {
              value: amount.toString(),
              assetCode: hostWallet.assetCode,
              assetScale: hostWallet.assetScale,
            },
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
            metadata: {
              questionId,
              sessionId,
              description: `Question payment for session ${sessionId}`,
            },
          }
        );
        console.log("Incoming payment created successfully:", incomingPayment.id);
      } catch (paymentError: any) {
        console.error("Incoming payment creation failed:", {
          error: paymentError.message,
          status: paymentError.status,
          statusText: paymentError.statusText,
          response: paymentError.response,
          body: paymentError.body,
          resourceServer: hostWallet.resourceServer || hostWalletAddress,
        });
        throw new Error(`Failed to create incoming payment: ${paymentError.message || String(paymentError)}`);
      }

      incomingPaymentUrl = incomingPayment.id;
      expiresAt = incomingPayment.expiresAt || new Date(Date.now() + 3600000).toISOString();
      receivedAmount = {
        value: incomingPayment.incomingAmount?.value || amount.toString(),
        assetCode: hostWallet.assetCode,
        assetScale: hostWallet.assetScale,
      };
    }

    // Create payment record in database
    const payment: Payment = {
      id: nanoid(),
      questionId,
      sessionId,
      incomingPaymentUrl,
      amount,
      assetCode: receivedAmount.assetCode,
      assetScale: receivedAmount.assetScale,
      status: "pending",
      createdAt: new Date(),
    };

    await createPayment(payment);

    return NextResponse.json({
      paymentId: payment.id,
      incomingPaymentUrl,
      expiresAt,
      receiveAmount: receivedAmount,
      mock: isMock,
    });
  } catch (error: any) {
    console.error("Payment creation error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Extract more details from Open Payments SDK errors
    const errorDetails: any = {
      message: errorMessage,
      stack: errorStack,
      hostWalletAddress,
      hasCredentials: !!(walletAddress && keyId && privateKey),
    };
    
    // Check if it's an OpenPaymentsClientError with more details
    if (error.status) {
      errorDetails.status = error.status;
      errorDetails.statusText = error.statusText;
    }
    if (error.response) {
      errorDetails.response = error.response;
    }
    if (error.body) {
      errorDetails.body = error.body;
    }
    if (error.cause) {
      errorDetails.cause = error.cause;
    }
    
    console.error("Error details:", errorDetails);
    
    return NextResponse.json(
      { 
        error: "Failed to create payment", 
        details: errorMessage,
        ...(error.status && { httpStatus: error.status }),
        ...(error.body && { apiError: error.body }),
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
