import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Container from '@/components/ui/container'
import NavigationRow from './row'
import { usePrefix, useNavKeys } from '../territory-domains'
import { subNamesFromSlug } from '@/lib/subs'
import { cn } from '@/lib/cn'
import styles from '../header.module.css'

export default function Navigation ({ sub, hideMobileNav = false }) {
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()
  const path = router.asPath.split('?')[0]
  const routeSubs = subNamesFromSlug(router.query.sub)
  const selectedSub = sub || (routeSubs.length === 1 ? routeSubs[0] : undefined)
  const prefix = usePrefix(selectedSub)
  const { topNavKey, dropNavKey } = useNavKeys(path, selectedSub)
  const props = {
    prefix,
    topNavKey,
    dropNavKey,
    sub: selectedSub
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header data-sn-navigation data-scrolled={scrolled || undefined} className={cn(styles.header, 'sticky top-0 z-sticky shrink-0', hideMobileNav && 'hidden md:block')}>
      <Container>
        <div className='hidden md:block'>
          <NavigationRow {...props} />
        </div>
        {!hideMobileNav && (
          <div className='block md:hidden'>
            <NavigationRow {...props} mobile />
          </div>
        )}
      </Container>
    </header>
  )
}
