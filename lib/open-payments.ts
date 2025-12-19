/**
 * Open Payments Integration
 *
 * This module provides functions for interacting with the Open Payments API
 * to facilitate micropayments for question submissions.
 *
 * In a production environment, you would need:
 * 1. A registered client with the Open Payments authorization server
 * 2. Private/public key pair for signing requests
 * 3. Your wallet address URL registered with an Open Payments-enabled ASE
 *
 * For more information: https://openpayments.dev/overview/getting-started/
 */

import type { WalletAddressInfo } from "./types";

// Types for Open Payments API responses
interface OpenPaymentsWalletAddress {
  id: string;
  publicName?: string;
  assetCode: string;
  assetScale: number;
  authServer: string;
  resourceServer?: string;
}

interface IncomingPayment {
  id: string;
  walletAddress: string;
  completed: boolean;
  incomingAmount?: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
  receivedAmount: {
    value: string;
    assetCode: string;
    assetScale: number;
  };
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Grant {
  access_token: {
    value: string;
    manage: string;
    expires_in?: number;
    access: Array<{
      type: string;
      actions: string[];
      identifier?: string;
    }>;
  };
  continue?: {
    access_token: {
      value: string;
    };
    uri: string;
    wait?: number;
  };
}

/**
 * Fetches wallet address information from an Open Payments-enabled wallet
 * This is a public endpoint that doesn't require authentication
 */
export async function getWalletAddressInfo(
  walletAddressUrl: string
): Promise<WalletAddressInfo> {
  // In production, this would make an actual HTTP request
  // GET request to the wallet address URL with Accept: application/json
  //
  // const response = await fetch(walletAddressUrl, {
  //   method: 'GET',
  //   headers: {
  //     'Accept': 'application/json',
  //   },
  // });
  // const data = await response.json();

  // For demo purposes, return mock data
  console.log("Fetching wallet address info for:", walletAddressUrl);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Extract hostname for mock data
  let hostname = "wallet.example";
  try {
    const url = new URL(walletAddressUrl);
    hostname = url.hostname;
  } catch {
    // Use default
  }

  return {
    id: walletAddressUrl,
    publicName: "Demo Wallet",
    assetCode: "USD",
    assetScale: 2,
    authServer: `https://auth.${hostname}`,
    resourceServer: `https://${hostname}`,
  };
}

/**
 * Requests a grant for creating incoming payments
 * This initiates the GNAP flow to get authorization
 */
export async function requestIncomingPaymentGrant(
  authServer: string,
  walletAddressUrl: string
): Promise<Grant> {
  // In production, this would:
  // 1. POST to the auth server's grant endpoint
  // 2. Include the client's key ID and signature
  // 3. Request access for incoming-payment creation
  //
  // const response = await client.grant.request(
  //   { url: authServer },
  //   {
  //     access_token: {
  //       access: [
  //         {
  //           type: 'incoming-payment',
  //           actions: ['create', 'read'],
  //           identifier: walletAddressUrl,
  //         },
  //       ],
  //     },
  //     client: clientWalletAddress,
  //   }
  // );

  console.log("Requesting incoming payment grant from:", authServer);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Return mock grant
  return {
    access_token: {
      value: `mock_token_${Date.now()}`,
      manage: `${authServer}/token/mock_${Date.now()}`,
      access: [
        {
          type: "incoming-payment",
          actions: ["create", "read"],
          identifier: walletAddressUrl,
        },
      ],
    },
  };
}

/**
 * Creates an incoming payment on the host's wallet
 * This sets up a payment that viewers can pay into
 */
export async function createIncomingPayment(
  resourceServer: string,
  walletAddressUrl: string,
  accessToken: string,
  amount: number,
  assetCode: string,
  assetScale: number,
  metadata?: Record<string, unknown>
): Promise<IncomingPayment> {
  // In production, this would:
  // 1. POST to the resource server's incoming-payments endpoint
  // 2. Include the access token in the Authorization header
  // 3. Sign the request with HTTP Message Signatures
  //
  // const incomingPayment = await client.incomingPayment.create(
  //   {
  //     url: resourceServer,
  //     accessToken: accessToken,
  //   },
  //   {
  //     walletAddress: walletAddressUrl,
  //     incomingAmount: {
  //       value: amount.toString(),
  //       assetCode,
  //       assetScale,
  //     },
  //     expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
  //     metadata,
  //   }
  // );

  console.log("Creating incoming payment:", {
    resourceServer,
    walletAddressUrl,
    amount,
    assetCode,
    assetScale,
  });

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  const paymentId = `ip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: `${resourceServer}/incoming-payments/${paymentId}`,
    walletAddress: walletAddressUrl,
    completed: false,
    incomingAmount: {
      value: amount.toString(),
      assetCode,
      assetScale,
    },
    receivedAmount: {
      value: "0",
      assetCode,
      assetScale,
    },
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Gets the status of an incoming payment
 * Used to check if payment has been received
 */
export async function getIncomingPayment(
  paymentUrl: string,
  accessToken?: string
): Promise<IncomingPayment | null> {
  // In production, this would:
  // 1. GET the payment URL
  // 2. Include the access token
  //
  // const payment = await client.incomingPayment.get({
  //   url: paymentUrl,
  //   accessToken,
  // });

  console.log("Checking payment status:", paymentUrl);

  try {
    // Try to fetch the incoming payment URL directly
    // For Web Monetization, these URLs should be publicly accessible
    const response = await fetch(paymentUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...(accessToken && { "Authorization": `Bearer ${accessToken}` }),
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch incoming payment: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    return {
      id: data.id || paymentUrl,
      walletAddress: data.walletAddress || "",
      completed: data.completed || false,
      incomingAmount: data.incomingAmount,
      receivedAmount: data.receivedAmount || {
        value: "0",
        assetCode: data.incomingAmount?.assetCode || "USD",
        assetScale: data.incomingAmount?.assetScale || 2,
      },
      expiresAt: data.expiresAt,
      metadata: data.metadata,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching incoming payment:", error);
    return null;
  }
}

/**
 * Complete payment flow for a question submission
 * Orchestrates the entire Open Payments flow
 */
export async function initiateQuestionPayment(
  hostWalletAddress: string,
  amount: number,
  assetCode: string,
  assetScale: number,
  questionId: string,
  submitterName: string
): Promise<{
  incomingPaymentUrl: string;
  paymentDetails: IncomingPayment;
}> {
  // Step 1: Get host wallet address info
  const walletInfo = await getWalletAddressInfo(hostWalletAddress);

  // Step 2: Request a grant for creating incoming payments
  const grant = await requestIncomingPaymentGrant(
    walletInfo.authServer,
    walletInfo.id
  );

  // Step 3: Create an incoming payment
  const incomingPayment = await createIncomingPayment(
    walletInfo.resourceServer,
    walletInfo.id,
    grant.access_token.value,
    amount,
    assetCode,
    assetScale,
    {
      questionId,
      submitterName,
      description: `Question submission from ${submitterName}`,
    }
  );

  return {
    incomingPaymentUrl: incomingPayment.id,
    paymentDetails: incomingPayment,
  };
}

/**
 * Check if a payment has been completed
 * Returns true if the full amount has been received
 */
export async function checkPaymentComplete(
  incomingPaymentUrl: string,
  accessToken: string
): Promise<boolean> {
  const payment = await getIncomingPayment(incomingPaymentUrl, accessToken);
  return payment?.completed || false;
}

/**
 * Format payment amount for display
 */
export function formatPaymentAmount(
  value: string,
  assetCode: string,
  assetScale: number
): string {
  const numericValue = parseInt(value, 10) / Math.pow(10, assetScale);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: assetCode,
    minimumFractionDigits: Math.min(assetScale, 2),
    maximumFractionDigits: assetScale,
  }).format(numericValue);
}

