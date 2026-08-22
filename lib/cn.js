import classNames from 'classnames'
import { extendTailwindMerge } from 'tailwind-merge'

// Tailwind Merge already understands theme-backed classes. Extend only custom
// utility names that do not fit its built-in groups.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-weight': [{ font: ['bolder'] }],
      'text-color': ['text-reset']
    }
  }
})

export const cn = (...args) => twMerge(classNames(...args))
