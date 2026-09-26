import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';

export interface SendVerificationCodeInput {
  email: string;
  displayName: string;
  code: string;
  expiresAt: Date;
}

export interface SendPasswordResetCodeInput {
  email: string;
  displayName: string;
  code: string;
  expiresAt: Date;
}

interface SendCodeEmailInput {
  email: string;
  displayName: string;
  code: string;
  expiresAt: Date;
  subject: string;
  heading: string;
  description: string;
  ignoreText: string;
}

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);

  public constructor(private readonly config: ConfigService<Env, true>) {}

  public async sendVerificationCode(
    input: SendVerificationCodeInput,
  ): Promise<void> {
    await this.sendCodeEmail({
      ...input,

      subject: 'Verify your Lumos email',

      heading: 'Verify your Lumos email',

      description:
        'Use this verification code to finish creating your Lumos account:',

      ignoreText:
        'If you did not create a Lumos account, you can ignore this email.',
    });
  }

  public async sendPasswordResetCode(
    input: SendPasswordResetCodeInput,
  ): Promise<void> {
    await this.sendCodeEmail({
      ...input,

      subject: 'Reset your Lumos password',

      heading: 'Reset your Lumos password',

      description: 'Use this verification code to reset your Lumos password:',

      ignoreText:
        'If you did not request a password reset, you can ignore this email.',
    });
  }

  private async sendCodeEmail(input: SendCodeEmailInput): Promise<void> {
    const provider = this.config.get('AUTH_EMAIL_PROVIDER', {
      infer: true,
    });

    if (provider === 'console') {
      this.logger.log(
        [
          input.subject,
          `email=${input.email}`,
          `code=${input.code}`,
          `expiresAt=${input.expiresAt.toISOString()}`,
        ].join(' '),
      );

      return;
    }

    await this.sendWithResend(input);
  }

  private async sendWithResend(input: SendCodeEmailInput): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', {
      infer: true,
    });

    const from = this.config.get('AUTH_EMAIL_FROM', {
      infer: true,
    });

    if (!apiKey || !from) {
      throw new Error('Resend email provider is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,

        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        from,

        to: [input.email],

        subject: input.subject,

        html: this.codeEmailHtml(input),
      }),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Auth email delivery failed with HTTP ${response.status}: ${responseBody}`,
      );
    }
  }

  private codeEmailHtml(input: SendCodeEmailInput): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
        <h2 style="margin-bottom:16px;">
          ${this.escapeHtml(input.heading)}
        </h2>

        <p>
          Hi ${this.escapeHtml(input.displayName)},
        </p>

        <p>
          ${this.escapeHtml(input.description)}
        </p>

        <div style="
          font-size:32px;
          font-weight:700;
          letter-spacing:8px;
          margin:28px 0;
        ">
          ${this.escapeHtml(input.code)}
        </div>

        <p>
          This code expires in 10 minutes.
        </p>

        <p style="color:#666;font-size:13px;margin-top:32px;">
          ${this.escapeHtml(input.ignoreText)}
        </p>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
