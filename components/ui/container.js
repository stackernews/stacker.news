import { cn } from '@/lib/cn'

// 932px keeps the content column at 900px like production (Bootstrap's lg
// container) plus 2rem for the gutters. The old 540/720 tablet tiers are
// gone, so 576 to 992px viewports gain a little content width.
// The gutter is 1rem, half of SN's $grid-gutter-width: 2rem override, but
// grows to the iOS safe-area inset: our viewport-fit=cover meta extends
// pages under the dynamic island in landscape and nothing else insets them.
const BASE = 'w-full mx-auto max-w-[932px] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]'

/**
 * SN Container component, the app's centered content column
 * @param {string|Component} as - The element or component to render (defaults to div)
 * @param {string} className - The extra class name(s) for the container
 */
export default function Container ({ as: As = 'div', className, ...props }) {
  return <As className={cn(BASE, className)} {...props} />
}
