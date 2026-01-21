import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: [
            "**/coverage/**",
            "**/node_modules/**",
            "**/stuff/**",
        ],
    },

    js.configs.recommended,

    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
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