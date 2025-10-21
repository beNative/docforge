import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import promisePlugin from "eslint-plugin-promise";

export default [
    {
        ignores: [
            "dist",
            "release",
            "node_modules",
            "**/*.d.ts",
            "scripts/__tests__/fixtures",
            "services/preview/__fixtures__",
            "artifacts",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
            },
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                URL: "readonly",
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        plugins: {
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
            promise: promisePlugin,
        },
        rules: {
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            "react/display-name": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "off",
            "promise/always-return": "off",
            "promise/catch-or-return": "off",
            "no-empty": ["error", { allowEmptyCatch: true }],
        },
    },
    {
        files: ["**/*.{js,cjs,mjs}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                console: "readonly",
                module: "writable",
                require: "readonly",
                __dirname: "readonly",
                process: "readonly",
                URL: "readonly",
            },
        },
        plugins: {
            promise: promisePlugin,
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "promise/always-return": "off",
            "promise/catch-or-return": "off",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    prettierConfig,
];
