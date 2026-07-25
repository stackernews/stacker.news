import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/cn'
import styles from './drawer.module.css'

/**
 * SN Drawer, Base UI Drawer (a Dialog underneath, plus gestures) at Offcanvas
 * ergonomics for the two consumers: the mobile nav drawer (end) and the
 * wallets bottom sheet (bottom). modal defaults on, so scroll lock and the
 * focus trap match the old behavior. Swipe to dismiss is native (right or
 * down); exit motion rides the primitive's deferred unmount, so a CSS
 * transition is all the machinery there is.
 * @param {boolean} show - whether the drawer is open (controlled)
 * @param {function} onHide - called on any close reason (Escape, backdrop, swipe, X)
 * @param {string} placement - 'end' (right panel) or 'bottom' (sheet)
 */
function Drawer ({ show, onHide, placement = 'end', className, children }) {
  return (
    <BaseDrawer.Root
      open={show}
      swipeDirection={placement === 'end' ? 'right' : 'down'}
      onOpenChange={open => { if (!open) onHide?.() }}
    >
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className={styles.backdrop} />
        <BaseDrawer.Viewport className={cn(styles.viewport, placement === 'end' ? 'justify-end' : 'items-end')}>
          <BaseDrawer.Popup
            className={cn(
              styles.popup,
              styles[placement],
              placement === 'end' ? 'h-full w-62.5' : 'w-full max-h-[85svh] rounded-t-[18px]',
              'flex flex-col overflow-y-auto',
              className
            )}
          >
            {children}
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  )
}

/* the X is baked in, both consumers passed closeButton */
function Header ({ children }) {
  return (
    <div className='flex items-center p-8'>
      {children}
      <BaseDrawer.Close
        nativeButton={false}
        render={<div role='button' tabIndex={0} aria-label='Close' className={cn(styles.close, 'ms-auto cursor-pointer opacity-50')} />}
      />
    </div>
  )
}

function Title ({ children }) {
  // text-lg (18px) is nearest native to the old 18.6px offcanvas title;
  // font-medium carries Bootstrap's $headings-font-weight: 500
  return <BaseDrawer.Title className='text-lg font-medium mb-0'>{children}</BaseDrawer.Title>
}

/* Content, not a bare div: it is the separator that keeps clicks and text
   selection clean under the swipe layer. p-8 matches the old 32px; the nav
   drawer passes pb-0, the sheet px-4 */
function Body ({ className, children }) {
  return <BaseDrawer.Content className={cn('p-8 grow', className)}>{children}</BaseDrawer.Content>
}

export default Object.assign(Drawer, { Header, Title, Body })
