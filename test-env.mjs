import { config } from 'dotenv';

console.log('=== Testing .env Loading ===\n');
console.log('Working directory:', process.cwd());

console.log('\n--- Shell Environment (BEFORE dotenv) ---');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET in shell' : 'NOT SET');
console.log('TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? 'SET in shell' : 'NOT SET');

console.log('\n--- Loading .env with override: true ---');
const result = config({ path: '.env', override: true, debug: true });

if (result.error) {
  console.error('\n❌ ERROR loading .env:', result.error.message);
  process.exit(1);
}

console.log('\n--- Successfully Parsed from .env ---');
const parsed = result.parsed || {};
console.log('Total variables:', Object.keys(parsed).length);
console.log('Keys:', Object.keys(parsed).join(', '));

console.log('\n--- Values in process.env (after dotenv) ---');
console.log('TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID);
console.log('TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET);
console.log('TWITCH_BOT_TOKEN:', process.env.TWITCH_BOT_TOKEN);
console.log('TWITCH_CHANNEL_NAME:', process.env.TWITCH_CHANNEL_NAME);
console.log('SESSION_SECRET:', process.env.SESSION_SECRET);
console.log('API_URL:', process.env.API_URL);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('PORT:', process.env.PORT);
