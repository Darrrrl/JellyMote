# JellyMote

A mobile-first Jellyfin remote. Browse movies and shows, choose an episode or movie, and tell a selected Jellyfin player to play it. The existing Now Playing, device discovery, transport, seek, volume, and mute controls remain available.

## Run locally

1. Copy `.env.example` to `.env` and set `JELLYFIN_URL` and `JELLYFIN_API_KEY`. The URL must be reachable **from the backend process**. Optionally set `JELLYFIN_LIBRARY_USER_NAME` to the exact Jellyfin username whose library and watched state JellyMote should show.
2. Run `npm install` and `npm run dev`.
3. Open `http://localhost:5173`, or use the development machine's LAN/Tailscale IP on port 5173 from a phone.

The Vite server proxies `/api` to the backend at port 3000. For production, run `npm run build` and `npm run start -w backend`; the backend serves the built frontend on `PORT` (default 3000).

## Docker Compose

1. Copy `.env.example` to `.env`. Set `JELLYFIN_URL` to an address reachable **from the container** and set `JELLYFIN_API_KEY`. Set `APP_PORT` if port 3000 is already in use on the Docker host. `JELLYFIN_LIBRARY_USER_NAME` is optional.
2. Run `docker compose up -d --build`.
3. Open `http://<docker-host>:<APP_PORT>` using the host's LAN IP, hostname, or Tailscale/MagicDNS name.

Compose publishes only JellyMote's web port. The browser calls relative `/api` URLs; JellyMote's backend contacts Jellyfin through `JELLYFIN_URL`. `localhost` inside the container means the JellyMote container, so use Jellyfin's LAN/Tailscale address, `host.docker.internal` where supported, or its Docker service name on a shared network. The API key stays in the container environment and is excluded from the image build context. JellyMote has no separate user login yet, so restrict access to trusted LAN/Tailscale users or put authentication in front of it.

If Jellyfin is on an existing external Docker network, create a local `docker-compose.override.yml` with the network name used by your Jellyfin deployment:

```yaml
services:
  jellymote:
    networks:
      - default
      - jellyfin
networks:
  jellyfin:
    external: true
    name: your_jellyfin_network
```

Then set `JELLYFIN_URL=http://jellyfin:8096` (replace `jellyfin` with the service name or network alias on that network) and run `docker compose up -d --build`. The override file may be kept locally if its network name is host-specific.

The backend alone reads the API key. Library browsing resolves an enabled user from Jellyfin `GET /Users`. With no `JELLYFIN_LIBRARY_USER_NAME`, it chooses the first enabled username alphabetically. The selected username appears on Library home. One user supplies library visibility and watched/progress data for all JellyMote browsers; this milestone does not implement per-browser Jellyfin login. For servers with multiple users, set `JELLYFIN_LIBRARY_USER_NAME` explicitly. The playback target remains the selected Jellyfin session, which may belong to a different user; that player must have access to the chosen item.

## Backend API

- `GET /api/libraries`: normalized movie/show views for the selected library user.
- `GET /api/library/movies`, `GET /api/library/shows`: normalized media lists from discovered views.
- `GET /api/movies/:id`, `GET /api/shows/:id`, `GET /api/shows/:id/seasons`, `GET /api/seasons/:id/episodes`: details and TV hierarchy.
- `GET /api/images/:id/:type`: constrained artwork (`Primary`, `Thumb`, `Backdrop`) resized for phone use.
- `POST /api/sessions/:sessionId/play` with `{ "itemIds": ["<movie-or-episode-id>"], "command": "PlayNow" }`: validates IDs and command, verifies the active remote-capable session and playable item, then sends Jellyfin Session Play. HTTP 204 means Jellyfin accepted the command, not that the client confirmed playback.

The existing `/api/server`, `/api/sessions`, `/api/sessions/:sessionId/playstate`, `/seek`, `/volume`, and `/mute` routes remain. Input is constrained and no arbitrary Jellyfin proxy or API key is exposed.

JellyMote uses Jellyfin `GET /Users`, `GET /Users/{userId}/Views`, `GET /Items`, `GET /Users/{userId}/Items/{itemId}`, `GET /Shows/{seriesId}/Seasons`, `GET /Shows/{seriesId}/Episodes`, `GET /Items/{itemId}/Images/{type}`, `GET /Sessions`, and `POST /Sessions/{sessionId}/Playing`. The [Jellyfin Session Play API](https://typescript-sdk.jellyfin.org/interfaces/generated-client.SessionApiPlayRequest.html) documents `sessionId`, `itemIds`, and `playCommand`. The [Show API](https://typescript-sdk.jellyfin.org/interfaces/generated-client.ShowApiGetEpisodesRequest.html) documents season and episode queries.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. Unit tests cover input validation and normalized response fields. Real Jellyfin playback remains a manual check because player support varies and an HTTP acceptance does not guarantee the device acted on the command. Jellyfin clients that do not advertise remote/media control cannot be targeted; some that advertise it may still ignore PlayNow. WebSockets, music, global search, and a Jellyfin login system are outside this milestone.
