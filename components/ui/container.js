import { cn } from '@/lib/cn'

// single native cap (max-w-4xl = 896px ≈ the old lg 900px tier), per the
// 2026-07-06 native-first revision — Bootstrap's 540/720 tablet tiers are gone,
// so 576–992px viewports gain a little content width.
// px-4 = 1rem = half of SN's $grid-gutter-width: 2rem override.
const BASE = 'w-full mx-auto px-4 max-w-4xl'

/**
 * SN Container component — the app's centered content column
 * @param {string|Component} as - The element or component to render (defaults to div)
 * @param {string} className - The extra class name(s) for the container
 */
export default function Container ({ as: As = 'div', className, ...props }) {
  return <As className={cn(BASE, className)} {...props} />
}
