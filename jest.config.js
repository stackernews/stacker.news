const nextJest = require('next/jest')

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' })

const appProject = createJestConfig({
  displayName: 'app',
  testPathIgnorePatterns: ['/payIn/', '<rootDir>/capture/']
})

// the capture service is a standalone ESM package (capture/package.json has
// "type": "module") with its own deps, so next/jest's transform-to-CJS breaks it.
// run it as a second jest project with native ESM (no transform).
const captureProject = {
  displayName: 'capture',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/capture/**/*.spec.js'],
  transform: {}
}

module.exports = async () => ({
  projects: [await appProject(), captureProject]
})
