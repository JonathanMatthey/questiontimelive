import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAllSessions, createSession } from "@/lib/server-store";
import { getWalletAddressInfo } from "@/lib/open-payments";
import type { Session } from "@/lib/types";

// GET /api/sessions - List all sessions
export async function GET() {
  try {
    const sessions = await getAllSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Failed to get sessions" }, { status: 500 });
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!body.hostWalletAddress || !body.hostWalletAddress.trim()) {
      return NextResponse.json(
        { error: "Host wallet address is required" },
        { status: 400 }
      );
    }

    if (!body.questionPrice || body.questionPrice <= 0) {
      return NextResponse.json(
        { error: "Question price must be greater than 0" },
        { status: 400 }
      );
    }

    // Get wallet address info to determine currency
    let assetCode = body.assetCode || "USD";
    let assetScale = body.assetScale || 2;

    if (body.hostWalletAddress) {
      try {
        const walletInfo = await getWalletAddressInfo(body.hostWalletAddress);
        assetCode = walletInfo.assetCode;
        assetScale = walletInfo.assetScale;
        console.log("[SESSION CREATE] Wallet currency detected", {
          walletAddress: body.hostWalletAddress,
          assetCode,
          assetScale,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("[SESSION CREATE] Failed to get wallet info, using defaults", {
          walletAddress: body.hostWalletAddress,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        // Use provided values or defaults
      }
    }

    const session: Session = {
      id: nanoid(),
      title: body.title.trim(),
      description: body.description || "",
      hostWalletAddress: body.hostWalletAddress.trim(),
      questionPrice: body.questionPrice,
      assetCode,
      assetScale,
      streamUrl: body.streamUrl || undefined,
      status: "draft",
      createdAt: new Date(),
    };

    const created = await createSession(session);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
