import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export const WebSocketContext = createContext(null)

const WEBSOCKET_TIMEOUT = 30000

export function WebSocketProvider ({ children }) {
  const [ws, setWs] = useState(null)

  useEffect(() => {
    if (ws) return

    // the endpoint needs to be hit at least once using HTTP
    // to initialize the websocket server
    fetch('http://localhost:3000/api/ws')

    const client = new WebSocket('ws://localhost:3000/api/ws')

    let timeout
    const heartbeat = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        // TODO reconnect
        client.close()
      }, WEBSOCKET_TIMEOUT)
    }

    client.addEventListener('error', (err) => {
      console.error('websocket error:', err)
    })
    client.addEventListener('open', () => {
      console.log('opened websocket connection')
      heartbeat()
    })
    client.addEventListener('message', (event) => {
      const msg = event.data
      console.log('received msg:', msg)
      if (msg === 'ping') {
        client.send('pong')
        heartbeat()
      }
    })
    client.addEventListener('close', (event) => {
      console.log('closed websocket connection:', event)
    })

    setWs(client)

    return () => client.close()
  }, [])

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  )
}

export default function useWebSocket (signal, signalCb) {
  const ws = useContext(WebSocketContext)

  const cb = useCallback((event) => {
    if (signal === event.data) signalCb()
  }, [])

  useEffect(() => {
    if (!ws) return
    ws.addEventListener('message', cb)
    return () => ws.removeEventListener('message', cb)
  }, [ws])
}
