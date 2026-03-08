module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: {
        'quotes': 'off',
        '@typescript-eslint/quotes': ['error', 'single', { avoidEscape: true }],
        'jsx-quotes': ['error', 'prefer-double']
    },
    ignorePatterns: ['dist', 'node_modules']
};
