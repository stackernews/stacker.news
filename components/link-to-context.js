import classNames from 'classnames'
import styles from './link-to-context.module.css'
import Link from 'next/link'

export default function LinkToContext ({ children, onClick, href, className, ...props }) {
  return (
    <div className={classNames(className, styles.linkBoxParent, 'clickToContext')}>
      <Link
        className={styles.linkBox}
        onClick={onClick}
        href={href}
        {...props}
      />
      {children}
    </div>
  )
}
