import { config } from '../config/index.js';

export function jellyfinHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: 'application/json',
    ...extra,
    Authorization: `MediaBrowser Token="${config.apiKey}"`,
  };
}
