module.exports = {
    extends: [ "@reiryoku/eslint-config-reiryoku", ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
    },
    plugins: [ "@typescript-eslint", ],
};
