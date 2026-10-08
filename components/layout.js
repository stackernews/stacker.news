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
import { navLinkClasses } from '@/components/ui/nav'
import { useRouter } from 'next/router'
import { navSubFromPath } from '@/lib/navigation'
import { useQuery } from '@apollo/client/react'
import { ACTIVE_SUBS } from '@/fragments/subs'
import useDesktopSidebar from './use-desktop-sidebar'

export default function Layout ({
  sub, contain = true, twoColumns = false, sidebar = null, footer = true, footerLinks = true,
  containClassName = '', seo = true, item, user, hideMobileNav = false, children
}) {
  const router = useRouter()
  const { data } = useQuery(ACTIVE_SUBS, { fetchPolicy: 'cache-only' })
  const navSub = navSubFromPath(router.asPath, sub, data?.activeSubs)
  const desktopSidebar = useDesktopSidebar()
  const widthClassName = twoColumns ? 'lg:max-w-[1024px]' : ''
  const hasSidebar = contain && twoColumns

  return (
    <>
      {seo && <Seo sub={sub} item={item} user={user} />}
      <Navigation sub={navSub} hideMobileNav={hideMobileNav} containerClassName={widthClassName} />
      {hasSidebar
        ? (
          <Container className={`${styles.columns} grid grow grid-cols-1 grid-rows-[1fr_auto] gap-x-6 md:grid-cols-[minmax(0,5fr)_minmax(0,2fr)] ${widthClassName}`}>
            <PullToRefresh className={`flex min-w-0 flex-col pb-8 ${containClassName}`}>
              {children}
            </PullToRefresh>
            <div className={`${styles.sidebarColumn} hidden min-w-0 md:col-start-2 md:row-start-1 md:block`}>
              {desktopSidebar && (
                <aside className={`${styles.sidebar} min-w-0 overflow-y-auto pt-2`} aria-label='sidebar'>
                  <Price className={navLinkClasses({ className: 'w-full px-0 text-center font-mono text-sm' })} />
                  {sidebar && <div className='mt-4'>{sidebar}</div>}
                </aside>
              )}
            </div>
            {footer && <Footer sub={navSub} links={footerLinks} className={`${styles.footer} col-span-full row-start-2`} containerClassName='max-lg:px-0' />}
          </Container>
          )
        : contain
          ? <Container as={PullToRefresh} className={`${styles.contain} ${containClassName}`}>{children}</Container>
          : children}
      {footer && !hasSidebar && <Footer sub={navSub} links={footerLinks} />}
      {!hideMobileNav && <NavFooter sub={navSub} />}
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
