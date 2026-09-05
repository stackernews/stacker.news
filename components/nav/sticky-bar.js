import { useEffect, useRef } from 'react'
import styles from '@/components/header.module.css'
import { Nav, Navbar } from '@/components/ui/nav'
import { MenuProvider } from '@/components/ui/menu'
import Container from '@/components/ui/container'
import TopBar from './desktop/top-bar'
import { MobilePriceRow } from './mobile/top-bar'
import { cn } from '@/lib/cn'

export default function StickyBar ({ topNavKey, dropNavKey, hideMobileNav = false, visible, onVisibilityChange }) {
  const sentinelRef = useRef()
  const barRef = useRef()

  // show the sticky bar once the header has scrolled out of view
  useEffect(() => {
    const observer = new window.IntersectionObserver(([entry]) => {
      onVisibilityChange(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [onVisibilityChange])

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <div ref={barRef} data-sn-navigation className={cn(styles.sticky, visible && styles.visible)}>
        {/* keep popups inside the bar so they follow its transform and visibility */}
        <MenuProvider container={barRef} visible={visible}>
          <Container className='hidden md:block'>
            <TopBar topNavKey={topNavKey} dropNavKey={dropNavKey} navbarClassName='py-0' />
          </Container>
          {!hideMobileNav && (
            <Container className='block md:hidden'>
              <Navbar className='py-0'>
                <Nav
                  className={styles.navbarNav}
                  activeKey={topNavKey}
                >
                  <MobilePriceRow />
                </Nav>
              </Navbar>
            </Container>
          )}
        </MenuProvider>
      </div>
    </>
  )
}
