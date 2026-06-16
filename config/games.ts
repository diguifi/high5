export interface GameEntry {
  game: string;
  apiKey: string;
  criptKey: string;
  cors?: string[];
}

type CorsRule =
  | { kind: "wildcard" }
  | { kind: "origin"; value: string }
  | { kind: "host"; value: string }
  | { kind: "hostname"; value: string };

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === `"` || quote === `'`) && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseGames(raw: string): GameEntry[] {
  return JSON.parse(stripWrappingQuotes(raw)) as GameEntry[];
}

function readGamesFromEnvFile(): GameEntry[] | null {
  let content: string;
  try {
    content = Deno.readTextFileSync(".env");
  } catch {
    return null;
  }

  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^\s*HIGHSCORE_GAMES\s*=/.test(line));
  if (startIndex === -1) return null;

  let raw = lines[startIndex].replace(/^\s*HIGHSCORE_GAMES\s*=/, "");
  for (let index = startIndex; index < lines.length; index++) {
    if (index > startIndex) raw += `\n${lines[index]}`;

    try {
      return parseGames(raw);
    } catch {
      // Keep reading: HIGHSCORE_GAMES may be a multiline JSON array.
    }
  }

  return null;
}

function loadGames(): GameEntry[] {
  const raw = Deno.env.get("HIGHSCORE_GAMES");
  if (!raw) {
    console.warn("HIGHSCORE_GAMES not set - no game will be authorized to submit scores");
    return [];
  }
  try {
    return parseGames(raw);
  } catch {
    const gamesFromFile = readGamesFromEnvFile();
    if (gamesFromFile) return gamesFromFile;

    throw new Error("HIGHSCORE_GAMES is not valid JSON");
  }
}

function toCorsRule(value: string): CorsRule | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "*") return { kind: "wildcard" };

  try {
    return { kind: "origin", value: new URL(trimmed).origin };
  } catch {
    return trimmed.includes(":")
      ? { kind: "host", value: trimmed.toLowerCase() }
      : { kind: "hostname", value: trimmed.toLowerCase() };
  }
}

function loadCorsRules(games: GameEntry[]): CorsRule[] {
  const seen = new Set<string>();
  const rules: CorsRule[] = [];

  for (const entry of games) {
    for (const value of entry.cors ?? []) {
      if (typeof value !== "string") continue;

      const rule = toCorsRule(value);
      if (!rule) continue;

      const key = `${rule.kind}:${"value" in rule ? rule.value : "*"}`;
      if (seen.has(key)) continue;

      seen.add(key);
      rules.push(rule);
    }
  }

  return rules;
}

export const authorizedGames = loadGames();

const corsRules = loadCorsRules(authorizedGames);

export function resolveCorsOrigin(origin: string): string | null {
  if (!origin) return null;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return null;
  }

  for (const rule of corsRules) {
    if (rule.kind === "wildcard") return origin;
    if (rule.kind === "origin" && rule.value === parsedOrigin.origin) return origin;
    if (rule.kind === "host" && rule.value === parsedOrigin.host.toLowerCase()) return origin;
    if (rule.kind === "hostname" && rule.value === parsedOrigin.hostname.toLowerCase()) {
      return origin;
    }
  }

  return null;
}
