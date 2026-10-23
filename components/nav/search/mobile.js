import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/router'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/cn'
import SearchIcon from '@/svgs/search-line.svg'
import { PLACEHOLDER, ScopeChips, searchBarClasses } from './bar'
import Search from './search'
import { useSearchState } from './state'
import styles from './search.module.css'

// a callback ref that sets --sn-keyboard-inset on the element to how much of its
// bottom the keyboard and the browser's toolbar cover
function useKeyboardInset (inputRef) {
  return useCallback(element => {
    const viewport = window.visualViewport
    if (!element || !viewport) return

    let inset
    const set = next => {
      if (next === inset) return
      inset = next
      element.style.setProperty('--sn-keyboard-inset', `${next}px`)
    }

    // the least covered is without the keyboard, and what's covered while the
    // input has focus is with it
    let withoutKeyboard = Infinity
    let withKeyboard
    const measure = () => {
      const covered = Math.max(0, Math.round(element.getBoundingClientRect().bottom - viewport.offsetTop - viewport.height))
      withoutKeyboard = Math.min(withoutKeyboard, covered)
      if (document.activeElement === inputRef.current) withKeyboard = covered
      set(covered)
    }

    // when the input gains or loses focus, the size last seen with or without
    // the keyboard is set right away. ios resizes the viewport only once the
    // keyboard stops moving
    const onFocusIn = event => {
      if (event.target === inputRef.current && withKeyboard !== undefined) set(withKeyboard)
    }
    const onFocusOut = event => {
      if (event.target === inputRef.current) set(withoutKeyboard)
    }

    const controller = new AbortController()
    const { signal } = controller
    measure()
    viewport.addEventListener('resize', measure, { signal })
    viewport.addEventListener('scroll', measure, { signal })
    element.addEventListener('focusin', onFocusIn, { signal })
    element.addEventListener('focusout', onFocusOut, { signal })
    return () => controller.abort()
  }, [inputRef])
}

// phones get a button shaped like the bar that opens the search full screen
export function MobileSearchBar () {
  const router = useRouter()
  const inputRef = useRef(null)
  const insetRef = useKeyboardInset(inputRef)
  const [open, setOpen] = useState(false)
  const { scope, text, setScope } = useSearchState()

  // a page change, like going back, closes the search
  useEffect(() => {
    const close = () => setOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  // renders the dialog and focuses the input within the tap, which is when ios
  // shows the keyboard
  const openNow = () => {
    flushSync(() => setOpen(true))
    inputRef.current?.focus()
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* a tap anywhere on the bar opens the search */}
      <div className={searchBarClasses()} onClick={openNow}>
        <ScopeChips scope={scope} onRemove={type => setScope({ [type]: undefined })} />
        {/* base ui's own opening is skipped, the tap goes on to the bar */}
        <Dialog.Trigger
          aria-label='open search'
          className='grow basis-0 min-w-16 flex items-center gap-2 text-start'
          onClick={event => event.preventBaseUIHandler()}
        >
          <span className={cn('grow min-w-0 truncate text-base', !text && 'text-muted')}>{text || PLACEHOLDER}</span>
          <SearchIcon width={16} height={16} className={cn(styles.submit, 'shrink-0')} aria-hidden />
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        {/* touch-none: dragging the bar or the footer doesn't move the page behind.
            the bottom padding keeps the results above the keyboard and the home indicator */}
        <Dialog.Popup
          ref={insetRef}
          aria-label='search'
          initialFocus={inputRef}
          className={cn(
            styles.dialog,
            'fixed inset-0 z-(--sn-z-modal) flex flex-col touch-none',
            'pt-[env(safe-area-inset-top)] pb-[max(var(--sn-keyboard-inset,0px),env(safe-area-inset-bottom))]'
          )}
        >
          <Search inline open={open} setOpen={setOpen} inputRef={inputRef} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
