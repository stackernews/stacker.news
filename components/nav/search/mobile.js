import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/router'
import { Drawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/cn'
import { navLinkClasses } from '@/components/ui/nav'
import SearchIcon from '@/svgs/search-line.svg'
import { PLACEHOLDER, ScopeChips, searchBarClasses } from './bar'
import Search from './search'
import { useSearchState } from './state'
import styles from './search.module.css'

export function MobileSearch ({ bar, className }) {
  const router = useRouter()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { scope, text, setScope } = useSearchState()

  useEffect(() => {
    const close = () => setOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  // the safe area is read when the popup mounts, while the keyboard is still down
  const popupRef = useCallback(popup => {
    if (!popup) return
    const safeAreaBottom = parseFloat(window.getComputedStyle(popup).getPropertyValue('--safe-area-bottom')) || 0
    popup.style.setProperty('--safe-area-bottom-seen', `${safeAreaBottom}px`)
  }, [])

  // renders the drawer and focuses the input within the tap, which is when ios
  // shows the keyboard. ios would also scroll the page to center the input
  const openNow = () => {
    flushSync(() => setOpen(true))
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      {bar
        ? (
          <div className={searchBarClasses({ className })} onClick={openNow}>
            <ScopeChips scope={scope} onRemove={type => setScope({ [type]: undefined })} />
            {/* base ui's own opening is skipped, the tap goes on to the bar */}
            <Drawer.Trigger
              aria-label='open search'
              className='grow basis-0 min-w-16 flex items-center gap-2 text-start'
              onClick={event => event.preventBaseUIHandler()}
            >
              {/* text-touch is the size of the input on phones */}
              <span className={cn('grow min-w-0 truncate text-touch', !text && 'text-muted')}>{text || PLACEHOLDER}</span>
              <SearchIcon width={16} height={16} className={cn(styles.navIcon, 'shrink-0')} aria-hidden />
            </Drawer.Trigger>
          </div>
          )
        : (
          // -me-2 lines the icon up with the edge of the row
          <Drawer.Trigger
            aria-label='open search'
            className={navLinkClasses({ className: cn('shrink-0 -me-2 pointer-coarse:hitbox-11', className) })}
            onClick={event => {
              event.preventBaseUIHandler()
              openNow()
            }}
          >
            <SearchIcon width={22} height={28} aria-hidden />
          </Drawer.Trigger>
          )}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Viewport className='fixed inset-0 z-(--sn-z-modal) flex'>
            {/* touch-none keeps a drag on the bar or the footer from moving the page
                behind, and swipe-ignore keeps a swipe down from closing the search */}
            <Drawer.Popup
              ref={popupRef}
              aria-label='search'
              // openNow focuses the input; base ui's own initial focus scrolls the page on ios
              initialFocus={false}
              data-base-ui-swipe-ignore
              className={cn(styles.drawer, 'w-full h-full flex flex-col touch-none pt-[env(safe-area-inset-top)]')}
            >
              <Search inline open={open} setOpen={setOpen} inputRef={inputRef} />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  )
}
