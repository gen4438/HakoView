import typescriptEslint from "typescript-eslint";

export default [{
    ignores: ["dist/", "out/", "build/", "coverage/", "node_modules/", "webview/dist/", "*.min.js", "*.config.js", "*.config.mjs", "esbuild.js", "esbuild.webview.js"]
}, {
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",
    },
}];