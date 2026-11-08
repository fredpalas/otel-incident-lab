import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { config } from '../../../config';
import type { Email } from '../../domain/Email';
import { Mailer } from '../../domain/Mailer';
import { inSpan } from '../../../shared/infrastructure/tracing';

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
    // SMTP has no auto-instrumentation: without this span a failed send is invisible in the trace.
    await inSpan('SmtpMailer.send', __filename, { 'server.address': config.smtpHost }, () =>
      this.transport.sendMail({ from: 'tickets@ticketing.example', to: email.to.value, subject: email.subject, text: email.text }),
    );
  }
}
