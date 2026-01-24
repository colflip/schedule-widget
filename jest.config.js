module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/server'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleNameMapper: {
    '^db$': '<rootDir>/src/server/db/db.js'
  },
  testSequencer: '<rootDir>/jest.defaultSequencer.js',
  verbose: true
};
