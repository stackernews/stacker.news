import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/cn'
import styles from './drawer.module.css'

export function Drawer ({ show, onHide, placement = 'end', className, children }) {
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
              placement === 'end' ? 'h-full w-64' : 'w-full rounded-t-2xl',
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

export function DrawerHeader ({ children }) {
  return (
    <div className='flex items-center p-8'>
      {children}
      <BaseDrawer.Close
        nativeButton={false}
        render={<div role='button' tabIndex={0} aria-label='close' className={cn(styles.close, 'ms-auto opacity-50')} />}
      />
    </div>
  )
}

export function DrawerTitle ({ children }) {
  return <BaseDrawer.Title className='text-lg font-medium mb-0'>{children}</BaseDrawer.Title>
}

// Content keeps clicks and text selection from starting a swipe
export function DrawerBody ({ className, children }) {
  return <BaseDrawer.Content className={cn('p-8 grow', className)}>{children}</BaseDrawer.Content>
}
