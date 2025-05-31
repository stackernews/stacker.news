import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@apollo/client'
import { useDomain } from '../territory-domains'
import { GET_CUSTOM_BRANDING } from '@/fragments/brandings'
import Head from 'next/head'

const defaultBranding = {
  primaryColor: '#FADA5E',
  secondaryColor: '#F6911D',
  title: 'Stacker News',
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
    fetchPolicy: 'cache-and-network'
  })

  useEffect(() => {
    if (data?.territoryBranding) {
      setBranding({
        ...defaultBranding,
        ...data.territoryBranding
      })
    }
  }, [data])

  return (
    <BrandingContext.Provider value={branding}>
      {isCustomDomain && branding.title && (
        <Head>
          <title>{branding.title}</title>
        </Head>
      )}
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext)
