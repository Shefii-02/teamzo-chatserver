# chat-server

Realtime server for Teamzo: `/staff` socket (lead alerts, team chat, website-chat pushes), `/widget` visitor socket,
team-chat REST (`/api/team-chat/*`), website live-chat REST (`/api/widget-chat/*`) and Laravel's `/api/internal/*` push endpoints.
Shares Laravel's MySQL database and verifies Laravel's JWT locally. Production: `https://chatserver.teamzo.io`.

## Run
    cp .env.example .env      # DB_*, JWT_SECRET, INTERNAL_API_KEY must equal Laravel's
    npm ci && npm run build && node dist/main     # dev: npm run start:dev
    pm2 start ecosystem.config.cjs                # production; nginx: deploy/nginx-chatserver.teamzo.io.conf

## Laravel / clients
- Laravel `.env`: `CHAT_SERVICE_URL=http://127.0.0.1:3005`, `CHAT_PUBLIC_URL=https://chatserver.teamzo.io`, same `INTERNAL_API_KEY`.
- Web: `VITE_CHAT_URL=https://chatserver.teamzo.io`. Flutter: `ApiConstants.chatBase` / `chatSocketUrl`.

## Check it works
    node scripts/smoke.js --user <staffId> --chat <chatId> [--url https://chatserver.teamzo.io]
Postman: REST with `Authorization: Bearer <Laravel JWT>`; Socket.IO request to `/staff` with auth `{"token":"<jwt>"}`.

Single instance only: presence and rooms are in-process (multi-instance needs the Redis adapter).
