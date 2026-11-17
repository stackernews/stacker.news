import fetch from 'cross-fetch'
import { Agent as HttpAgent } from 'node:http'
import { Agent as HttpsAgent } from 'node:https'

// Retire idle sockets before services close them; callers still own request deadlines.
const agents = { 'http:': new HttpAgent({ keepAlive: true, timeout: 4000 }), 'https:': new HttpsAgent({ keepAlive: true, timeout: 4000 }) }
const agent = ({ protocol }) => agents[protocol]

// Only for operator-configured services. User-supplied destinations must use the proxy.
export default function internalFetch (url, options) {
  return fetch(url, { ...options, agent })
}
