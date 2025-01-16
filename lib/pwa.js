export const checkPWA = (window) => {
  const androidPWA = window.matchMedia('(display-mode: standalone)').matches
  const iosPWA = window.navigator.standalone === true
  return (androidPWA || iosPWA)
}
