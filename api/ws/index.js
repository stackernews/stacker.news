import { WebSocketServer } from 'ws'
import { getSession } from 'next-auth/client'
import { Notification, NEW_NOTES } from './signal'

const WEBSOCKET_HEARTBEAT = 15000

const subscriptions = {}

const handleConnection = (ws, req, user) => {
  console.log('new websocket connection')

  subscriptions[user.id] = [
    Notification.subscribe({
      next: async (userId) => {
        if (userId === user.id) {
          ws.send(NEW_NOTES)
        }
      }
    })
  ]

  ws.on('close', () => {
    subscriptions[user.id].forEach(sub => sub.unsubscribe())
    console.log('closed websocket connection')
  })
}

function onError (err) {
  console.error('socket error', err)
}

export const initWss = (res) => {
  console.log('initializing websocket server')

  const server = res.socket.server
  // API docs: https://github.com/websockets/ws/blob/8.13.0/doc/ws.md
  const wss = new WebSocketServer({ noServer: true })
  res.socket.server.wss = wss

  server.on('upgrade', async (req, socket, head) => {
    if (req.url !== '/api/ws') return
    socket.on('error', onError)

    // TODO: allow websockets for guests but with limited subscriptions (e.g. no notifications)
    const session = await getSession({ req })
    if (!session.user) {
      // https://github.com/websockets/ws#client-authentication
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    socket.removeListener('error', onError)
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, session.user)
    })
  })

  wss.on('connection', function (ws, req, user) {
    ws.isAlive = true
    wss.clients.add(ws)
    ws.on('error', onError)
    ws.on('message', (data) => {
      const msg = data.toString()
      if (msg === 'pong') ws.isAlive = true
    })
    handleConnection(ws, req, user)
  })

  // https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false
      ws.send('ping')
    })
  }, WEBSOCKET_HEARTBEAT)

  wss.on('close', () => clearInterval(interval))
}
