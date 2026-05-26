import { z } from "zod";

export const uuidSchema = z.uuid();
export const issueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
]);
const passwordSchema = z.string().min(8).max(256);
export const registerRequestSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});
export const loginRequestSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});
export const tokenRequestSchema = loginRequestSchema;
export const resendVerificationRequestSchema = z.object({
  email: z.email(),
});
export const verifyEmailQuerySchema = z.object({
  token: z.string().min(32).max(256),
});
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(32),
});
const internalNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/)
  .transform((value) => value.toUpperCase());
export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  internalNumber: internalNumberSchema.optional(),
  ownerUserId: uuidSchema.optional(),
});
export const requestWorkspaceAccessSchema = z.object({
  internalNumber: internalNumberSchema,
});
export const addWorkspaceMemberSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});
export const createProjectSchema = z.object({
  name: z.string().min(2).max(160),
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9]{1,9}$/),
  leadUserId: uuidSchema.optional(),
});
export const createIssueSchema = z.object({
  title: z.string().min(3).max(240),
  description: z.string().max(50_000).optional(),
  reporterId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});
export const addCommentSchema = z.object({
  authorId: uuidSchema.optional(),
  body: z.string().min(1).max(50_000),
});
export const updateIssueStatusSchema = z.object({
  status: issueStatusSchema,
});
export const listIssuesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * Валидирует unknown JSON body через Zod.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Валидирует unknown query string через Zod.
 */
export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  return schema.parse(query);
}
