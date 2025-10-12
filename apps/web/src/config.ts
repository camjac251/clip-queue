export const env = {
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN as string,
  API_URL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000'
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
