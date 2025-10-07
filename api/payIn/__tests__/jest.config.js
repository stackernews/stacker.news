// Load environment variables FIRST before anything else
const { loadEnvConfig } = require('@next/env')
loadEnvConfig('./', true) // Load .env.development and .env.local

// Override DATABASE_URL for tests running on host machine
// docker-compose exposes db on port 5431, but internally it's db:5432
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@db:5432')) {
  // Running tests from host machine, need to use localhost:5431
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@db:5432', '@localhost:5431')
  console.log('📝 Adjusted DATABASE_URL for host machine:', process.env.DATABASE_URL.split('@')[1])
}

const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

// Custom config for payIn tests
const customJestConfig = {
  displayName: 'payIn',
  testMatch: ['**/api/payIn/__tests__/**/*.test.js'],
  setupFilesAfterEnv: [__dirname + '/jest.setup.js'],
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
  testEnvironment: 'node'
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration
// This handles the @ alias and other Next.js-specific features
module.exports = createJestConfig(customJestConfig)
