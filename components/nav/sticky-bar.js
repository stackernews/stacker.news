import { useEffect, useRef, useState } from 'react'
import styles from '@/components/header.module.css'
import Nav from '@/components/ui/nav'
import Container from '@/components/ui/container'
import TopBar from './desktop/top-bar'
import { MobilePriceRow } from './mobile/top-bar'
import { cn } from '@/lib/cn'

// The sticky shell reuses the desktop top bar and mobile price row.
export default function StickyBar ({ prefix, sub, path, topNavKey, dropNavKey, hideMobileNav = false }) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef()

  // The zero-height sentinel makes visibility follow whether the header has
  // scrolled above the viewport.
  useEffect(() => {
    const observer = new window.IntersectionObserver(([entry]) => {
      // A negative top distinguishes scrolling past the sentinel from leaving
      // the viewport in another direction.
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
