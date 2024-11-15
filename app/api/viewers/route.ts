import { NextResponse } from "next/server";
import { incrementViewerCount, decrementViewerCount, getViewerCount } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    // Handle both JSON and sendBeacon (text/plain) requests
    const contentType = request.headers.get("content-type") || "";
    let sessionId: string;
    let action: string;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      sessionId = body.sessionId;
      action = body.action;
    } else {
      // sendBeacon sends as text/plain
      const text = await request.text();
      const body = JSON.parse(text);
      sessionId = body.sessionId;
      action = body.action;
    }

    if (!sessionId || !action) {
      return NextResponse.json({ error: "Missing sessionId or action" }, { status: 400 });
    }

    if (action === "join") {
      const count = await incrementViewerCount(sessionId);
      return NextResponse.json({ viewerCount: count });
    } else if (action === "leave") {
      const count = await decrementViewerCount(sessionId);
      return NextResponse.json({ viewerCount: count });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to update viewer count:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const count = await getViewerCount(sessionId);
    return NextResponse.json({ viewerCount: count });
  } catch (error) {
    console.error("Failed to get viewer count:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
