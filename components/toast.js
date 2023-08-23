import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import styles from './toast.module.css'

const ToastContext = createContext(() => {})

let toastId = 0

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const dispatchToast = useCallback((toastConfig) => {
    const id = toastId++
    toastConfig = {
      ...toastConfig,
      id
    }
    if (toastConfig.autohide && toastConfig.delay > 0) {
      setTimeout(() => {
        setToasts(toasts => toasts.filter(toast => toast.id !== id))
      }, toastConfig.delay)
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
  return (
    <ToastContext.Provider value={toaster}>
      <ToastContainer position='bottom-end' containerPosition='fixed'>
        {toasts.map(toast => (
          <Toast key={toast.id} bg={toast.variant} show autohide={false} className={styles.toast}>
            <ToastBody>
              <div className='d-flex'>
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
