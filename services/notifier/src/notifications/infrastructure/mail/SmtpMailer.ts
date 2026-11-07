import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { config } from '../../../config';
import type { Email } from '../../domain/Email';
import { Mailer } from '../../domain/Mailer';

@Injectable()
export class SmtpMailer extends Mailer {
  private readonly transport = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 2_000,
    socketTimeout: 5_000,
  });

  async send(email: Email): Promise<void> {
    await this.transport.sendMail({ from: 'tickets@ticketing.example', to: email.to.value, subject: email.subject, text: email.text });
  }
}
