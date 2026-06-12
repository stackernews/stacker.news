export function balanceSourceTitle (source) {
  return source ? `balance from ${source}` : undefined
}

export function balanceErrorDisplay (error) {
  if (error === 'busy') {
    return {
      message: 'wallet is busy',
      secondary: 'balance will refresh after the send finishes'
    }
  }

  if (error === 'permanent') {
    return {
      message: 'balance access denied',
      secondary: "check this wallet's permissions on the configure page"
    }
  }

  return {
    message: 'balance temporarily unavailable',
    secondary: 'check your connection and try again'
  }
}

export function balanceLoadingText () {
  try {
    const group = new Intl.NumberFormat(undefined)
      .formatToParts(1000)
      .find(part => part.type === 'group')?.value ?? ','
    return ['L', 'OAD', 'ING'].join(group)
  } catch {
    return 'L,OAD,ING'
  }
}
