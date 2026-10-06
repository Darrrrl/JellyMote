import 'dotenv/config';

const rawUrl = process.env.JELLYFIN_URL?.trim();
const apiKey = process.env.JELLYFIN_API_KEY?.trim();

if (!rawUrl || !apiKey) {
  throw new Error('JELLYFIN_URL and JELLYFIN_API_KEY must be set.');
}

let parsed: URL;
try {
  parsed = new URL(rawUrl);
} catch {
  throw new Error('JELLYFIN_URL must be a valid HTTP or HTTPS URL.');
}
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error('JELLYFIN_URL must use HTTP or HTTPS.');
}

export const config = {
  jellyfinUrl: rawUrl.replace(/\/+$/, ''),
  apiKey,
  libraryUserName: process.env.JELLYFIN_LIBRARY_USER_NAME?.trim() || null,
  port: Number(process.env.PORT || 3000),
};
