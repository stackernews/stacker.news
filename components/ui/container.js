import { cn } from '@/lib/cn'

// The 932px cap leaves a 900px content column inside the horizontal gutters.
// Gutters grow with iOS safe-area insets because viewport-fit=cover lets the
// page extend beneath the landscape display cutout.
const BASE = 'w-full mx-auto max-w-page px-safe-gutter'

export default function Container ({ as: As = 'div', className, ...props }) {
  return <As className={cn(BASE, className)} {...props} />
}
