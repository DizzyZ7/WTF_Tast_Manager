import { pathToFileURL } from "node:url";
import {
  PgIssueRepository,
  PgProjectRepository,
  PgWorkspaceRepository,
  createPgPool,
  createWtfDatabase,
} from "@wtf/db";
import { createApiServer } from "./app.js";
import { loadApiConfig } from "./config/env.js";

/**
 * Запускает API server с production-зависимостями.
 */
export async function startServer(): Promise<void> {
  const config = loadApiConfig();
  const pool = createPgPool(config.DATABASE_URL);
  const db = createWtfDatabase(pool);
  const app = await createApiServer({
    config,
    workspaceRepository: new PgWorkspaceRepository(db),
    projectRepository: new PgProjectRepository(db),
    issueRepository: new PgIssueRepository(db),
  });

  const close = async (): Promise<void> => {
    await app.close();
    await pool.end();
  };

  process.once("SIGTERM", () => {
    void close();
  });
  process.once("SIGINT", () => {
    void close();
  });

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
