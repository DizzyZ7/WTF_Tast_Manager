import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./src/migrations",
  schema: "./src/schema/index.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://wtf:wtf@localhost:5432/wtf",
  },
  strict: true,
  verbose: true,
});
