import Navigation from './nav'
import NavFooter from './nav/mobile/footer'
import NavStatic from './nav/static'
import Container from 'react-bootstrap/Container'
import Footer from './footer'
import Seo, { SeoSearch } from './seo'
import Search from './search'
import styles from './layout.module.css'
import PullToRefresh from './pull-to-refresh'

export default function Layout ({
  sub, contain = true, footer = true, footerLinks = true,
  containClassName = '', seo = true, item, user, children
}) {
  return (
    <>
      {seo && <Seo sub={sub} item={item} user={user} />}
      <PullToRefresh android> {/* android prop if true disables its native PTR */}
        <Navigation sub={sub} />
        {contain
          ? (
            <Container as='main' className={`px-sm-0 ${styles.contain}`}>
              {children}
            </Container>
            )
          : children}
        {footer && <Footer links={footerLinks} />}
        <NavFooter sub={sub} />
      </PullToRefresh>
    </>
  )
}

export function SearchLayout ({ sub, children, ...props }) {
  return (
    <Layout sub={sub} seo={false} footer={false} {...props}>
      <SeoSearch sub={sub} />
      <Search sub={sub} />
      {children}
    </Layout>
  )
}

export function StaticLayout ({ children, footer = true, footerLinks = false, ...props }) {
  return (
    <>
      <NavStatic />
      <div className={styles.page}>
        <main className={`${styles.content} ${styles.contain} py-3`}>
          {children}
        </main>
      </div>
      {footer && <Footer links={footerLinks} />}
      <NavFooter />
    </>
  )
}

export function CenterLayout ({ children, ...props }) {
  return (
    <Layout contain={false} footer={false} {...props}>
      <div className={styles.page}>
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </Layout>
  )
}
