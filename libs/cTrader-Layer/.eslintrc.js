module.exports = {
    extends: [ "@reiryoku/eslint-config-reiryoku", ],
    parser: "@typescript-eslint/parser",
    plugins: [ "@typescript-eslint", ],
    parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
    },
};
