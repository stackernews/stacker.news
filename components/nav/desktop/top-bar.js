import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, Brand, NavPrice, RightCorner, SearchItem } from '../common'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'

export default function TopBar ({ prefix, sub, path, topNavKey, dropNavKey }) {
  const { navigator, commentCount } = useCommentsNavigatorContext()
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back />
        <Brand className='me-1' />
        <SearchItem prefix={prefix} className='me-0 ms-2 hidden md:flex' />
        <NavPrice className='ms-auto me-0 md:mx-auto hidden md:flex' />
        <CommentsNavigator navigator={navigator} commentCount={commentCount} />
        <RightCorner dropNavKey={dropNavKey} path={path} className='hidden md:flex' />
      </Nav>
    </Navbar>
  )
}
