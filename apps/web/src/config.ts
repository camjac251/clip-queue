export const env = {
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN as string,
  API_URL: import.meta.env.VITE_API_URL as string
}

// Validate required env vars at startup
if (!env.API_URL) {
  throw new Error('VITE_API_URL environment variable is required')
}

export const config = {
  title: 'Clip Queue',
  github: 'https://github.com/jordanshatford/clip-queue',
  copyright: {
    owner: 'Jordan Shatford',
    year: 2021
  }
}

export default config
