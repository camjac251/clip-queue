/**
 * Setup Script - Get Twitch Bot Token via OAuth
 *
 * This script starts a temporary server to handle the OAuth callback,
 * then opens your browser to authorize the app.
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { createServer } from 'http'

import { config } from 'dotenv'
import express from 'express'
import open from 'open'

import { resolveFromRoot } from './paths.js'

// Load .env from project root
config({ path: resolveFromRoot('.env') })

/**
 * Updates the TWITCH_BOT_TOKEN in .env file
 */
function updateEnvFile(token: string): void {
  const envPath = resolveFromRoot('.env')
  const envExamplePath = resolveFromRoot('.env.example')

  // Create .env from .env.example if it doesn't exist
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    console.log('📝 Creating .env from .env.example...')
    copyFileSync(envExamplePath, envPath)
  }

  // Read current .env content
  let envContent = ''
  try {
    envContent = readFileSync(envPath, 'utf-8')
  } catch (error) {
    console.error('❌ Could not read .env file:', error)
    return
  }

  // Split into lines and update/add TWITCH_BOT_TOKEN
  const lines = envContent.split('\n')
  let tokenLineIndex = -1

  // Find existing TWITCH_BOT_TOKEN line (including commented ones)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? ''
    if (line.startsWith('TWITCH_BOT_TOKEN=') || line.startsWith('#TWITCH_BOT_TOKEN=')) {
      tokenLineIndex = i
      break
    }
  }

  const newTokenLine = `TWITCH_BOT_TOKEN=${token}`

  if (tokenLineIndex !== -1) {
    // Replace existing line
    lines[tokenLineIndex] = newTokenLine
  } else {
    // Add after TWITCH_CLIENT_SECRET or at the end of Twitch config section
    let insertIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes('TWITCH_CLIENT_SECRET=')) {
        insertIndex = i + 1
        // Skip any blank lines or comments after CLIENT_SECRET
        while (
          insertIndex < lines.length &&
          (lines[insertIndex]?.trim() === '' || lines[insertIndex]?.trim().startsWith('#'))
        ) {
          insertIndex++
        }
        break
      }
    }

    if (insertIndex !== -1) {
      lines.splice(insertIndex, 0, newTokenLine)
    } else {
      // Fallback: append at end
      lines.push('', newTokenLine)
    }
  }

  // Write updated content back
  try {
    writeFileSync(envPath, lines.join('\n'), 'utf-8')
    console.log('✅ Updated .env file with TWITCH_BOT_TOKEN')
  } catch (error) {
    console.error('❌ Could not write to .env file:', error)
  }
}

const SETUP_PORT = 3333
const CLIENT_ID = process.env.TWITCH_CLIENT_ID
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const REDIRECT_URI = `http://localhost:${SETUP_PORT}/auth/callback`

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing environment variables!')
  console.error('Required: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET')
  console.error('\nAdd these to your .env file:')
  console.error('TWITCH_CLIENT_ID=your_twitch_client_id')
  console.error('TWITCH_CLIENT_SECRET=your_twitch_client_secret')
  process.exit(1)
}

console.log('🔧 Twitch Bot Token Setup')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\nThis will open your browser to authorize the bot.')
console.log('Scopes requested: user:read:chat')
console.log()

const app = express()
const server = createServer(app)

// Authorization URL
const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
authUrl.searchParams.set('client_id', CLIENT_ID)
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', 'user:read:chat')

// Callback endpoint
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query

  if (error) {
    console.error(`\n❌ Authorization failed: ${error}`)
    console.error(`   ${error_description}`)
    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Authorization Failed</h1>
          <p>${error}: ${error_description}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `)
    setTimeout(() => process.exit(1), 1000)
    return
  }

  if (!code) {
    console.error('\n❌ No authorization code received')
    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ No Authorization Code</h1>
          <p>You can close this window and try again.</p>
        </body>
      </html>
    `)
    setTimeout(() => process.exit(1), 1000)
    return
  }

  try {
    // Exchange code for access token
    console.log('\n🔄 Exchanging code for access token...')
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      })
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${error}`)
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      scope: string[]
      token_type: string
    }

    console.log('✅ Access token received!')
    console.log(`   Scopes: ${tokenData.scope.join(', ')}`)
    console.log(
      `   Expires in: ${tokenData.expires_in} seconds (${Math.floor(tokenData.expires_in / 86400)} days)`
    )

    // Validate token
    const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })

    if (!validateResponse.ok) {
      throw new Error('Token validation failed')
    }

    const validateData = (await validateResponse.json()) as {
      client_id: string
      login: string
      scopes: string[]
      user_id: string
      expires_in: number
    }

    console.log(`   User: ${validateData.login} (ID: ${validateData.user_id})`)

    // Update .env file
    console.log()
    updateEnvFile(tokenData.access_token)

    // Display success
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ SUCCESS! Your .env file has been updated.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n💡 Tip: This token expires in ~60 days. Re-run this script when it expires.')
    console.log()

    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✅ Authorization Successful!</h1>
          <p>Your access token has been generated and saved to <code>.env</code></p>
          <p><strong>You're all set! Start the server with <code>pnpm dev</code></strong></p>
          <p style="margin-top: 40px; color: #666;">You can close this window.</p>
        </body>
      </html>
    `)

    setTimeout(() => {
      server.close()
      process.exit(0)
    }, 2000)
  } catch (error) {
    console.error('\n❌ Error:', error)
    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Error</h1>
          <p>${error}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `)
    setTimeout(() => process.exit(1), 1000)
  }
})

// Home page (just in case)
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Twitch Bot Setup</h1>
        <p>Please check your terminal for instructions.</p>
      </body>
    </html>
  `)
})

// Start server
server.listen(SETUP_PORT, async () => {
  console.log(`📡 Setup server running on http://localhost:${SETUP_PORT}`)
  console.log('\n🌐 Opening browser...\n')

  try {
    await open(authUrl.toString())
  } catch {
    console.log('Could not open browser automatically.')
    console.log('Please open this URL manually:\n')
    console.log(authUrl.toString())
    console.log()
  }
})

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled')
  server.close()
  process.exit(0)
})
