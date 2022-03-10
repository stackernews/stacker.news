import { Button, Modal } from 'react-bootstrap'
import React, { useState, useCallback, useContext } from 'react'
import Link from 'next/link'

export const FundErrorContext = React.createContext({
  error: null,
  toggleError: () => {}
})

export function FundErrorProvider ({ children }) {
  const [error, setError] = useState(false)

  const contextValue = {
    error,
    setError: useCallback(e => setError(e), [])
  }

  return (
    <FundErrorContext.Provider value={contextValue}>
      {children}
    </FundErrorContext.Provider>
  )
}

export function useFundError () {
  const { error, setError } = useContext(FundErrorContext)
  return { error, setError }
}

export function FundErrorModal () {
  const { error, setError } = useFundError()
  return (
    <Modal
      show={error}
      onHide={() => setError(false)}
    >
      <div className='modal-close' onClick={() => setError(false)}>X</div>
      <Modal.Body>
        <p className='font-weight-bolder'>you have no sats</p>
        <div className='d-flex justify-content-end'>
          <Link href='/wallet?type=fund'>
            <Button variant='success' onClick={() => setError(false)}>fund</Button>
          </Link>
        </div>
      </Modal.Body>
    </Modal>
  )
}
