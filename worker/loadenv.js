import { loadEnvConfig } from '@next/env'

// this should probably not import __DEV__ from @/lib/constants
// because we are initializing the environment variables for the worker here
loadEnvConfig('.', process.env.NODE_ENV === 'development')
