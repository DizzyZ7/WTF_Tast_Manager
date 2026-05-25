import nodemailer from "nodemailer";

/**
 * Параметры письма подтверждения email.
 */
export interface SendEmailVerificationInput {
  readonly to: string;
  readonly verificationUrl: string;
  readonly expiresAt: Date;
}

/**
 * Минимальный контракт отправки email.
 */
export interface EmailSender {
  readonly sendEmailVerification: (input: SendEmailVerificationInput) => Promise<void>;
}

/**
 * Конфигурация SMTP-транспорта.
 */
export interface EmailSenderConfig {
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpSecure: boolean;
  readonly smtpUser: string;
  readonly smtpPassword: string;
  readonly emailFrom: string;
}

/**
 * Создает SMTP sender или console fallback, если SMTP_HOST не задан.
 */
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  if (config.smtpHost.length === 0) {
    return new ConsoleEmailSender();
  }

  return new SmtpEmailSender(config);
}

class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;

  public constructor(private readonly config: EmailSenderConfig) {
    const auth =
      config.smtpUser.length === 0
        ? undefined
        : {
            user: config.smtpUser,
            pass: config.smtpPassword,
          };

    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      ...(auth === undefined ? {} : { auth }),
    });
  }

  public async sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: input.to,
      subject: "Подтверждение email в WTF",
      text: renderVerificationText(input),
      html: renderVerificationHtml(input),
    });
  }
}

class ConsoleEmailSender implements EmailSender {
  public sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
    console.info(
      [
        "WTF email verification link",
        `to=${input.to}`,
        `expiresAt=${input.expiresAt.toISOString()}`,
        `url=${input.verificationUrl}`,
      ].join(" "),
    );
    return Promise.resolve();
  }
}

function renderVerificationText(input: SendEmailVerificationInput): string {
  return [
    "Подтвердите email для входа в WTF.",
    "",
    `Откройте ссылку: ${input.verificationUrl}`,
    `Ссылка действует до ${input.expiresAt.toISOString()}.`,
  ].join("\n");
}

function renderVerificationHtml(input: SendEmailVerificationInput): string {
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;">Подтвердите email</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#52525b;">
          Нажмите кнопку ниже, чтобы завершить регистрацию в WTF.
        </p>
        <a href="${escapeHtml(input.verificationUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;padding:10px 16px;font-size:14px;font-weight:700;">
          Подтвердить email
        </a>
        <p style="margin:20px 0 0;font-size:12px;line-height:18px;color:#71717a;">
          Ссылка действует до ${escapeHtml(input.expiresAt.toISOString())}.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
