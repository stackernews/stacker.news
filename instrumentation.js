// Next runs this once when the server starts, before it handles any request.
export async function register () {
  // Validate startup proxy settings and configure gRPC; default HTTP stays direct.
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./lib/egress/bootstrap')
}
