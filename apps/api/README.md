# Clip Queue Server

Backend service for multi-user clip queue with persistent Twitch EventSub chat monitoring.

## Architecture

- **Express** - REST API server
- **Socket.io** - Real-time WebSocket synchronization
- **EventSub** - Twitch chat monitoring (official API)
- **SQLite** - Persistent clip storage
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

## WebSocket Events

### Server → Client

- `sync:state` - Initial state sync on connection
- `clip:added` - New clip added to queue
- `clip:removed` - Clip removed from queue
- `queue:current` - Current clip changed
- `queue:cleared` - Queue was cleared
- `queue:opened` - Queue opened for submissions
- `queue:closed` - Queue closed for submissions

### Client → Server

No client events currently - clients use REST API for commands.

## How It Works

1. **EventSub Connection**: Server connects to Twitch EventSub WebSocket and subscribes to `channel.chat.message` events
2. **Message Processing**: When a chat message contains a Twitch clip URL, the server fetches clip metadata
3. **Auto-Approval**: Messages from moderators/broadcaster are auto-approved and added to queue
4. **Queue Management**: Clips are stored in memory (ClipList) and persisted to SQLite
5. **Real-Time Sync**: All queue changes broadcast via Socket.io to connected clients
6. **Reconnection**: Auto-reconnects if EventSub connection drops

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

### WebSocket Clients Can't Connect

- Verify `FRONTEND_URL` is set correctly for CORS
- Check Traefik is routing to port 3000
- Ensure WebSocket upgrade headers are configured (see docker-compose.yml)

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
