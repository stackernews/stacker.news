import classNames from 'classnames'
import { extendTailwindMerge } from 'tailwind-merge'

// teach twMerge the SN theme tokens it can't infer from class names alone
// (styles/tailwind.css @theme/@utility) — without this, a consumer override
// in the same group wouldn't drop the custom class and the winner would fall
// through to stylesheet order. every custom token added to @theme needs an
// entry here or overrides silently stop merging.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-weight': [{ font: ['bolder'] }],
      'text-color': ['text-reset']
    }
  }
})

export const cn = (...args) => twMerge(classNames(...args))
