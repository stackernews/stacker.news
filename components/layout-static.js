import Footer from './footer'
import { HeaderStatic } from './header'
import styles from './layout-center.module.css'

export default function LayoutStatic ({ children, ...props }) {
  return (
    <div className={styles.page}>
      <HeaderStatic />
      <div className={`${styles.content} pt-5`}>
        {children}
      </div>
      <Footer />
    </div>
  )
}
