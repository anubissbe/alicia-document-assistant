/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/out/', '/dist/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/test/**',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  testTimeout: 10000,
  // Mock the VS Code API
  moduleNameMapper: {
    'vscode': '<rootDir>/src/test/vscode-mock.ts'
  },
};
