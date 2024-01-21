import { createContext, useContext } from 'react'
import { LNbitsProvider, useLNbits } from './lnbits'
import { NWCProvider, useNWC } from './nwc'

const WebLNContext = createContext({})

function RawWebLNProvider ({ children }) {
  const lnbits = useLNbits()
  const nwc = useNWC()

  // TODO: switch between providers based on user preference
  const provider = nwc

  return (
    <WebLNContext.Provider value={provider}>
      {children}
    </WebLNContext.Provider>
  )
}

export function WebLNProvider ({ children }) {
  return (
    <LNbitsProvider>
      <NWCProvider>
        <RawWebLNProvider>
          {children}
        </RawWebLNProvider>
      </NWCProvider>
    </LNbitsProvider>
  )
}

export function useWebLN () {
  return useContext(WebLNContext)
}
