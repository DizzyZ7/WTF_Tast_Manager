import { z } from "zod";

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized.length === 0) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  EMAIL_VERIFICATION_BASE_URL: z.url().default("http://localhost:8080"),
  EMAIL_FROM: z.string().default("WTF <no-reply@wtf.local>"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanEnvSchema.default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
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
