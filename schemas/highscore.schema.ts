import { z } from "@hono/zod-openapi";

export const CreateHighscoreSchema = z
  .object({
    nickname: z.string().min(1).openapi({ example: "player1" }),
    score: z.number().int().nonnegative().openapi({ example: 9500 }),
    region: z.string().min(1).max(3).openapi({ example: "BR" }),
  })
  .openapi("CreateHighscore");

export const HighscoreSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    nickname: z.string().openapi({ example: "player1" }),
    score: z.number().openapi({ example: 9500 }),
    dateCreated: z.string().openapi({ example: "2025-05-20T10:30:00.000Z" }),
    region: z.string().openapi({ example: "BR" }),
    game: z.string().openapi({ example: "tetris" }),
  })
  .openapi("Highscore");

export const SubmitResultSchema = z
  .object({
    status: z.enum(["created", "updated", "not_improved"]),
    highscore: HighscoreSchema,
  })
  .openapi("SubmitResult");

export const ListQuerySchema = z.object({
  region: z
    .string()
    .max(3)
    .optional()
    .openapi({ description: "Filtrar por região (ex: BR, US, EU)" }),
  nickname: z
    .string()
    .optional()
    .openapi({
      description:
        "Nickname a incluir ao final da lista com sua posição global. Se já estiver no top N, não é duplicado.",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .openapi({ description: "Máximo de resultados (padrão: 10, máximo: 100)" }),
});

export const RankedHighscoreSchema = HighscoreSchema.extend({
  position: z.number().openapi({ example: 1 }),
}).openapi("RankedHighscore");

export const DeleteHighscoreSchema = z
  .object({
    nickname: z.string().min(1).openapi({ example: "player1", description: "Nickname do jogador" }),
  })
  .openapi("DeleteHighscore");

export const DeleteResultSchema = z
  .object({ deleted: HighscoreSchema })
  .openapi("DeleteResult");

export const ErrorSchema = z
  .object({ error: z.string() })
  .openapi("Error");
