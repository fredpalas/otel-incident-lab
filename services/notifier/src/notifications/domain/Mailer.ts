import type { Email } from './Email';

export abstract class Mailer {
  abstract send(email: Email): Promise<void>;
}
