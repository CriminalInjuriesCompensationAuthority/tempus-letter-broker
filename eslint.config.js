import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,

    {
        files: ["**/*.js"],
        ignores: ["coverage/**", "node_modules/**"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node
            },
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },

    {
        files: ["**/*.test.js"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
];
