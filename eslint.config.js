import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'db', 'docs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    // Read from the installed react package, so the version never drifts from
    // package.json. Without it eslint-plugin-react warns on every run.
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // exhaustive-deps is the rule that let the year-switch race conditions in.
      // It is an error here, not a warning: a stale closure over `currentYear` is
      // a wrong number on screen, not a style question.
      'react-hooks/exhaustive-deps': 'error',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // A component declared inside another component is a NEW type on every
      // render, so React unmounts and remounts its whole subtree — state, focus
      // and animations all reset. `allowAsProps` keeps the legitimate case:
      // Recharts takes components through props (content=, shape=, label=) and
      // clones them itself.
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],

      // `catch {}` and deliberate no-op handlers are used in a few places where
      // the failure genuinely does not matter (best-effort localStorage writes).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // Diagnostic tooling talks to an unknown database shape on purpose.
    files: ['utils/databaseDiagnostic.ts', 'utils/detailedDiagnostic.ts', 'components/DatabaseDiagnostic.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // A context file exports its Provider next to the hook that reads it. Splitting
    // them to satisfy Fast Refresh would put the hook somewhere it does not belong;
    // the cost is a full reload when the context file itself is edited.
    files: ['contexts/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
