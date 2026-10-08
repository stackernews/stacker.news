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
    <header data-sn-navigation className={cn(styles.header, 'sticky top-0 z-sticky shrink-0', hideMobileNav && 'hidden md:block')}>
      <Container className={containerClassName}>
        <NavigationRow prefix={prefix} topNavKey={topNavKey} dropNavKey={dropNavKey} sub={sub} />
      </Container>
    </header>
  )
}
