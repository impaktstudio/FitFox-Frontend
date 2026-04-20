import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/config/env";
import * as schema from "@/lib/db/schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  const env = getEnv();

  if (!env.DATABASE_URL) {
    return null;
  }

  if (!client) {
    client = postgres(env.DATABASE_URL, { max: 5 });
    db = drizzle(client, { schema });
  }

  return db;
}
