# Server Setup - Get Bot Token

## Automatic Setup (Recommended)

Run the setup script to get your bot token via OAuth:

```bash
# From project root (recommended)
pnpm api setup
# Or: make api-setup

# Or cd into apps/api and run directly
cd apps/api
pnpm setup
```

This will:
1. Start a temporary OAuth server on port 3333
2. Open your browser to Twitch authorization
3. Print your access token to the terminal
4. Copy the token to `.env`

### What You'll See

```
🔧 Twitch Bot Token Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This will open your browser to authorize the bot.
Scopes requested: user:read:chat

📡 Setup server running on http://localhost:3333

🌐 Opening browser...

🔄 Exchanging code for access token...
✅ Access token received!
   Scopes: user:read:chat
   Expires in: 5184000 seconds (60 days)
   User: camj (ID: 123456789)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SUCCESS! Copy this token to your .env file:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TWITCH_BOT_TOKEN=abc123def456...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Tip: This token expires in ~60 days. Re-run this script when it expires.
```

### Prerequisites

Your `.env` must have:
```bash
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

## Troubleshooting

### "Missing environment variables"
Add your client ID and secret to `.env` first.

### Browser doesn't open
The URL will be printed to the terminal. Copy and paste it manually.

### "Authorization failed"
- Make sure port 3333 is not in use
- Check your client ID and secret are correct
- Try the manual setup method instead

### Token expires
Tokens expire after ~60 days. Just re-run `pnpm api setup` (or `make api-setup`) to get a fresh token.

## Security Note

**Never commit your `.env` file!** It contains secrets and is gitignored by default.

The setup script only runs locally and doesn't send your credentials anywhere except to Twitch's official OAuth servers.
