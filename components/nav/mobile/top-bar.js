import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()

  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back className='d-flex d-md-none' />
        {hasNavSelect({ path, pathname })
          ? <NavSelect sub={sub} className='w-100' />
          : (
            <>
              <NavPrice className='flex-shrink-1' />
              <CommentsNavigator navigator={navigator} commentCount={commentCount} className='px-2' />
              {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
            </>)}
      </Nav>
    </Navbar>
  )
}
