export function isServiceEnabled (service) {
  if (process.env.NODE_ENV !== 'development') return true

  const services = (process.env.COMPOSE_PROFILES ?? '').split(',')
  return services.includes(service)
}
