// fork of https://github.com/alexbosworth/lightning/blob/master/lnd_grpc/authenticated_lnd_grpc.js
// that allows to enable or disable proxy

import { join } from 'path'
import apiForProto from 'lightning/lnd_grpc/api_for_proto'
import { defaultSocket, grpcSslCipherSuites, packageTypes, protoFiles, protosDir, serviceTypes } from 'lightning/grpc/index'
import grpcCredentials from 'lightning/lnd_grpc/grpc_credentials'
import { existsSync } from 'fs'

const { GRPC_SSL_CIPHER_SUITES } = process.env
const { keys } = Object

export function authenticatedLndGrpc ({ cert, macaroon, path, socket, deadline }, withProxy) {
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
    // Disable automatic gRPC env mapping; proxied channels explicitly use the
    // configured HTTPS_PROXY gateway below, while SN's internal channel stays direct.
    'grpc.enable_http_proxy': 0
  }
  if (deadline !== undefined) {
    // ln-service can make several RPCs for one operation. Give them a shared
    // deadline so follow-up calls cannot extend the operation's lifetime.
    params.interceptors = [(options, nextCall) => nextCall({
      ...options,
      deadline: Math.min(options.deadline ?? Infinity, deadline)
    })]
  }

  // withProxy is false only for SN's operator-configured internal LND. Every user
  // wallet, clearnet included, dials the gateway and has grpc-js CONNECT to
  // the wallet from there; TLS and the authority still use the wallet's own name.
  let dialSocket = lndSocket
  if (withProxy) {
    const { hostname, port } = new URL(`http://${lndSocket}`)
    // grpc-js drops IPv6 brackets from CONNECT targets. Also reject saved wallets.
    if (hostname.startsWith('[')) {
      throw new Error('IPv6 addresses are not supported; use a DNS hostname instead')
    }
    // URL provides the ASCII hostname, but removes an explicit default :80 port.
    const authority = `${hostname}:${port || 80}`
    // The bootstrap guarantees a literal http://host:port; dial it as written.
    dialSocket = process.env.HTTPS_PROXY.slice('http://'.length)
    params['grpc.http_connect_target'] = `dns:${authority}`
    params['grpc.default_authority'] = authority
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
        socket: dialSocket,
        type: packageTypes[service]
      })

      return services
    },
    {})
  }
}
