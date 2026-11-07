/** Port: application services report what happened without knowing where logs go. */
export abstract class Logger {
  abstract error(message: string, context: Record<string, unknown>): void;
}
