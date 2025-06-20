## Problem
Synchronizing a user session between stacker.news and a user-owned custom domain, means giving up the whole JWT, which can be stolen and replayed.

For example, in a scenario like DNS hijacking, the malicious user that owns the custom domain can point their DNS record to a server of their own, **log** the incoming requests, **collect** the JWTs and **replay** them.

Usually, mitigations are used for this kind of problem:
- fingerprinting
- dns polling
- short-lived sessions, with refresh tokens
- aggressive checks on custom domains

I think that some mitigations are correct, such as **dns polling** to take measures against the malicious owner; others might be too much.

## Per-device keys
**The case for per-device ECDH Key Pairs**

As a form of authentication, we can use ECDH shared secrets to either
- sign requests for the GraphQL endpoint
- encrypt JWT payloads
To accomplish this, each device will have its own ECDH key pair, generated and stored in IndexedDB on first visit.
It can also be used in the future for encrypted messaging

An example flow can be:
```

1. Device generates key pair
2. On login, server creates an ECDH key pair
3. Client and server exchanges public keys
4. Server and device derives the same shared secret with each other
-- Stores:
    user, server_priv_key, client_pub_key, shared_secret_hash
5. Server issues an encrypted JWT using the shared secret
6. Device decrypts JWT with the same shared secret
```

Shared secret rotation is part of best practices in this context.

**The case for ECDSA**

ECDSA, much like the ECDH route above, can be used to generate a key pair on the first visit and share its public key with the server, to bind it to the user we're importing from `stacker.news`.

ECDSA can be used to sign every request or JWTs, the server will then verify the signature and accept the request if the signature is valid.

An example flow can be:
```
1. Device generates key pair
2. Public key is sent to server and bound to a user
3. Server issues a JWT that includes the public key fingerprint
4. On each requests, client signs a message with private key
5. Server verifies the JWT and the signature, proving possession
```

If the JWT gets stolen, it's useless without the device private key.

###### Bonus
A bonus point of using key pairs, is the capability of tracking devices connected to an account, enabling session revocation.