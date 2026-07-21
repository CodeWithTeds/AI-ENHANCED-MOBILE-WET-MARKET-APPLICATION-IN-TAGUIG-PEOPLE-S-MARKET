/**
 * API Configuration — single source of truth for server connection.
 * 
 * Change the IP here when switching networks or devices.
 * Use your computer's LAN IP (run `ipconfig getifaddr en0` on Mac).
 */

export const API_CONFIG = {
  host: '192.168.1.10',
  port: '8080',
} as const;

export const API_BASE_URL = `http://${API_CONFIG.host}:${API_CONFIG.port}/api/v1`;
