import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { useDomain } from '../territory-domains'
import { GET_CUSTOM_BRANDING } from '@/fragments/brandings'
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

export const BrandingProvider = ({ children }) => {
  const { isCustomDomain } = useDomain()
  const [branding, setBranding] = useState(defaultBranding)

  // if on a custom domain, fetch and cache the branding
  const { data } = useQuery(GET_CUSTOM_BRANDING, {
    skip: !isCustomDomain,
    variables: {
      subName: 'sambido'
    },
    fetchPolicy: 'cache-and-network'
  })

  console.log('branding', data)

  useEffect(() => {
    if (data?.customBranding) {
      setBranding({
        ...defaultBranding,
        ...data.customBranding
      })
    }
  }, [data])

  return (
    <BrandingContext.Provider value={branding}>
      {isCustomDomain && branding.title && (
        <>
          <Head>
            {branding.title && <title>{branding.title}</title>}
            {/* branding.favicon && <link rel='icon' href={branding.favicon} /> */}
          </Head>
          <CustomStyles />
        </>
      )}
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext)
