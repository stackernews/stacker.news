import { Nav, Navbar } from '@/components/ui/nav'
import { Brand, NavSelect, PostItem, RightCorner, SearchItem, Sorts } from './common'
import { useBranding } from '@/components/territory-branding'
import { CommentsNavigator, useCommentsNavigatorContext } from '@/components/use-comments-navigator'
import { cn } from '@/lib/cn'
import styles from '../header.module.css'

function FeedLinks ({ prefix, sub, mobile }) {
  const branding = useBranding()

  return (
    <>
      {(!mobile || branding) && <Brand className='shrink-0' />}
      <SearchItem className='shrink-0 px-1' />
      {!branding && (
        <NavSelect
          sub={sub}
          className={mobile ? 'min-w-16 flex-1' : 'min-w-24 max-w-36 flex-1 basis-36'}
        />
      )}
      <div className={cn('flex shrink-0', mobile && 'ms-1 last:ms-2')}>
        <Sorts prefix={prefix} linkClassName='px-1 md:px-1.5' />
      </div>
    </>
  )
}

export default function NavigationRow ({ prefix, sub, topNavKey, dropNavKey, mobile = false }) {
  const { navigator, commentCount } = useCommentsNavigatorContext()
  const comments = <CommentsNavigator navigator={navigator} commentCount={commentCount} className='px-1' />

  return (
    <Navbar>
      <Nav className={cn(styles.navbarNav, 'min-w-0 gap-2 md:gap-6')} activeKey={topNavKey}>
        {mobile
          ? (
            <>
              <FeedLinks prefix={prefix} sub={sub} mobile />
              {comments}
            </>
            )
          : (
            <>
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <FeedLinks prefix={prefix} sub={sub} />
              </div>
              <div className='ms-auto flex min-w-0 items-center gap-3'>
                {comments}
                <PostItem prefix={prefix} className='inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm' />
                <RightCorner dropNavKey={dropNavKey} />
              </div>
            </>
            )}
      </Nav>
    </Navbar>
  )
}
