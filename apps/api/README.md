# Clip Queue Server

Backend service for multi-user clip queue with persistent Twitch EventSub chat monitoring.

## Architecture

- **Express** - REST API server
- **HTTP Polling** - Real-time synchronization with ETag optimization
- **EventSub** - Twitch chat monitoring (official API)
- **SQLite** - Persistent clip storage (Drizzle ORM)
- **Docker** - Containerized deployment

## Development

### Prerequisites

```bash
# Install dependencies (from project root)
pnpm install

# Create environment file
cp .env.example .env
# Edit .env with your Twitch credentials
```

### Environment Variables

```bash
# Required
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_BOT_TOKEN=your_bot_oauth_token  # Run 'pnpm api setup'
TWITCH_CHANNEL_NAME=your_channel_name

# Optional
FRONTEND_URL=http://localhost:5173  # CORS origin
PORT=3000                           # Server port
DB_PATH=/app/data/clips.db         # SQLite database path
```

### Getting Bot Token

Run the setup script to get your bot token via OAuth:

```bash
# From project root (recommended)
pnpm api setup
# Or: make api-setup
```

This will:

1. Start a temporary OAuth server on port 3333
2. Open your browser to Twitch authorization
3. Print your access token to the terminal
4. Copy the token to `.env` as `TWITCH_BOT_TOKEN`

**Troubleshooting:**

- **"Missing environment variables"** - Add your client ID and secret to `.env` first
- **Browser doesn't open** - The URL will be printed to the terminal. Copy and paste it manually
- **"Authorization failed"** - Make sure port 3333 is not in use; check your client ID and secret are correct
- **Token expires** - Tokens expire after ~60 days. Just re-run `pnpm api setup` to get a fresh token

### Running Locally

```bash
# From project root (recommended)
pnpm api dev
# Or: make api-dev

# Or cd into apps/api
cd apps/api
pnpm dev
```

The server will:

1. Connect to Twitch EventSub WebSocket
2. Subscribe to chat messages for your channel
3. Start Express server on port 3000
4. Create SQLite database in `data/clips.db`

### Testing

```bash
# Check server health
curl http://localhost:3000/api/health

# Get queue state
curl http://localhost:3000/api/queue

# Submit a clip manually
curl -X POST http://localhost:3000/api/queue/submit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://clips.twitch.tv/...", "submitter":"testuser"}'
```

## Deployment

### Docker (Recommended)

```bash
# Build and start
docker-compose up -d clip-queue-backend

# View logs
docker logs clip-queue-backend -f

# Stop
docker-compose down
```

### Manual Deployment

```bash
# Build
pnpm build

# Start
pnpm start
```

## API Endpoints

### Health Check

```
GET /api/health
```

Returns server status and chat connection state.

### Get Queue

```
GET /api/queue
```

Returns current clip, upcoming queue, and history.

### Submit Clip

```
POST /api/queue/submit
Body: { "url": "https://...", "submitter": "username" }
```

Manually submit a clip (used for testing, clips normally come from chat).

### Advance Queue

```
POST /api/queue/advance
```

Move to next clip.

### Previous Clip

```
POST /api/queue/previous
```

Go back to previous clip.

### Clear Queue

```
DELETE /api/queue
```

Clear all upcoming clips.

### Open/Close Queue

```
POST /api/queue/open
POST /api/queue/close
```

Enable/disable clip submissions from chat.

## How It Works

1. **EventSub Connection**: Server connects to Twitch EventSub WebSocket and subscribes to `channel.chat.message` events
2. **Message Processing**: When a chat message contains a Twitch clip URL, the server fetches clip metadata
3. **Auto-Approval**: Messages from moderators/broadcaster are auto-approved and added to queue
4. **Queue Management**: Clips are stored in memory (ClipList) and persisted to SQLite (Drizzle ORM)
5. **HTTP Polling**: Clients poll `GET /api/queue` every 2 seconds with ETag headers for efficient state synchronization
6. **ETag Optimization**: Server returns `304 Not Modified` when state unchanged (minimal bandwidth)
7. **Reconnection**: Auto-reconnects if EventSub connection drops

## Troubleshooting

### EventSub Connection Fails

- Check `TWITCH_BOT_TOKEN` is valid and not expired
- Ensure token has `user:read:chat` scope
- Verify `TWITCH_CLIENT_ID` matches the app that generated the token

### Clips Not Being Added

- Check logs: `docker logs clip-queue-backend -f`
- Verify EventSub is connected (look for "Connected to EventSub")
- Test with a moderator account (auto-approved)
- Check queue is open (default: open)

### Clients Not Receiving Updates

- Verify `FRONTEND_URL` is set correctly for CORS
- Check HTTP polling endpoint: `curl http://localhost:3000/api/queue`
- Verify ETag header is present in response
- Check browser console for 304 responses (expected behavior)

## Database

SQLite schema:

```sql
CREATE TABLE clips (
  id TEXT PRIMARY KEY,           -- UUID (platform:clip_id)
  data TEXT NOT NULL,            -- JSON: Full Clip object
  status TEXT DEFAULT 'approved',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  played_at DATETIME
);
```

Backup:

```bash
# Copy database from container
docker cp clip-queue-backend:/app/data/clips.db ./backups/

# Or use volume mount (already configured)
cp ./data/clips.db ./backups/clips-$(date +%Y%m%d).db
```

## Future Enhancements

- [ ] User authentication (Twitch OAuth)
- [ ] Role-based permissions (streamer, moderator, viewer)
- [ ] Moderation queue (approve/reject pending clips)
- [ ] Multi-channel support
- [ ] Clip voting system
- [ ] Analytics dashboard
