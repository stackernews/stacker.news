import { Nav } from '@/components/ui/nav'
import styles from '../../header.module.css'
import { cn } from '@/lib/cn'
import { Back, NavPrice, NavSelect, NavWalletSummary, SignUpButton, hasNavSelect } from '../common'
import { useMe } from '@/components/me'
import { useCommentsNavigatorContext, CommentsNavigator } from '@/components/use-comments-navigator'
import { useBranding } from '@/components/territory-branding'

// The header and sticky bar share the same mobile price row.
export function MobilePriceRow () {
  const { me } = useMe()
  const { navigator, commentCount } = useCommentsNavigatorContext()
  return (
    <>
      <Back />
      <NavPrice className='shrink' />
      <CommentsNavigator navigator={navigator} commentCount={commentCount} className='px-2' />
      {me ? <NavWalletSummary /> : <SignUpButton width='fit-content' />}
    </>
  )
}

export default function TopBar ({ prefix, sub, path, pathname, topNavKey, navbarClassName }) {
  const branding = useBranding()

  // on mobile, we don't show the top bar if it contains a nav select on custom domains
  // on mobile, the top bar with nav select is only shown on ~/, ~/new/*, ~/top/*
  // as a consquence, those three paths will not have a back button on custom domains
  // but, they continue to have a back button on the sticky bar when scrolling down
  if (branding && hasNavSelect({ path, pathname })) {
    return null
  }

  return (
    <nav className={cn('flex items-center flex-nowrap', navbarClassName)}>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        {hasNavSelect({ path, pathname })
          ? (
            <>
              <Back />
              <NavSelect sub={sub} className='w-full' />
            </>
            )
          : <MobilePriceRow />}
      </Nav>
    </nav>
  )
}
