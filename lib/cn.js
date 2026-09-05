import classNames from 'classnames'
import { extendTailwindMerge } from 'tailwind-merge'

// custom utilities tailwind-merge doesn't know about
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-weight': [{ font: ['bolder'] }],
      'text-color': ['text-reset'],
      'font-size': ['text-touch', 'small'],
      px: ['px-safe', 'px-safe-gutter'],
      'max-w': ['max-w-page']
    }
  }
})

export const cn = (...args) => twMerge(classNames(...args))
