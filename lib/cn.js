import classNames from 'classnames'
import { extendTailwindMerge } from 'tailwind-merge'

// teach twMerge the SN theme tokens it can't infer from class names alone
// (styles/tailwind.css @theme/@utility) — without this, a consumer override
// like `rounded-full` wouldn't drop a recipe's `rounded-sn` and the winner
// would fall through to stylesheet order
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['sn'] }],
      'font-weight': [{ font: ['bolder'] }],
      'text-color': ['text-reset']
    }
  }
})

export const cn = (...args) => twMerge(classNames(...args))
