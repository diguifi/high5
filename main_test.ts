import { assertEquals, assertRejects } from "@std/assert";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  CreateHighscoreSchema,
  EncryptedPayloadSchema,
  ErrorSchema,
  SubmitResultSchema,
} from "./schemas/highscore.schema.ts";
import { decryptJsonPayload, encryptJsonPayload } from "./crypto/payload.ts";
import { decryptHighscorePayload } from "./middleware/encrypted_payload.ts";
import type { AppEnv } from "./types.ts";

// Testa os schemas Zod diretamente, sem precisar de banco de dados.

Deno.test("CreateHighscoreSchema - aceita input válido", () => {
  const result = CreateHighscoreSchema.safeParse({
    nickname: "player1",
    score: 9500,
    region: "BR",
    game: "tetris",
  });
  assertEquals(result.success, true);
});

const criptKey = "u7w1v53rWmZp9YfV4KJ4TxycKcTFlmIfrXqFc2tc4qE=";
const otherCriptKey = "kJbY8lS7kXSk1f0gFYKhp6McX6q9B2d3z4N8tRzjsRk=";

function createEncryptedTestApp() {
  const app = new OpenAPIHono<AppEnv>();
  app.use("/highscores", async (c, next) => {
    c.set("criptKey", criptKey);
    await next();
  });
  app.use("/highscores", decryptHighscorePayload);

  const route = createRoute({
    method: "post",
    path: "/highscores",
    request: {
      body: {
        content: { "application/json": { schema: EncryptedPayloadSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: CreateHighscoreSchema } },
        description: "Payload descriptografado",
      },
      400: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Payload criptografado invalido",
      },
      422: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Payload descriptografado invalido",
      },
    },
  });

  app.openapi(route, (c) => c.json(c.get("highscorePayload"), 200));
  return app;
}

Deno.test("encryptJsonPayload/decryptJsonPayload - descriptografa payload valido", async () => {
  const payload = { nickname: "player1", score: 9500, region: "BR" };
  const encrypted = await encryptJsonPayload(payload, criptKey);
  const decrypted = await decryptJsonPayload(encrypted, criptKey);

  assertEquals(decrypted, payload);
});

Deno.test("decryptJsonPayload - rejeita payload alterado", async () => {
  const encrypted = await encryptJsonPayload({ nickname: "player1", score: 9500, region: "BR" }, criptKey);
  const lastChar = encrypted.payload.at(-1) === "A" ? "B" : "A";
  const tampered = { ...encrypted, payload: `${encrypted.payload.slice(0, -1)}${lastChar}` };

  await assertRejects(() => decryptJsonPayload(tampered, criptKey));
});

Deno.test("decryptJsonPayload - rejeita chave incorreta", async () => {
  const encrypted = await encryptJsonPayload({ nickname: "player1", score: 9500, region: "BR" }, criptKey);

  await assertRejects(() => decryptJsonPayload(encrypted, otherCriptKey));
});

Deno.test("decryptHighscorePayload - entrega payload descriptografado ao handler", async () => {
  const app = createEncryptedTestApp();
  const payload = { nickname: "player1", score: 9500, region: "BR" };
  const encrypted = await encryptJsonPayload(payload, criptKey);

  const response = await app.request("/highscores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encrypted),
  });

  assertEquals(response.status, 200);
  assertEquals(await response.json(), payload);
});

Deno.test("decryptHighscorePayload - rejeita envelope aberto", async () => {
  const app = createEncryptedTestApp();

  const response = await app.request("/highscores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: "player1", score: 9500, region: "BR" }),
  });

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Malformed encrypted payload" });
});

Deno.test("decryptHighscorePayload - rejeita JSON descriptografado invalido", async () => {
  const app = createEncryptedTestApp();
  const encrypted = await encryptJsonPayload({ nickname: "player1", score: -1, region: "BR" }, criptKey);

  const response = await app.request("/highscores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encrypted),
  });

  assertEquals(response.status, 422);
});

Deno.test("CreateHighscoreSchema - rejeita score negativo", () => {
  const result = CreateHighscoreSchema.safeParse({
    nickname: "player1",
    score: -1,
    region: "BR",
    game: "tetris",
  });
  assertEquals(result.success, false);
});

Deno.test("CreateHighscoreSchema - rejeita region com mais de 3 chars", () => {
  const result = CreateHighscoreSchema.safeParse({
    nickname: "player1",
    score: 100,
    region: "BRAZ",
    game: "tetris",
  });
  assertEquals(result.success, false);
});

Deno.test("CreateHighscoreSchema - rejeita score decimal", () => {
  const result = CreateHighscoreSchema.safeParse({
    nickname: "player1",
    score: 9.5,
    region: "BR",
    game: "tetris",
  });
  assertEquals(result.success, false);
});

Deno.test("CreateHighscoreSchema - rejeita campos faltando", () => {
  const result = CreateHighscoreSchema.safeParse({ nickname: "player1" });
  assertEquals(result.success, false);
});

Deno.test("SubmitResultSchema - aceita status válido", () => {
  const result = SubmitResultSchema.safeParse({
    status: "created",
    highscore: {
      id: 1,
      nickname: "player1",
      score: 9500,
      dateCreated: "2025-05-20T10:30:00.000Z",
      region: "BR",
      game: "tetris",
    },
  });
  assertEquals(result.success, true);
});

Deno.test("SubmitResultSchema - rejeita status inválido", () => {
  const result = SubmitResultSchema.safeParse({
    status: "unknown",
    highscore: {},
  });
  assertEquals(result.success, false);
});
