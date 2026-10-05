module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist-test/test/**/*.jest.test.js'],
  transform: {},
  maxWorkers: 1,
  testTimeout: 15000,
  clearMocks: true,
};
