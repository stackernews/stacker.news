// Load environment variables FIRST before anything else
const { loadEnvConfig } = require('@next/env')
const path = require('path')

// jest sets NODE_ENV=test, and @next/env keys the files it reads off NODE_ENV, not off
// its `dev` argument — so it would look for a .env.test that this repo doesn't have.
// pretend to be development for the duration of the load so .env.development/.env.local are read.
const nodeEnv = process.env.NODE_ENV
process.env.NODE_ENV = 'development'
loadEnvConfig('./', true) // Load .env.development and .env.local
process.env.NODE_ENV = nodeEnv

// container names only resolve inside the docker network, so the rewrites below apply
// when the suite runs on the host — but the same suite can also be run inside the app
// container (docker compose exec app npm test -- --config ...), where they must not.
const onHost = !require('fs').existsSync('/.dockerenv')

// Override DATABASE_URL for tests running on host machine
// docker-compose exposes db on port 5431, but internally it's db:5432
if (onHost && process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@db:5432')) {
  // Running tests from host machine, need to use localhost:5431
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@db:5432', '@localhost:5431')
  console.log('📝 Adjusted DATABASE_URL for host machine:', process.env.DATABASE_URL.split('@')[1])
}

// Override LND_SOCKET for tests running on host machine
// docker-compose exposes sn_lnd on port 10009, but internally it's sn_lnd:10009
if (onHost && process.env.LND_SOCKET && process.env.LND_SOCKET === 'sn_lnd:10009') {
  process.env.LND_SOCKET = 'localhost:10009'
  console.log('📝 Adjusted LND_SOCKET for host machine:', process.env.LND_SOCKET)
}

const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

// Custom config for payIn tests
const customJestConfig = {
  testMatch: ['**/api/payIn/__tests__/**/*.test.js'],
  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.js')],
  testTimeout: 30000, // 30 seconds for database operations

  // Run tests serially to avoid database conflicts
  maxWorkers: 1,

  // Clear mocks between tests
  clearMocks: true,

  // Collect coverage from payIn directory
  collectCoverageFrom: [
    'api/payIn/**/*.js',
    '!api/payIn/__tests__/**',
    '!api/payIn/**/*.test.js'
  ],

  // Use node environment (not jsdom)
  testEnvironment: 'node',

  // Set NODE_ENV to production to skip docker hostname conversion in lnbits.js
  // This allows tests to connect to localhost:5001 directly
  testEnvironmentOptions: {
    NODE_ENV: 'production'
  }
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration
// This handles the @ alias and other Next.js-specific features
module.exports = createJestConfig(customJestConfig)
