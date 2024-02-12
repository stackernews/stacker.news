const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './'
})

// Add any custom config to be passed to Jest
/** @type {import("jest").Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest/jest.setup.jsx'],
  moduleFileExtensions: ['js', 'jsx'],
  moduleNameMapper: {
    '^test-utils$': '<rootDir>/jest/test-utils.jsx',
    '^.+\\.(svg)$': '<rootDir>/__mocks__/fileMock.js'
  }
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// https://stackoverflow.com/a/75604417/21032284
module.exports = async () => {
  const jestConfig = await createJestConfig(config)()
  const out = {
    ...jestConfig,
    transformIgnorePatterns: [
      '(?!(/node_modules/(next|github-slugger|react-markdown|vfile|vfile-message|unist-.*|unified|bail|is-plain-obj|trough|remark-.*|mdast-util-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|pretty-bytes)/))(/node_modules/.+.(js|jsx|mjs|cjs|ts|tsx)$)'
    ]
  }
  return out
}
