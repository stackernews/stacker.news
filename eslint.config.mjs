import globals from 'globals'
import pluginJs from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import sonarjs from 'eslint-plugin-sonarjs'
import pluginPromise from 'eslint-plugin-promise'

export default [
  {
    files: ['**/*.{js,mjs,cjs,jsx}']
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  sonarjs.configs.recommended,
  pluginPromise.configs['flat/recommended'],
  {
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      eqeqeq: 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-empty': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-ignored-exceptions': 'off',
      'sonarjs/todo-tag': 'warn',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      'sonarjs/no-small-switch': 'off',
      'sonarjs/regex-complexity': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/x-powered-by': 'off',
      'sonarjs/no-inverted-boolean-check': 'off',
      'sonarjs/pseudo-random': 'warn',
      'sonarjs/public-static-readonly': 'off',
      'sonarjs/table-header': 'off',
      'sonarjs/no-invariant-returns': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'sonarjs/concise-regex': 'off',
      'sonarjs/duplicates-in-character-class': 'off',
      'sonarjs/updated-loop-counter': 'off',
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/single-character-alternation': 'off',
      'sonarjs/no-nested-assignment': 'off',
      'sonarjs/no-redundant-assignments': 'off',
      'sonarjs/single-char-in-character-classes': 'off',
      'sonarjs/slow-regex': 'off',
      'sonarjs/anchor-precedence': 'off',
      'promise/always-return': 'off',
      'promise/no-nesting': 'off',
      'promise/catch-or-return': 'off',
      'sonarjs/no-identical-functions': 'warn'
    }
  },
  {
    ignores: ['.next/*', '**/*.spec.js', 'node_modules/*', 'sw/**', 'public']
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    }
  }

]
