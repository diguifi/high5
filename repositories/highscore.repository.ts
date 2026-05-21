import sql from "../db.ts";
import type { CreateHighscoreInput, Highscore, RankedHighscore } from "../models/highscore.ts";

interface DbRow {
  id: number;
  nickname: string;
  score: number;
  datecreated: Date;
  region: string;
  game: string;
}

function toHighscore(row: DbRow): Highscore {
  return {
    id: row.id,
    nickname: row.nickname,
    score: row.score,
    dateCreated: row.datecreated.toISOString(),
    region: row.region,
    game: row.game,
  };
}

const cols = sql`
  "Id" AS id, "Nickname" AS nickname, "Score" AS score,
  "DateCreated" AS datecreated, "Region" AS region, "Game" AS game
`;

export async function findByNicknameAndGame(
  nickname: string,
  game: string,
): Promise<Highscore | null> {
  const rows = await sql<DbRow[]>`
    SELECT ${cols} FROM "Highscores"
    WHERE "Nickname" = ${nickname} AND "Game" = ${game}
  `;
  return rows[0] ? toHighscore(rows[0]) : null;
}

export async function insert(input: CreateHighscoreInput): Promise<Highscore> {
  const rows = await sql<DbRow[]>`
    INSERT INTO "Highscores" ("Nickname", "Score", "DateCreated", "Region", "Game")
    VALUES (${input.nickname}, ${input.score}, NOW(), ${input.region}, ${input.game})
    RETURNING ${cols}
  `;
  return toHighscore(rows[0]);
}

export async function updateScore(id: number, score: number): Promise<Highscore> {
  const rows = await sql<DbRow[]>`
    UPDATE "Highscores"
    SET "Score" = ${score}, "DateCreated" = NOW()
    WHERE "Id" = ${id}
    RETURNING ${cols}
  `;
  return toHighscore(rows[0]);
}

export interface ListFilters {
  game: string;
  region?: string;
  nickname?: string;
  limit: number;
}

interface DbRowRanked extends DbRow {
  position: number;
}

const rankedCte = (game: string) => sql`
  WITH ranked AS (
    SELECT
      ${cols},
      RANK() OVER (ORDER BY "Score" DESC)::int AS position
    FROM "Highscores"
    WHERE "Game" = ${game}
  )
`;

function toRanked(row: DbRowRanked): RankedHighscore {
  return { ...toHighscore(row), position: row.position };
}

export async function deleteByNicknameAndGame(
  nickname: string,
  game: string,
): Promise<Highscore | null> {
  const rows = await sql<DbRow[]>`
    DELETE FROM "Highscores"
    WHERE "Nickname" = ${nickname} AND "Game" = ${game}
    RETURNING ${cols}
  `;
  return rows[0] ? toHighscore(rows[0]) : null;
}

export async function list(filters: ListFilters): Promise<RankedHighscore[]> {
  const topRows = await sql<DbRowRanked[]>`
    ${rankedCte(filters.game)}
    SELECT * FROM ranked
    WHERE ${filters.region ? sql`region = ${filters.region}` : sql`TRUE`}
    ORDER BY position
    LIMIT ${filters.limit}
  `;

  const result = topRows.map(toRanked);

  if (filters.nickname) {
    const alreadyIncluded = result.some((h) => h.nickname === filters.nickname);
    if (!alreadyIncluded) {
      const nicknameRows = await sql<DbRowRanked[]>`
        ${rankedCte(filters.game)}
        SELECT * FROM ranked WHERE nickname = ${filters.nickname}
      `;
      if (nicknameRows[0]) result.push(toRanked(nicknameRows[0]));
    }
  }

  return result;
}
