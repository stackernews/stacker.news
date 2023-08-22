import React, { createContext, useCallback, useContext, useState } from 'react'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import ToastHeader from 'react-bootstrap/ToastHeader'
import { randInRange } from '../lib/rand'

const ToastContext = createContext(() => {})

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const dispatchToast = useCallback((toastConfig) => {
    const id = Array(10).fill(randInRange(0, 9)).join('')
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
  const removeToast = useCallback(id => {
    setToasts(toasts => toasts.filter(toast => toast.id !== id))
  }, [])
  const getHeaderText = useCallback((toastConfig) => {
    return toastConfig.header ?? {
      success: 'Success',
      warning: 'Warning',
      danger: 'Danger',
      info: 'Info'
    }[toastConfig.variant] ?? toastConfig.variants
  }, [])
  return (
    <ToastContext.Provider value={dispatchToast}>
      <ToastContainer position='bottom-end'>
        {toasts.map(toast => (
          <Toast key={toast.id} bg={toast.variant} show autohide={false} onClose={() => removeToast(toast.id)}>
            <ToastHeader closeButton closeLabel='close'><span className='flex-grow-1'>{getHeaderText(toast)}</span></ToastHeader>
            <ToastBody>{toast.body}</ToastBody>
          </Toast>
        ))}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
