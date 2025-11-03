import { __PROD__ } from '@/lib/constants'

export function isServiceEnabled (service) {
  if (__PROD__) return true

  const services = (process.env.COMPOSE_PROFILES ?? '').split(',')
  return services.includes(service)
}
