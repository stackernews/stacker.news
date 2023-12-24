import lndService from 'ln-service';

// Destructure environment variables
const { LND_CERT, LND_MACAROON, LND_SOCKET } = process.env;

// Check if all required environment variables are present
if (!LND_CERT || !LND_MACAROON || !LND_SOCKET) {
  console.error('Make sure to set the required environment variables.');
  process.exit(1);
}

// Authenticate LND gRPC
const { lnd } = lndService.authenticatedLndGrpc({ cert: LND_CERT, macaroon: LND_MACAROON, socket: LND_SOCKET });

// Check the connection to LND GRPC
lndService.getWalletInfo({ lnd }, (err, result) => {
  if (err) {
    console.error('Error connecting to LND GRPC:', err);
    process.exit(1);
  }
  console.log('Successful connection to LND GRPC');
});

// Export the authenticated LND object
export default lnd;
