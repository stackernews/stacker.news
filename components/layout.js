import Navigation from './nav'
import NavFooter from './nav/mobile/footer'
import NavStatic from './nav/static'
import Container from '@/components/ui/container'
import Footer from './footer'
import Seo, { SeoSearch } from './seo'
import Search from './search'
import styles from './layout.module.css'
import PullToRefresh from './pull-to-refresh'
import Price from './price'
import { PriceCarouselProvider } from './nav/price-carousel'
import { navLinkClasses } from '@/components/ui/nav'

export default function Layout ({
  sub, contain = true, twoColumns = false, footer = true, footerLinks = true,
  containClassName = '', seo = true, item, user, hideMobileNav = false, children
}) {
  return (
    <>
      {seo && <Seo sub={sub} item={item} user={user} />}
      <Navigation sub={sub} hideMobileNav={hideMobileNav} />
      {contain
        ? (
          <Container as={PullToRefresh} className={`${styles.contain} ${containClassName}`}>
            {twoColumns
              ? (
                <div className='grid grow grid-cols-1 gap-x-6 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]'>
                  <div className='flex min-w-0 flex-col'>
                    {children}
                  </div>
                  <aside className='hidden min-w-0 pt-2 md:block' aria-label='Bitcoin statistics'>
                    <PriceCarouselProvider>
                      <Price className={navLinkClasses({ className: 'w-full px-0 text-center font-mono text-sm' })} />
                    </PriceCarouselProvider>
                  </aside>
                </div>
                )
              : children}
          </Container>
          )
        : children}
      {footer && <Footer links={footerLinks} />}
      {!hideMobileNav && <NavFooter sub={sub} />}
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
        <main className={`${styles.content} ${styles.contain} py-4`}>
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
