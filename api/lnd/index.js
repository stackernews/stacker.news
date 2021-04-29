import lndService from 'ln-service'

if (!global.lnd) {
  const { lnd } = lndService.authenticatedLndGrpc({
    cert: process.env.LND_CERT,
    macaroon: process.env.LND_MACAROON,
    socket: process.env.LND_SOCKET
  })
  global.lnd = lnd
}

export default global.lnd
