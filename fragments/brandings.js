import { gql } from 'graphql-tag'

export const CUSTOM_BRANDING_FIELDS = gql`
  fragment CustomBrandingFields on CustomBranding {
    title
    colors
    logoId
    faviconId
    subName
  }
`

export const GET_CUSTOM_BRANDING = gql`
  ${CUSTOM_BRANDING_FIELDS}
  query CustomBranding($subName: String!) {
    customBranding(subName: $subName) {
      ...CustomBrandingFields
    }
  }
`

export const SET_CUSTOM_BRANDING = gql`
  ${CUSTOM_BRANDING_FIELDS}
  mutation SetCustomBranding($subName: String!, $branding: CustomBrandingInput!) {
    setCustomBranding(subName: $subName, branding: $branding) {
      ...CustomBrandingFields
    }
  }
`
