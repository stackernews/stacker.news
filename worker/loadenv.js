import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
loadEnvConfig('.', process.env.NODE_ENV === 'development')
