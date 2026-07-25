import Nav from '@/components/ui/nav'
import { cn } from '@/lib/cn'
import { NavSelect, PostItem, Sorts, hasNavSelect } from '../common'
import styles from '../../header.module.css'
import { useBranding } from '../../territory-branding'

export default function SecondBar (props) {
  const { prefix, topNavKey, sub, navbarClassName } = props
  const branding = useBranding()
  if (!hasNavSelect(props)) return null
  return (
    <nav className={cn('flex items-center flex-nowrap', navbarClassName)}>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {!branding && <NavSelect sub={sub} size='medium' className='me-1' />}
        <div className={`${!branding ? 'ms-2 flex' : 'flex'}`}>
          <Sorts {...props} className={!branding ? 'ms-1' : undefined} />
        </div>
        <PostItem className='ms-auto me-0 flex' prefix={prefix} />
      </Nav>
    </nav>
  )
}
