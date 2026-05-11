const protocolLoaders = {
  NWC: () => import('./nwc'),
  LNBITS: () => import('./lnbits'),
  PHOENIXD: () => import('./phoenixd'),
  BLINK: () => import('./blink'),
  WEBLN: () => import('./webln'),
  LNC: () => import('./lnc'),
  CLN_REST: () => import('./clnRest'),
  CLINK: () => import('./clink')
}

export const protocolNames = Object.keys(protocolLoaders)

export async function loadProtocol (name) {
  const load = protocolLoaders[name]
  if (!load) {
    throw new Error(`unknown wallet protocol: ${name}`)
  }
  return await load()
}
