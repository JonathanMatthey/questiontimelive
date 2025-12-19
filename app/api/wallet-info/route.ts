import { NextResponse } from "next/server";
import { getWalletAddressInfo } from "@/lib/open-payments";

// GET /api/wallet-info?address=xxx - Get wallet address information
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const walletInfo = await getWalletAddressInfo(address);
    
    return NextResponse.json(walletInfo);
  } catch (error) {
    console.error("Get wallet info error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get wallet info",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

