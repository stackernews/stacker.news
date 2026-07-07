import { cn } from '@/lib/cn'

// 932px keeps the content column at 900px like production (Bootstrap's lg
// container) plus 2rem for the px-4 gutter. The old 540/720 tablet tiers are
// gone, so 576 to 992px viewports gain a little content width.
// px-4 is 1rem, half of SN's $grid-gutter-width: 2rem override.
const BASE = 'w-full mx-auto px-4 max-w-[932px]'

/**
 * SN Container component, the app's centered content column
 * @param {string|Component} as - The element or component to render (defaults to div)
 * @param {string} className - The extra class name(s) for the container
 */
export default function Container ({ as: As = 'div', className, ...props }) {
  return <As className={cn(BASE, className)} {...props} />
}
