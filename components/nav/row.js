import { useRouter } from 'next/router'
import { Nav, Navbar } from '@/components/ui/nav'
import { Back, Brand, PostItem, RightCorner, Sorts } from './common'
import SearchBar, { MobileSearch } from './search'
import { useBranding } from '@/components/territory-branding'
import { CommentsNavigator } from '@/components/use-comments-navigator'
import { isSearchPath } from '@/lib/search'
import { cn } from '@/lib/cn'
import styles from '../header.module.css'

export default function NavigationRow ({ prefix, topNavKey, dropNavKey }) {
  const router = useRouter()
  const branding = useBranding()
  const searchPage = isSearchPath(router.pathname)

  return (
    <Navbar>
      <Nav className={cn(styles.navbarNav, 'min-w-0 gap-1 md:gap-3 lg:gap-6')} activeKey={topNavKey}>
        {/* -ms-1 lines the arrow up with the edge of the content */}
        <Back className='-ms-1 me-0 flex shrink-0 md:hidden' />
        <div className='max-md:contents md:flex md:min-w-0 md:flex-1 md:items-center md:gap-1 lg:gap-2'>
          <Brand className={cn('shrink-0', !branding && 'hidden md:block')} />
          <div className='hidden min-w-0 md:block'>
            <SearchBar className='min-w-8' />
          </div>
          {/* on search pages phones show the search bar in place of the sorts */}
          <div className={cn('flex shrink-0 max-md:me-auto', searchPage && 'max-md:hidden')}>
            <Sorts prefix={prefix} linkClassName='px-1 md:px-1.5' />
          </div>
        </div>
        <div className='max-md:contents md:ms-auto md:flex md:min-w-0 md:items-center md:gap-2 lg:gap-3'>
          <CommentsNavigator />
          <MobileSearch bar={searchPage} className='md:hidden' />
          <PostItem prefix={prefix} className='hidden h-8 shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm md:inline-flex' />
          <div className='hidden min-w-0 md:block'>
            <RightCorner dropNavKey={dropNavKey} />
          </div>
        </div>
      </Nav>
    </Navbar>
  )
}
