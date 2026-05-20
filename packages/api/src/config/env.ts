import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  AUTH_ALLOWED_EMAILS: z.string().default(""),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  OAUTH_GOOGLE_CLIENT_ID: z.string().default(""),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().default(""),
  OAUTH_GITHUB_CLIENT_ID: z.string().default(""),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().default(""),
  OAUTH_REDIRECT_BASE_URL: z.url().default("http://localhost:8080"),
});

/**
 * Конфигурация API после runtime-валидации окружения.
 */
export type ApiConfig = z.infer<typeof envSchema>;

/**
 * Читает и валидирует переменные окружения API.
 */
export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return envSchema.parse(env);
}
