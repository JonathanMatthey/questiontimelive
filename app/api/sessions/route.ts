import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAllSessions, createSession } from "@/lib/server-store";
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

    const session: Session = {
      id: nanoid(),
      title: body.title,
      description: body.description || "",
      hostWalletAddress: body.hostWalletAddress,
      questionPrice: body.questionPrice,
      assetCode: body.assetCode || "USD",
      assetScale: body.assetScale || 2,
      streamUrl: body.streamUrl,
      status: "draft",
      createdAt: new Date(),
    };

    const created = await createSession(session);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
