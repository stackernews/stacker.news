import React, { useCallback, useContext, useEffect, useState } from 'react'

export const PaymentTokenContext = React.createContext()

const fetchTokensFromLocalStorage = () => {
  const tokens = JSON.parse(window.localStorage.getItem('payment-tokens') || '[]')
  return tokens
}

export function PaymentTokenProvider ({ children }) {
  const [tokens, setTokens] = useState([])

  useEffect(() => {
    setTokens(fetchTokensFromLocalStorage())
  }, [])

  const addPaymentToken = useCallback((hash, hmac, amount) => {
    const token = hash + '|' + hmac
    const newTokens = [...tokens, { token, amount }]
    window.localStorage.setItem('payment-tokens', JSON.stringify(newTokens))
    setTokens(newTokens)
  }, [tokens])

  const removePaymentToken = useCallback((hash, hmac) => {
    const token = hash + '|' + hmac
    const newTokens = tokens.filter(({ token: t }) => t !== token)
    window.localStorage.setItem('payment-tokens', JSON.stringify(newTokens))
    setTokens(newTokens)
  }, [tokens])

  const clearPaymentTokens = useCallback(() => {
    setTokens([])
  }, [tokens])

  const balance = tokens.reduce((sum, { amount }) => sum + amount, 0)

  return (
    <PaymentTokenContext.Provider value={{ tokens, addPaymentToken, removePaymentToken, clearPaymentTokens, balance }}>
      {children}
    </PaymentTokenContext.Provider>
  )
}

export function usePaymentTokens () {
  return useContext(PaymentTokenContext)
}
