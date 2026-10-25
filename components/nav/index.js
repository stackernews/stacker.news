import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Container from '@/components/ui/container'
import NavigationRow from './row'
import { usePrefix, useNavKeys } from '../territory-domains'
import { cn } from '@/lib/cn'
import styles from '../header.module.css'

export default function Navigation ({ sub, hideMobileNav = false, containerClassName }) {
  const router = useRouter()
  const prefix = usePrefix(sub)
  const { topNavKey, dropNavKey } = useNavKeys(router.asPath)

  return (
    <StickyHeader className={hideMobileNav && 'hidden md:block'}>
      <Container className={containerClassName}>
        <NavigationRow prefix={prefix} topNavKey={topNavKey} dropNavKey={dropNavKey} sub={sub} />
      </Container>
    </StickyHeader>
  )
}

// shows the separator once the page scrolls past the header's top
function StickyHeader ({ className, children }) {
  const sentinelRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const observer = new window.IntersectionObserver(entries => setScrolled(!entries.at(-1).isIntersecting))
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden className='-mb-px h-px' />
      <header data-sn-navigation data-scrolled={scrolled ? '' : undefined} className={cn(styles.header, 'sticky top-0 z-sticky shrink-0', className)}>
        {children}
      </header>
    </>
  )
}
