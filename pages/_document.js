import Document, { Html, Head, Main, NextScript } from 'next/document'
import Script from 'next/script'

class MyDocument extends Document {
  render () {
    return (
      <Html lang='en'>
        <Head>
          <link rel='manifest' href='/api/site.webmanifest' />
          <link rel='preload' href={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.woff2`} as='font' type='font/woff2' crossOrigin='' />
          <link rel='preload' href={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.woff`} as='font' type='font/woff' crossOrigin='' />
          <link rel='preload' href={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.ttf`} as='font' type='font/ttf' crossOrigin='' />
          <style
            dangerouslySetInnerHTML={{
              __html:
            ` @font-face {
                font-family: 'lightning';
                src: url(${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.ttf) format('truetype'),
                     url(${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.woff) format('woff'),
                     url(${process.env.NEXT_PUBLIC_ASSET_PREFIX}/Lightningvolt-xoqm.woff2) format('woff2');
                font-display: swap;
              }`
            }}
          />
          <meta name='apple-mobile-web-app-capable' content='yes' />
          <meta name='theme-color' content='#121214' />
          <link rel='apple-touch-icon' href='/icons/icon_x192.png' />
          <Script id='dark-mode-js' strategy='beforeInteractive'>
            {`const handleThemeChange = (dark) => {
                const root = window.document.documentElement
                root.setAttribute('data-bs-theme', dark ? 'dark' : 'light')
              }

              const STORAGE_KEY = 'darkMode'
              const PREFER_DARK_QUERY = '(prefers-color-scheme: dark)'

              const getTheme = () => {
                const mql = window.matchMedia(PREFER_DARK_QUERY)
                const supportsColorSchemeQuery = mql.media === PREFER_DARK_QUERY
                let localStorageTheme = null
                try {
                  localStorageTheme = window.localStorage.getItem(STORAGE_KEY)
                } catch (err) {}
                const localStorageExists = localStorageTheme !== null
                if (localStorageExists) {
                  localStorageTheme = JSON.parse(localStorageTheme)
                }

                if (localStorageExists) {
                  return { user: true, dark: localStorageTheme }
                } else if (supportsColorSchemeQuery) {
                  return { user: false, dark: mql.matches }
                }
              }

              if (typeof window !== 'undefined') {
                (function () {
                  const { dark } = getTheme()
                  handleThemeChange(dark)
                })()
              }`}
          </Script>
          {/* light-theme splash screen links */}
          <link rel='apple-touch-startup-image' media='screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_14_Pro_Max_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_14_Pro_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/iPhone_11__iPhone_XR_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)' href='/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/12.9__iPad_Pro_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/11__iPad_Pro__10.5__iPad_Pro_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/10.9__iPad_Air_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/10.5__iPad_Air_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/10.2__iPad_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)' href='/splash/8.3__iPad_Mini_landscape.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_14_Pro_Max_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_14_Pro_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/iPhone_11__iPhone_XR_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' href='/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/12.9__iPad_Pro_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/11__iPad_Pro__10.5__iPad_Pro_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/10.9__iPad_Air_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/10.5__iPad_Air_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/10.2__iPad_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' href='/splash/8.3__iPad_Mini_portrait.png' />
          {/* dark-theme splash screen links */}
          <link rel='apple-touch-startup-image' media='screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Pro_Max_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Pro_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_11_Pro_Max__iPhone_XS_Max_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_11__iPhone_XR_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/12.9__iPad_Pro_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/11__iPad_Pro__10.5__iPad_Pro_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/10.9__iPad_Air_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/10.5__iPad_Air_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/10.2__iPad_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape) and (prefers-color-scheme: dark)' href='/splash/8.3__iPad_Mini_landscape_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Pro_Max_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Pro_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_11_Pro_Max__iPhone_XS_Max_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_11__iPhone_XR_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/12.9__iPad_Pro_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/11__iPad_Pro__10.5__iPad_Pro_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/10.9__iPad_Air_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/10.5__iPad_Air_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/10.2__iPad_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait_dark.png' />
          <link rel='apple-touch-startup-image' media='screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)' href='/splash/8.3__iPad_Mini_portrait_dark.png' />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
