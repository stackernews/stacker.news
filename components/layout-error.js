import Footer from './footer'
import { HeaderStatic } from './header'
import styles from './layout-center.module.css'
import Search from './search'

export default function LayoutError ({ children, ...props }) {
  return (
    <div className={styles.page}>
      <HeaderStatic />
      <div className={`${styles.content} pt-5`}>
        {children}
      </div>
      <Footer />
      <Search />
    </div>
  )
}
