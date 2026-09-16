export const API_CONFIG = {
  host: '192.168.1.2',
  port: '8080',
} as const;

export const API_BASE_URL = `http://${API_CONFIG.host}:${API_CONFIG.port}/api/v1`;
