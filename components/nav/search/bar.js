import cn from 'classnames'
import styles from './search.module.css'

// for onMouseDown on controls around the input: focus stays in the input, so
// the popup stays open
export const keepFocus = event => event.preventDefault()

// the look of the search bar, the same when it's an input and when it's the button on phones
export const searchBarClasses = ({ className } = {}) =>
  cn(styles.bar, 'grow min-w-0 flex items-center gap-2 px-2 rounded-md', className)
