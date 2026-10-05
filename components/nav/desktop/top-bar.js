import { Nav, Navbar } from '@/components/ui/nav'
import styles from '../../header.module.css'
import { Back, Brand, NavPrice, RightCorner } from '../common'
import SearchBar from '../search'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'

// the header and sticky bar wrap this in hidden md:block, so items need no breakpoints
export function DesktopRow ({ dropNavKey }) {
  const { navigator, commentCount } = useCommentsNavigatorContext()
  return (
    <>
      <Back />
      <Brand className='me-1' />
      <SearchBar className='ms-3 min-w-8' />
      <NavPrice />
      <CommentsNavigator navigator={navigator} commentCount={commentCount} />
      {/* pre-nav-changes: temporarily force the right corner to the end of the row */}
      <RightCorner className='flex w-full justify-end' dropNavKey={dropNavKey} />
    </>
  )
}

export default function TopBar ({ topNavKey, dropNavKey }) {
  return (
    <Navbar className='not-last:pb-0'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <DesktopRow dropNavKey={dropNavKey} />
      </Nav>
    </Navbar>
  )
}
