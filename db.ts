import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const sql = postgres(databaseUrl, {
  ssl: "require",
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
});

export default sql;
