const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
};

export const env = {
  databaseUrl: required('DATABASE_URL'),
  gatewayUrl: required('GATEWAY_URL'),
  lokiUrl: required('LOKI_URL'),
  tempoUrl: required('TEMPO_URL'),
  prometheusUrl: required('PROMETHEUS_URL'),
  toxiproxyUrl: required('TOXIPROXY_URL'),
};
