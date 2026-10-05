import cn from 'classnames'
import styles from './search.module.css'

// the look of the search bar, the same when it's an input and when it's the button on phones
export const searchBarClasses = ({ className } = {}) =>
  cn(styles.bar, 'grow min-w-0 flex items-center gap-2 px-2 rounded-md', className)
