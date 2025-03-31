import { createContext, useContext } from 'react'
import CustomStyles from './custom-styles'
import Head from 'next/head'

const defaultBranding = {
  primaryColor: '#FADA5E',
  secondaryColor: '#F6911D',
  title: 'stacker news',
  logo: null,
  favicon: null
}

const BrandingContext = createContext(defaultBranding)

export const BrandingProvider = ({ children, customBranding }) => {
  return (
    <BrandingContext.Provider value={customBranding || defaultBranding}>
      {customBranding && (
        <>
          <Head>
            {customBranding?.title && <title>{customBranding?.title}</title>}
            {/* branding.favicon && <link rel='icon' href={branding.favicon} /> */}
          </Head>
          {customBranding?.primaryColor && <CustomStyles />}
        </>
      )}
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext)
