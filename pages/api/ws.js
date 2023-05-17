import { initWss } from '../../api/ws'

export default function handler (req, res) {
  if (!res.socket.server.wss) initWss(res)
  res.end()
}
