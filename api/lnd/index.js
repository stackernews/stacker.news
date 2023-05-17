import lndService from 'ln-service'

const { lnd } = lndService.authenticatedLndGrpc({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_SOCKET
})

// Check LND GRPC connection
lndService.getWalletInfo({ lnd }, (err, result) => {
  if (err) {
    console.error('LND GRPC connection error')
    return
  }
  console.log('LND GRPC connection successful')
})

export default lnd
