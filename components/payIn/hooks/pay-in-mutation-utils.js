export function shouldBlockWalletPayInWhileRefreshing (hookOptions, callOptions, { walletsLoading, hasKnownSendWallet }) {
  if (!walletsLoading) return false

  const variables = {
    ...(hookOptions?.variables || {}),
    ...(callOptions?.variables || {})
  }
  const optedOutOfWallets = Object.prototype.hasOwnProperty.call(variables, 'sendProtocolId') && variables.sendProtocolId == null
  if (optedOutOfWallets) return false

  // While wallet data is refreshing we hide send protocols to avoid using stale config,
  // but wallet-backed pay-ins still need to wait if either the current wallet list or
  // the last known server state says a send wallet exists. Otherwise the server can
  // fall back to "no send wallet" semantics during initial load.
  return hasKnownSendWallet || variables.sendProtocolId != null
}
