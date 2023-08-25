import { useRouter } from 'next/router'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import styles from './toast.module.css'

const ToastContext = createContext(() => {})

export const ToastProvider = ({ children }) => {
  const router = useRouter()
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const dispatchToast = useCallback((toastConfig) => {
    toastConfig = {
      ...toastConfig,
      id: toastId.current++
    }
    setToasts(toasts => [...toasts, toastConfig])
  }, [])
  const toaster = useMemo(() => ({
    success: body => {
      dispatchToast({
        body,
        variant: 'success',
        autohide: true,
        delay: 5000
      })
    },
    danger: body => {
      dispatchToast({
        body,
        variant: 'danger',
        autohide: false
      })
    }
  }), [dispatchToast])
  const removeToast = useCallback(id => {
    setToasts(toasts => toasts.filter(toast => toast.id !== id))
  }, [])

  // Clear all toasts on page navigation
  useEffect(() => {
    const handleRouteChangeStart = () => setToasts([])
    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router])

  return (
    <ToastContext.Provider value={toaster}>
      <ToastContainer className='pb-3 pe-3' position='bottom-end' containerPosition='fixed'>
        {toasts.map(toast => (
          <Toast
            key={toast.id} bg={toast.variant} show autohide={toast.autohide}
            delay={toast.delay} className={styles.toast} onClose={() => removeToast(toast.id)}
          >
            <ToastBody>
              <div className='d-flex align-items-center'>
                <div className='flex-grow-1'>{toast.body}</div>
                <Button
                  variant={null}
                  className='p-0 ps-2'
                  aria-label='close'
                  onClick={() => removeToast(toast.id)}
                ><div className={styles.toastClose}>X</div>
                </Button>
              </div>
            </ToastBody>
          </Toast>
        ))}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
