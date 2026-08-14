import { Toast } from '@base-ui/react/toast'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import styles from './toast.module.css'

export const TOAST_DEFAULT_DELAY_MS = 5000

function ToastItem ({ toast }) {
  // Alternate animation names so consecutive updates restart the pulse.
  const pulse = toast.updateKey
    ? (toast.updateKey % 2 === 0 ? styles.pulseEven : styles.pulseOdd)
    : null

  return (
    <Toast.Root toast={toast} className={cn(styles.root, pulse)}>
      <Toast.Content className={styles.content}>
        <div className={styles.info}>
          <Toast.Description className={styles.description} />
        </div>
        <Toast.Close className={styles.close} aria-label='close'>X</Toast.Close>
      </Toast.Content>
      {toast.timeout > 0 && toast.data?.progressBar && (
        // A refreshed timer remounts and restarts the progress bar.
        <div key={toast.updateKey} className={styles.countdown} style={{ '--toast-timeout': `${toast.timeout}ms` }} />
      )}
    </Toast.Root>
  )
}

function StackedToasts () {
  const { toasts, close } = Toast.useToastManager()
  const router = useRouter()

  // Route changes dismiss ordinary toasts but preserve ongoing actions.
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

export function useToast () {
  const { add, close, update, promise } = Toast.useToastManager()
  // Repeated messages share one toast and display their count.
  const counts = useRef(new Map())

  const addToast = useCallback((type, body, options = {}) => {
    const { id, tag, delay, autohide, onRemove, persistOnNavigate, progressBar, ...rest } = options
    // Explicit keys and string bodies can be deduplicated. JSX bodies remain
    // separate unless the caller supplies a key.
    const key = tag ?? id ?? (typeof body === 'string' ? body : undefined)
    let amount = 1
    if (key !== undefined) {
      amount = (counts.current.get(key) ?? 0) + 1
      counts.current.set(key, amount)
    }
    const toastId = add({
      id: key,
      type,
      timeout: (type === 'danger' || autohide === false) ? 0 : (delay ?? TOAST_DEFAULT_DELAY_MS),
      // Danger messages announce assertively.
      priority: type === 'danger' ? 'high' : 'low',
      description: amount > 1 ? `(${amount}) ${body}` : body,
      data: { persistOnNavigate, progressBar },
      ...rest,
      onRemove: () => {
        if (key !== undefined) counts.current.delete(key)
        onRemove?.()
      }
    })
    return () => close(toastId)
  }, [add, close])

  return useMemo(() => ({
    success: (body, options) => addToast('success', body, options),
    warning: (body, options) => addToast('warning', body, options),
    danger: (body, options) => addToast('danger', body, options),
    add: addToast,
    close,
    update,
    promise
  }), [addToast, close, update, promise])
}

export function ToastProvider ({ children }) {
  return (
    <Toast.Provider>
      <StackedToasts />
      {children}
    </Toast.Provider>
  )
}
