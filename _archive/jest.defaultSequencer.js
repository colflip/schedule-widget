class DefaultSequencer {
    sort(tests) {
        return Array.from(tests).sort((a, b) => {
            if (a.path < b.path) return -1;
            if (a.path > b.path) return 1;
            return 0;
        });
    }

    shard(tests) {
        return tests;
    }

    cacheResults(tests, results) {
        return results;
    }
}

module.exports = DefaultSequencer;

