import { useEffect, useRef, useState } from 'react'
import styles from '@/components/header.module.css'
import { Nav } from '@/components/ui/nav'
import Container from '@/components/ui/container'
import TopBar from './desktop/top-bar'
import { MobilePriceRow } from './mobile/top-bar'
import { cn } from '@/lib/cn'

export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey, hideMobileNav = false }) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef()

  // show once the sentinel, and so the header, has scrolled above the viewport
  useEffect(() => {
    const observer = new window.IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <div data-sn-navigation className={cn(styles.sticky, visible && styles.visible)}>
        <Container className='hidden md:block'>
          <TopBar prefix={prefix} sub={sub} path={path} topNavKey={topNavKey} dropNavKey={dropNavKey} navbarClassName='py-0' />
        </Container>
        {!hideMobileNav && (
          <Container className='block md:hidden'>
            <nav className='flex items-center flex-nowrap py-0'>
              <Nav
                className={styles.navbarNav}
                activeKey={topNavKey}
              >
                <MobilePriceRow />
              </Nav>
            </nav>
          </Container>
        )}
      </div>
    </>
  )
}
