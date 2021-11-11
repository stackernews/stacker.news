import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render () {
    return (
      <Html>
        <Head>
          <link rel='preload' href='/Lightningvolt-xoqm.ttf' as='font' type='font/ttf' crossOrigin='' />
        </Head>
        <body>
          <script src='darkmode.js' type='module' />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
