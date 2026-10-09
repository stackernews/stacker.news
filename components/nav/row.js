import { Nav, Navbar } from '@/components/ui/nav'
import { Back, Brand, NavSelect, PostItem, RightCorner, SearchItem, Sorts } from './common'
import { useBranding } from '@/components/territory-branding'
import { CommentsNavigator } from '@/components/use-comments-navigator'
import { cn } from '@/lib/cn'
import styles from '../header.module.css'

export default function NavigationRow ({ prefix, sub, topNavKey, dropNavKey }) {
  const branding = useBranding()

  return (
    <Navbar>
      <Nav className={cn(styles.navbarNav, 'min-w-0 gap-1 md:gap-3 lg:gap-6')} activeKey={topNavKey}>
        <Back className='me-0 shrink-0 md:hidden' />
        <div className='max-md:contents md:flex md:min-w-0 md:flex-1 md:items-center md:gap-1 lg:gap-2'>
          <Brand className={cn('shrink-0', !branding && 'hidden md:block')} />
          <SearchItem className='shrink-0 px-1' />
          {!branding && <NavSelect sub={sub} className='min-w-0 flex-1 md:max-w-36 md:basis-36' />}
          <div className='flex shrink-0'>
            <Sorts prefix={prefix} linkClassName='px-1 md:px-1.5' />
          </div>
        </div>
        <div className='max-md:contents md:ms-auto md:flex md:min-w-0 md:items-center md:gap-2 lg:gap-3'>
          <CommentsNavigator />
          <PostItem prefix={prefix} className='hidden h-8 shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm md:inline-flex' />
          <div className='hidden min-w-0 md:block'>
            <RightCorner dropNavKey={dropNavKey} />
          </div>
        </div>
      </Nav>
    </Navbar>
  )
}
