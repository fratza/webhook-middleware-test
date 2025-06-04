module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [2, 'always', ['feat', 'feature', 'fix', 'chore']],
        'subject-case': [2, 'always', 'sentence-case'],
    },
};
