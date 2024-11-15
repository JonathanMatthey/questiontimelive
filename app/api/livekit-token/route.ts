import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { randomUUID } from "crypto";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(request: Request) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: "LiveKit server credentials are not configured." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);

  const roomName = body?.roomName as string | undefined;
  const role = body?.role as "host" | "viewer" | undefined;
  const identity = (body?.identity as string | undefined) ?? `user-${randomUUID()}`;

  if (!roomName || !role) {
    return NextResponse.json(
      { error: "roomName and role are required." },
      { status: 400 }
    );
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: identity,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: role === "host",
    canPublishData: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt() });
}
