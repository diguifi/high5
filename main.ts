import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { AppEnv } from "./types.ts";
import { requireApiKey } from "./middleware/auth.ts";
import {
  CreateHighscoreSchema,
  DeleteHighscoreSchema,
  DeleteResultSchema,
  ErrorSchema,
  ListQuerySchema,
  RankedHighscoreSchema,
  SubmitResultSchema,
} from "./schemas/highscore.schema.ts";
import * as repo from "./repositories/highscore.repository.ts";

const app = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return c.json({ error: messages }, 422);
    }
  },
});

app.use("/highscores", requireApiKey);
app.use("/highscores/:nickname", requireApiKey);

const submitRoute = createRoute({
  method: "post",
  path: "/highscores",
  tags: ["Highscores"],
  summary: "Submete um highscore",
  description:
    "Requer `Authorization: Bearer <apiKey>`. O jogo é identificado pela API key — não é informado no body. Cria um novo highscore ou atualiza se o score for maior para o mesmo nickname.",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateHighscoreSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: SubmitResultSchema } },
      description: "Highscore criado",
    },
    200: {
      content: { "application/json": { schema: SubmitResultSchema } },
      description: "Highscore atualizado ou score não melhorou",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "API key ausente ou inválida",
    },
    422: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Dados inválidos",
    },
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/highscores",
  tags: ["Highscores"],
  summary: "Lista highscores",
  description: "Requer `Authorization: Bearer <apiKey>`. O jogo é inferido pela API key.",
  security: [{ BearerAuth: [] }],
  request: { query: ListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(RankedHighscoreSchema) } },
      description: "Lista de highscores ordenados por posição",
    },
  },
});

app.openapi(submitRoute, async (c) => {
  const { nickname, score, region } = c.req.valid("json");
  const game = c.get("game");

  const existing = await repo.findByNicknameAndGame(nickname, game);

  if (!existing) {
    const created = await repo.insert({ nickname, score, region, game });
    return c.json({ status: "created" as const, highscore: created }, 201);
  }

  if (score > existing.score) {
    const updated = await repo.updateScore(existing.id, score);
    return c.json({ status: "updated" as const, highscore: updated }, 200);
  }

  return c.json({ status: "not_improved" as const, highscore: existing }, 200);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/highscores/{nickname}",
  tags: ["Highscores"],
  summary: "Deleta um highscore",
  description:
    "Requer `Authorization: Bearer <apiKey>`. O jogo é inferido pela API key. Remove o highscore do nickname informado.",
  security: [{ BearerAuth: [] }],
  request: { params: DeleteHighscoreSchema },
  responses: {
    200: {
      content: { "application/json": { schema: DeleteResultSchema } },
      description: "Highscore deletado",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "API key ausente ou inválida",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Highscore não encontrado",
    },
  },
});

app.openapi(deleteRoute, async (c) => {
  const { nickname } = c.req.valid("param");
  const game = c.get("game");

  const deleted = await repo.deleteByNicknameAndGame(nickname, game);

  if (!deleted) {
    return c.json({ error: "Highscore not found" }, 404);
  }

  return c.json({ deleted }, 200);
});

app.openapi(listRoute, async (c) => {
  const { region, nickname, limit } = c.req.valid("query");
  const game = c.get("game");
  const highscores = await repo.list({ game, region, nickname, limit: limit ?? 10 });
  return c.json(highscores);
});

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "API key do jogo configurada em HIGHSCORE_GAMES no servidor",
});

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Highscores API",
    version: "1.0.0",
    description: "API para gerenciamento de highscores de jogos",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(Deno.env.get("PORT") ?? "8000");
Deno.serve({ port }, app.fetch);
