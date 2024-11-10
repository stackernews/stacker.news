// fork of https://github.com/alexbosworth/lightning/blob/master/lnd_grpc/authenticated_lnd_grpc.js
// that allows to enable or disable proxy

import { join } from 'path'
import apiForProto from 'lightning/lnd_grpc/api_for_proto'
import { defaultSocket, grpcSslCipherSuites, packageTypes, protoFiles, protosDir, serviceTypes } from 'lightning/grpc/index'
import grpcCredentials from 'lightning/lnd_grpc/grpc_credentials'
import { existsSync } from 'fs'

const { GRPC_SSL_CIPHER_SUITES } = process.env
const { keys } = Object

export function authenticatedLndGrpc ({ cert, macaroon, path, socket }, withProxy) {
  const lightningModulePath = process.env.LIGHTNING_MODULE_PATH || require.resolve('lightning')
  const pathForProto = proto => {
    const path = join(lightningModulePath, protosDir, proto)
    // check if path exists
    if (!existsSync(path)) {
      throw new Error(`Proto file not found: ${path}`)
    }
    return path
  }

  const { credentials } = grpcCredentials({ cert, macaroon })
  const lndSocket = socket || defaultSocket

  if (!!cert && GRPC_SSL_CIPHER_SUITES !== grpcSslCipherSuites) {
    process.env.GRPC_SSL_CIPHER_SUITES = grpcSslCipherSuites
  }

  const params = {
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1,
    'grpc.enable_http_proxy': withProxy ? 1 : 0
  }

  // Assemble different services from their proto files
  return {
    lnd: keys(serviceTypes).reduce((services, type) => {
      const service = serviceTypes[type]

      const file = protoFiles[service]

      services[type] = apiForProto({
        credentials,
        params,
        service,
        path: path ? join(path, file) : pathForProto(file),
        socket: lndSocket,
        type: packageTypes[service]
      })

      return services
    },
    {})
  }
}
