import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { chrome: 'readonly', console: 'readonly', document: 'readonly', window: 'readonly', location: 'readonly', MutationObserver: 'readonly', URL: 'readonly', fetch: 'readonly', AbortController: 'readonly', HTMLElement: 'readonly', HTMLInputElement: 'readonly', Event: 'readonly', Node: 'readonly', Element: 'readonly', navigator: 'readonly' } } }
);
