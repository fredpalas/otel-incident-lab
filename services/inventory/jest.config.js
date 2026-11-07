/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // The first run against an empty database seeds ~210k seats; CI runners need more than 5 s.
  testTimeout: 30_000,
  roots: ['<rootDir>/tests'],
  testRegex: '\\.test\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};
