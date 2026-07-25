import Nav from '@/components/ui/nav'
import styles from '../../header.module.css'
import { cn } from '@/lib/cn'
import { Back, Brand, NavPrice, RightCorner, SearchItem } from '../common'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'

// containers alone own responsive hiding: the header and the sticky bar both
// wrap this row in hidden md:block, so items carry no breakpoints
export default function TopBar ({ prefix, sub, path, topNavKey, dropNavKey, navbarClassName }) {
  const { navigator, commentCount } = useCommentsNavigatorContext()
  return (
    <nav className={cn('flex items-center flex-nowrap', navbarClassName)}>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back />
        <Brand className='me-1' />
        <SearchItem className='me-0 ms-2 flex' />
        <NavPrice />
        <CommentsNavigator navigator={navigator} commentCount={commentCount} />
        <RightCorner dropNavKey={dropNavKey} />
      </Nav>
    </nav>
  )
}
