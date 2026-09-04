import { Toast } from '@base-ui/react/toast'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import styles from './toast.module.css'

const TOAST_DEFAULT_DELAY_MS = 5000

// one manager for the whole app: base ui keeps the merge state in its store,
// so callers don't own counters and don't rerender when the toast list changes
const toastManager = Toast.createToastManager()

function ToastItem ({ toast }) {
  // adding a toast with an existing id updates it in place and bumps updateKey,
  // so updateKey + 1 is how many times this toast was added since it last closed
  // for example: 3x 'zap pending' -> '(3) zap pending'
  // only merged toasts show it: updateKey also moves on update() and when a promise settles
  const count = toast.data?.merge ? toast.updateKey + 1 : 1
  // alternate animation names so consecutive updates restart the pulse
  const pulse = toast.updateKey
    ? (toast.updateKey % 2 === 0 ? styles.pulseEven : styles.pulseOdd)
    : null

  return (
    <Toast.Root toast={toast} className={cn(styles.root, pulse)}>
      <Toast.Content className={styles.content}>
        <div className={styles.info}>
          <Toast.Description className={styles.description}>
            {count > 1 && `(${count}) `}{toast.description}
          </Toast.Description>
        </div>
        <Toast.Close className={styles.close} aria-label='close'>X</Toast.Close>
      </Toast.Content>
      {toast.timeout > 0 && toast.data?.progressBar && (
        // remount on update so the progress bar restarts
        <div key={toast.updateKey} className={styles.countdown} style={{ '--toast-timeout': `${toast.timeout}ms` }} />
      )}
    </Toast.Root>
  )
}

function StackedToasts () {
  const { toasts, close } = Toast.useToastManager()
  const router = useRouter()

  // only clear toasts without persistOnNavigate on page navigation
  // since navigation should not interfere with being able to cancel an action
  useEffect(() => {
    const onRouteChangeStart = () => {
      for (const toast of toasts) {
        if (!toast.data?.persistOnNavigate) close(toast.id)
      }
    }
    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [router.events, close, toasts])

  return (
    <Toast.Portal>
      <Toast.Viewport className={styles.viewport}>
        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} />)}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

function addToast (type, body, options = {}) {
  const { id, tag, delay, autohide, persistOnNavigate, progressBar, ...rest } = options
  // toasts with the same key merge into one toast that counts up until it closes;
  // jsx bodies only merge if the caller passes a tag or id
  const key = tag ?? id ?? (typeof body === 'string' ? body : undefined)
  const toastId = toastManager.add({
    id: key,
    type,
    timeout: (type === 'danger' || autohide === false) ? 0 : (delay ?? TOAST_DEFAULT_DELAY_MS),
    priority: type === 'danger' ? 'high' : 'low',
    description: body,
    data: { persistOnNavigate, progressBar, merge: key !== undefined },
    ...rest
  })
  return () => toastManager.close(toastId)
}

// usable outside react too, e.g. from lib code and event handlers
export const toaster = {
  success: (body, options) => addToast('success', body, options),
  warning: (body, options) => addToast('warning', body, options),
  danger: (body, options) => addToast('danger', body, options),
  add: addToast,
  close: toastManager.close,
  update: toastManager.update,
  promise: toastManager.promise
}

export function useToast () {
  return toaster
}

export function ToastProvider ({ children }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      <StackedToasts />
      {children}
    </Toast.Provider>
  )
}
