import Layout from './layout'
import styles from './layout-center.module.css'

export default function LayoutCenter ({ children }) {
  return (
    <div className={styles.page}>
      <Layout noContain>
        <div className={styles.content}>
          {children}
        </div>
      </Layout>
    </div>
  )
}
