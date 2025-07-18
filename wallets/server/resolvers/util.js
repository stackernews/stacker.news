export function mapWalletResolveTypes (wallet) {
  const resolveTypeOfProtocolConfig = ({ name, send }) => {
    switch (name) {
      case 'NWC':
        return send ? 'WalletSendNWC' : 'WalletRecvNWC'
      case 'LNBITS':
        return send ? 'WalletSendLNbits' : 'WalletRecvLNbits'
      case 'PHOENIXD':
        return send ? 'WalletSendPhoenixd' : 'WalletRecvPhoenixd'
      case 'BLINK':
        return send ? 'WalletSendBlink' : 'WalletRecvBlink'
      case 'WEBLN':
        return 'WalletSendWebLN'
      case 'LN_ADDR':
        return 'WalletRecvLightningAddress'
      case 'LNC':
        return 'WalletSendLNC'
      case 'CLN_REST':
        return 'WalletRecvCLNRest'
      case 'LND_GRPC':
        return 'WalletRecvLNDGRPC'
      default:
        return null
    }
  }

  return {
    ...wallet,
    protocols: wallet.protocols.map(({ config, ...p }) => {
      return {
        ...p,
        config: {
          ...config,
          __resolveType: resolveTypeOfProtocolConfig(p)
        }
      }
    }),
    __resolveType: 'Wallet'
  }
}
