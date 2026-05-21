import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types.ts";

interface GameEntry {
  game: string;
  apiKey: string;
}

function loadGames(): GameEntry[] {
  const raw = Deno.env.get("HIGHSCORE_GAMES");
  if (!raw) {
    console.warn("HIGHSCORE_GAMES not set — no game will be authorized to submit scores");
    return [];
  }
  try {
    return JSON.parse(raw) as GameEntry[];
  } catch {
    throw new Error("HIGHSCORE_GAMES is not valid JSON");
  }
}

const authorizedGames = loadGames();

export const requireApiKey: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const apiKey = authHeader.slice(7);
  const entry = authorizedGames.find((g) => g.apiKey === apiKey);

  if (!entry) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  c.set("game", entry.game);
  await next();
};
