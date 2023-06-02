import Document, { Html, Head, Main, NextScript } from 'next/document'

const publicPrefix = process.env.NODE_ENV === 'development' ? '' : 'https://a.stacker.news'
class MyDocument extends Document {
  render () {
    return (
      <Html>
        <Head>
          <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
          <link rel='manifest' href='/site.webmanifest' />
          <link rel='preload' href={`${publicPrefix}/Lightningvolt-xoqm.ttf`} as='font' type='font/ttf' crossOrigin='' />
          <style
            dangerouslySetInnerHTML={{
              __html:
            ` @font-face {
                font-family: 'lightning';
                src: url(${publicPrefix}/Lightningvolt-xoqm.ttf);
                font-display: swap;
              }`
            }}
          />
        </Head>
        <body>
          <script src={`${publicPrefix}/darkmode.js`} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
