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
It can also be used in the future for encrypted messaging.

An example flow can be:
<details>
<summary>Flow with OAuth</summary>
Step 1: Device generates a key pair on first visit

```
{ privateKey, publicKey } = await crypto.subtle.generateKey(ECDH P-256, non-extractable)

{ set, get } = useIndexedDB(idbConfig)
set(privateKey)
set(publicKey)
```

##### Step 2: Initiate login using OAuth

```
state = getRandomValues -> store in sessionStorage
code_verifier = getRandomValues -> store in sessionStorage
code_challenge = sha256(code_verifier)

GET https://stacker.news/api/auth/sync/authorize
  ?state=<state>
  &code_challenge=<code_challenge>
  &redirect_uri=https://www.pizza.com/api/auth/sync/callback
                ?callbackUrl=/items/960002
```

The `sync/authorize` endpoint checks the session on stacker.news and creates a **verification token** that is bound to the code_challenge.
We'll send this token along with state to `sync/callback`

```
302 https://www.pizza.com/api/auth/sync/callback
    ?callbackUrl=/items/960002
    &token=<verificationToken>
    &state=<state>
```

Here we check if the received `state` matches the state we saved in the client's `sessionStorage`. If it does, we'll POST the `sync/complete` endpoint with the device ECDH public key, to exchange the token for a JWT and the server public key.

The `code_verifier` is how PKCE will confirm that we're exchanging with the user that initiated.

##### Step 3: POST stacker.news to exchange the session cookie

```
device_pubkey = IndexedDB
code_verifier = sessionStorage

POST https://stacker.news/api/auth/sync/complete
body {
  token,
  code_verifier,
  device_pubkey
}

RESPONSE {
  session_token,
  server_pubkey
}
```

The server pubkey is saved in IndexedDB, and both client and server derive the shared secret using ECDH.
This shared secret is then used to create HMAC signatures for requests.

##### Step 4: Sign a request
For example, on GraphQL requests, the client:

```
req_payload = payload + timestamp
signature = hmac(shared_secret, req_payload)
Headers: {
  'X-Timestamp': timestamp,
  'X-Signature': signature,
  'Authorization': etc.
}
```

The server verifies that the timestamp isn't too old and that the HMAC signature and session token are valid.
</details>

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