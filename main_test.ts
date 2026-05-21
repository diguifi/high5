import { assertEquals } from "@std/assert";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { CreateHighscoreSchema, ErrorSchema, SubmitResultSchema } from "./schemas/highscore.schema.ts";

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
