import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

/**
 * Типизированное подключение Drizzle к базе WTF.
 */
export type WtfDatabase = NodePgDatabase<typeof schema>;

/**
 * Создает пул PostgreSQL.
 */
export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

/**
 * Создает Drizzle database client поверх существующего пула.
 */
export function createWtfDatabase(pool: Pool): WtfDatabase {
  return drizzle(pool, { schema });
}

/**
 * Закрывает PostgreSQL pool.
 */
export async function closePgPool(pool: Pool): Promise<void> {
  await pool.end();
}
