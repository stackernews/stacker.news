import { Nav } from '@/components/ui/nav'
import { cn } from '@/lib/cn'
import { NavWalletSummary, Sorts, hasNavSelect, SignUpButton } from '../common'
import styles from '../../header.module.css'
import { useMe } from '@/components/me'

export default function SecondBar (props) {
  const { me } = useMe()
  const { topNavKey, navbarClassName } = props
  if (!hasNavSelect(props)) return null
  return (
    <nav className={cn('flex items-center flex-nowrap', navbarClassName)}>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Sorts {...props} />
        {me ? <NavWalletSummary className='ms-auto px-2' /> : <SignUpButton className='ms-auto' width='fit-content' />}
      </Nav>
    </nav>
  )
}
