import { NextRequest } from "next/server";
import { SearchSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import Exa from "exa-js";

export const maxDuration = 60;

let exa: Exa | null = null;
function getExa(): Exa {
  if (!exa) exa = new Exa(process.env.EXA_API_KEY);
  return exa;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Search is called per-target for URL discovery during a fan-out, so it shares the swarm
  // ceiling (see SWARM_LIMIT). On the default 30 bucket it would 429 mid-run.
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  if (!(await validateAgentRequest(req, parsed.data.sessionId))) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const searchResult = await getExa().searchAndContents(parsed.data.query, {
      numResults: 5,
      text: { maxCharacters: 300 },
    });

    const results = searchResult.results.map((r) => ({
      title: r.title || "",
      url: r.url,
      snippet: r.text || "",
    }));

    return Response.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: message, code: "SEARCH_ERROR" },
      { status: 500 }
    );
  }
}
