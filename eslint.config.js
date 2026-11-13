import js from '@eslint/js';
import globals from 'globals';
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'tmp/**',
      'temp/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];
