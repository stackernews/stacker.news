import useDarkMode from '@/components/dark-mode'

export function useWalletImage (wallet) {
  const [darkMode] = useDarkMode()

  const { title, image } = wallet.def.card

  if (!image) return null

  // wallet.png <-> wallet-dark.png
  const src = darkMode ? image?.src.replace(/\.([a-z]{3})$/, '-dark.$1') : image?.src

  return { ...image, alt: title, src }
}
