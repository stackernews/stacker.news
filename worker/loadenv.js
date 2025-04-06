import { loadEnvConfig } from '@next/env'
loadEnvConfig('.', process.env.NODE_ENV === 'development')
