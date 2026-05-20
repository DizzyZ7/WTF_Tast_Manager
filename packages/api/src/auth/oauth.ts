import { HttpError } from "../errors/http-error.js";

/**
 * OAuth2 provider, поддерживаемый WTF.
 */
export type OAuthProvider = "google" | "github";

/**
 * Конфигурация OAuth2 authorize endpoint.
 */
export interface OAuthConfig {
  /** Google client id. */
  readonly googleClientId: string;
  /** GitHub client id. */
  readonly githubClientId: string;
  /** Базовый callback URL API. */
  readonly redirectBaseUrl: string;
}

/**
 * Формирует URL авторизации внешнего OAuth2 provider.
 */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  config: OAuthConfig,
  state: string,
): string {
  const redirectUri = `${config.redirectBaseUrl}/v1/oauth/${provider}/callback`;
  if (provider === "google") {
    if (config.googleClientId.length === 0) {
      throw new HttpError(503, "Google OAuth не настроен", "oauth_not_configured");
    }

    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (config.githubClientId.length === 0) {
    throw new HttpError(503, "GitHub OAuth не настроен", "oauth_not_configured");
  }

  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}
