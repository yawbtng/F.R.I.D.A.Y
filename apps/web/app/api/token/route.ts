import { AccessToken } from 'livekit-server-sdk';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  if (!room) {
    return Response.json(
      { error: 'room parameter required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: `user-${Date.now()}` },
  );
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();
  return Response.json({
    token: jwt,
    room,
    serverUrl: process.env.LIVEKIT_URL,
  });
}
