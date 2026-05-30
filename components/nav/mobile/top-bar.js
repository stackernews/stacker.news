import { Nav, Navbar } from 'react-bootstrap'
import styles from '../../header.module.css'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import { useBranding } from '@/components/territory-branding'

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, dropNavKey }) {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const branding = useBranding()

  // on mobile, we don't show the top bar if it contains a nav select on custom domains
  // on mobile, the top bar with nav select is only shown on ~/, ~/new/*, ~/top/*
  // as a consquence, those three paths will not have a back button on custom domains
  // but, they continue to have a back button on the sticky bar when scrolling down
  if (branding && hasNavSelect({ path, pathname })) {
    return null
  }

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
