import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!);

export async function createSessionToken(
  sessionId: string
): Promise<string> {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
}

export async function validateAgentRequest(
  req: Request,
  expectedSessionId: string
): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sessionId === expectedSessionId;
  } catch {
    return false;
  }
}
