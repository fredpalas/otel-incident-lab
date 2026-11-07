const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10);
};

// Getters so values are read when used, not when the module is first imported.
export const config = {
  get port(): number {
    return intFromEnv('PORT', 3000);
  },
};
