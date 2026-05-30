import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import { useBranding } from '@/components/territory-branding'

function NavContent ({ sub, path, pathname }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const branding = useBranding()

  if (!hasNavSelect({ path, pathname })) {
    return (
      <>
        <NavPrice className='flex-shrink-1' />
        <CommentsNavigator navigator={navigator} commentCount={commentCount} className='px-2' />
        {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
      </>
    )
  }

  if (branding) {
    return (
      <>
        <NavPrice className='flex-shrink-1' />
        {me && <NavWalletSummary />}
      </>
    )
  }

  return <NavSelect sub={sub} className='w-100' />
}

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  return (
    <Navbar>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <Back className='d-flex d-md-none' />
        <NavContent sub={sub} path={path} pathname={pathname} />
      </Nav>
    </Navbar>
  )
}
