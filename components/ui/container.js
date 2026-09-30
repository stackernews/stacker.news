import { cn } from '@/lib/cn'

const BASE = 'w-full mx-auto max-w-page px-safe-gutter'

export default function Container ({ as: As = 'div', className, ...props }) {
  return <As className={cn(BASE, className)} {...props} />
}
