import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getSession,
  updateSession,
  deleteSession,
  addCoHostToken,
  claimCoHostToken,
} from "@/lib/server-store";

// GET /api/sessions/[id] - Get a single session
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log("GET /api/sessions/[id] - id:", id, "request URL:", request.url);
    const session = await getSession(id);
    if (!session) {
      console.log("Session not found:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}

// PATCH /api/sessions/[id] - Update a session
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Handle special actions
    if (body.action === "start") {
      const updated = await updateSession(id, {
        status: "live",
        startedAt: new Date(),
      });
      if (!updated) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    if (body.action === "end") {
      const updated = await updateSession(id, {
        status: "ended",
        endedAt: new Date(),
      });
      if (!updated) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    if (body.action === "generateInvite") {
      const hostNumber = body.hostNumber as 2 | 3 | 4;
      if (![2, 3, 4].includes(hostNumber)) {
        return NextResponse.json({ error: "Invalid host number" }, { status: 400 });
      }

      // Check if token already exists
      const session = await getSession(id);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const existingToken = session.coHostTokens?.find(t => t.hostNumber === hostNumber);
      if (existingToken) {
        return NextResponse.json({ token: existingToken.token, hostNumber });
      }

      // Generate new token
      const token = nanoid(12);
      await addCoHostToken(id, {
        hostNumber,
        token,
        claimed: false,
      });

      return NextResponse.json({ token, hostNumber });
    }

    if (body.action === "claimInvite") {
      const result = await claimCoHostToken(id, body.token);
      if (!result) {
        return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    // Regular update
    const updated = await updateSession(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
