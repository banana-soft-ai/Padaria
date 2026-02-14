/** @type {import('jest').Config} */
const isE2E = process.argv.some((arg) => arg.includes('tests/e2e'))

const config = {
  testEnvironment: isE2E ? 'node' : 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: false }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  ...(isE2E ? { maxWorkers: 1 } : {}),
}

module.exports = config
