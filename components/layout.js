import Header, { HeaderStatic } from './header'
import Container from 'react-bootstrap/Container'
import Footer from './footer'
import Seo, { SeoSearch } from './seo'
import Search from './search'
import styles from './layout.module.css'

export default function Layout ({
  sub, contain = true, footer = true, footerLinks = true,
  containClassName = '', seo = true, item, user, children
}) {
  return (
    <>
      {seo && <Seo sub={sub} item={item} user={user} />}
      <Header sub={sub} />
      {contain
        ? (
          <Container as='main' className={`px-sm-0 ${containClassName}`}>
            {children}
          </Container>
          )
        : children}
      {footer && <Footer links={footerLinks} />}
    </>
  )
}

export function SearchLayout ({ sub, children, ...props }) {
  return (
    <Layout sub={sub} seo={false} footer={false} {...props}>
      <SeoSearch sub={sub} />
      {children}
      <Search />
    </Layout>
  )
}

export function StaticLayout ({ children, footer = true, footerLinks, ...props }) {
  return (
    <div className={styles.page}>
      <HeaderStatic />
      <main className={`${styles.content} pt-5`}>
        {children}
      </main>
      {footer && <Footer links={footerLinks} />}
    </div>
  )
}

export function CenterLayout ({ children, ...props }) {
  return (
    <div className={styles.page}>
      <Layout contain={false} {...props}>
        <main className={styles.content}>
          {children}
        </main>
      </Layout>
    </div>
  )
}
