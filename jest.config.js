module.exports = {
    testEnvironment: 'node',
    clearMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/server/services/**/*.js',
        'src/server/utils/**/*.js'
    ]
};
