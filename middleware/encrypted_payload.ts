import type { MiddlewareHandler } from "hono";
import { decryptJsonPayload } from "../crypto/payload.ts";
import {
  CreateHighscoreSchema,
  EncryptedPayloadSchema,
} from "../schemas/highscore.schema.ts";
import type { AppEnv } from "../types.ts";

function formatZodError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    .join("; ");
}

export const decryptHighscorePayload: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "POST") {
    await next();
    return;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Malformed encrypted payload" }, 400);
  }

  const envelope = EncryptedPayloadSchema.safeParse(body);
  if (!envelope.success) {
    return c.json({ error: "Malformed encrypted payload" }, 400);
  }

  let decrypted: unknown;
  try {
    decrypted = await decryptJsonPayload(envelope.data, c.get("criptKey"));
  } catch {
    return c.json({ error: "Invalid encrypted payload" }, 400);
  }

  const payload = CreateHighscoreSchema.safeParse(decrypted);
  if (!payload.success) {
    return c.json({ error: formatZodError(payload.error) }, 422);
  }

  c.set("highscorePayload", payload.data);
  await next();
};
