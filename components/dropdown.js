import { cn } from '@/lib/cn'
import styles from './dropdown.module.css'

// compact menu items for the editor toolbar dropdowns and the account picker
export const dropdownExtraItemClasses = ({ active, className } = {}) =>
  cn(
    styles.dropdownExtraItem,
    active && styles.active,
    'flex justify-between items-center gap-5 mb-0.5 p-1.5 whitespace-normal text-wrap',
    active ? 'text-base font-medium' : 'text-sm font-normal',
    className
  )
