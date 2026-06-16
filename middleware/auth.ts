import type { MiddlewareHandler } from "hono";
import { authorizedGames } from "../config/games.ts";
import type { AppEnv } from "../types.ts";

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
  c.set("criptKey", entry.criptKey);
  await next();
};
