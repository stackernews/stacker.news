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
        setToasts(toasts.filter(toast => toast.id !== id))
      }, toastConfig.delay)
    }
    setToasts([...toasts, toastConfig])
  }, [toasts])
  const removeToast = useCallback(id => {
    setToasts(toasts.filter(toast => toast.id !== id))
  }, [toasts])
  return (
    <ToastContext.Provider value={dispatchToast}>
      <ToastContainer position='top-center'>
        {toasts.map(toast => (
          <Toast key={toast.id} bg={toast.variant} show autohide={false} onClose={() => removeToast(toast.id)}>
            <ToastHeader closeButton>{toast.variant}</ToastHeader>
            <ToastBody>{toast.body}</ToastBody>
          </Toast>
        ))}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
