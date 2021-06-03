import Layout from './layout'
import styles from './layout-center.module.css'

export default function LayoutCenter ({ children, ...props }) {
  return (
    <div className={styles.page}>
      <Layout noContain {...props}>
        <div className={styles.content}>
          {children}
        </div>
      </Layout>
    </div>
  )
}
