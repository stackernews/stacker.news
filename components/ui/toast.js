import { Toast } from '@base-ui/react/toast'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { cn } from '@/lib/cn'
import { closeClasses } from './close'
import styles from './toast.module.css'

const TOAST_DEFAULT_TIMEOUT_MS = 5000

// one manager for the whole app: base ui keeps the merge state in its store,
// so callers don't own counters and don't rerender when the toast list changes
const toastManager = Toast.createToastManager()

function ToastItem ({ toast }) {
  // adding a toast with an existing id updates it in place and bumps updateKey,
  // so updateKey + 1 is how many times this toast was added since it last closed
  // for example: 3x 'zap pending' -> '(3) zap pending'
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
        <Toast.Close className={closeClasses({ className: 'leading-4 -mb-1 -me-1 flex items-center' })} aria-label='close'>X</Toast.Close>
      </Toast.Content>
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

function addToast (type, body, { tag, timeout, persistOnNavigate, onClose } = {}) {
  // toasts with the same key merge into one toast that counts up until it closes;
  // jsx bodies only merge if the caller passes a tag
  const key = tag ?? (typeof body === 'string' ? body : undefined)
  const toastId = toastManager.add({
    id: key,
    type,
    // Zero keeps a toast open until dismissed; danger toasts persist by default.
    timeout: timeout ?? (type === 'danger' ? 0 : TOAST_DEFAULT_TIMEOUT_MS),
    priority: type === 'danger' ? 'high' : 'low',
    description: body,
    data: { persistOnNavigate, merge: key !== undefined },
    onClose
  })
  return () => toastManager.close(toastId)
}

// usable outside react too, e.g. from lib code and event handlers
export const toaster = {
  success: (body, options) => addToast('success', body, options),
  warning: (body, options) => addToast('warning', body, options),
  danger: (body, options) => addToast('danger', body, options)
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
