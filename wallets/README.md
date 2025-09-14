# Wallets

## How to add a new wallet

**1. Update prisma.schema**

- add enum value to `WalletName` enum
- run `npx prisma migrate dev --create-only`

**2. Update migration file**

- append `COMMIT` to the `ALTER TYPE` statement in the migration
- insert new row into `ẀalletTemplate`
- run `npx prisma migrate dev`

Example migration:

```sql
ALTER TYPE "WalletName" ADD VALUE 'PHOENIX'; COMMIT;
INSERT INTO "WalletTemplate" (name, "sendProtocols", "recvProtocols")
VALUES (
    'PHOENIX',
    ARRAY[]::"WalletSendProtocolName"[],
    ARRAY['BOLT12']::"WalletRecvProtocolName"[]
);
```

**3. Customize how the wallet looks on the client via [wallets/lib/wallets.json](/wallets/lib/wallets.json)**

Example:

```json
{
    // must be same name as wallet template
    "name": "PHOENIX",
    // name to show in client
    "displayName": "Phoenix",
    // image to show in client
    // (dark mode will use /path/to/image-dark.png)
    "image": "/path/to/image.png",
    // url (planned) to show in client
    "url": "https://phoenix.acinq.co/"
}
```

_If the wallet supports a lightning address and the domain is different than the url, you can pass an object to `url`. Here is Zeus as an example:_

```json
{
    "name": "ZEUS",
    "displayName": "Zeus",
    "image": "/wallets/zeus.svg",
    "url": {
        "wallet": "https://zeusln.com/",
        // different domain for lightning address
        "lud16Domain": "zeuspay.com"
    }
},
```

That's it!

## How to add a new protocol

**1. Update prisma.schema**

- add enum value to `WalletProtocolName` enum
- add enum value to `WalletRecvProtocolName` or `WalletSendProtocolName`
- add table to store protocol config
- run `npx prisma migrate dev --create-only`
- **for send protocols, it is important that the names for encrypted columns end with `vaultId`**

<details>
<summary>Example</summary>

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 9a113797..12505333 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -1199,6 +1199,7 @@ enum WalletProtocolName {
   LNC
   CLN_REST
   LND_GRPC
+  BOLT12
 }

 enum WalletSendProtocolName {
@@ -1218,6 +1219,7 @@ enum WalletRecvProtocolName {
   LN_ADDR
   CLN_REST
   LND_GRPC
+  BOLT12
 }

 enum WalletProtocolStatus {
@@ -1288,6 +1290,7 @@ model WalletProtocol {
   walletRecvLightningAddress WalletRecvLightningAddress?
   walletRecvCLNRest          WalletRecvCLNRest?
   walletRecvLNDGRPC          WalletRecvLNDGRPC?
+  walletRecvBolt12           WalletRecvBolt12?

   @@unique(name: "WalletProtocol_walletId_send_name_key", [walletId, send, name])
 }
@@ -1429,3 +1432,12 @@ model WalletRecvLNDGRPC {
   macaroon   String
   cert       String?
 }
+
+model WalletRecvBolt12 {
+  id         Int            @id @default(autoincrement())
+  createdAt  DateTime       @default(now()) @map("created_at")
+  updatedAt  DateTime       @default(now()) @updatedAt @map("updated_at")
+  protocolId Int            @unique
+  protocol   WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
+  offer      String
+}
```

</details>

<br />

**2. Update migration file**

- add required triggers (`wallet_to_jsonb` and `wallet_clear_vault` if send protocol) to migration file
- run `npx prisma migrate dev`

<details>
<summary>Example</summary>

```sql
-- AlterEnum
ALTER TYPE "WalletProtocolName" ADD VALUE 'BOLT12';

-- AlterEnum
ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'BOLT12';

-- CreateTable
CREATE TABLE "WalletRecvBolt12" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocolId" INTEGER NOT NULL,
    "offer" TEXT NOT NULL,

    CONSTRAINT "WalletRecvBolt12_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletRecvBolt12_protocolId_key" ON "WalletRecvBolt12"("protocolId");

-- AddForeignKey
ALTER TABLE "WalletRecvBolt12" ADD CONSTRAINT "WalletRecvBolt12_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- vvv Add trigger below manually vvv

CREATE TRIGGER wallet_to_jsonb
    AFTER INSERT OR UPDATE ON "WalletRecvBolt12"
    FOR EACH ROW
    EXECUTE PROCEDURE wallet_to_jsonb();


-- if protocol is for sending you also need to add the wallet_clear_vault trigger:
-- CREATE TRIGGER wallet_clear_vault
--    AFTER DELETE ON "WalletSendClinkDebit"
--    FOR EACH ROW
--    EXECUTE PROCEDURE wallet_clear_vault();

```

</details>

<br />

**3. Add protocol lib file**

- add file to [wallets/lib/protocols](/wallets/lib/protocols) (see [JSDoc](/wallets/lib/protocols/index.js) for details)
- import in index.js file and add to default export

<details>
<summary>Example</summary>

```js
// wallets/lib/protocols/bolt12.js

export default [
  {
    // same as enum value we added
    name: 'BOLT12',
    displayName: 'BOLT12',
    send: false,
    fields: [
      {
        name: 'offer',
        type: 'text',
        label: 'offer',
        placeholder: 'lno...',
        validate: offerValidator,
        required: true,
      }
    ],
    relationName: 'walletRecvBolt12'
  }
]
```

```diff
diff --git a/wallets/lib/protocols/index.js b/wallets/lib/protocols/index.js
index 8caa5f52..58f5ab86 100644
--- a/wallets/lib/protocols/index.js
+++ b/wallets/lib/protocols/index.js
@@ -7,6 +7,7 @@ import lnbitsSuite from './lnbits'
 import phoenixdSuite from './phoenixd'
 import blinkSuite from './blink'
 import webln from './webln'
+import bolt12 from './bolt12'

 /**
  * Protocol names as used in the database
@@ -44,5 +45,6 @@ export default [
   ...phoenixdSuite,
   ...lnbitsSuite,
   ...blinkSuite,
-  webln
+  webln,
+  bolt12
 ]
```

</details>

<br />

**4. Add protocol method file**

- if protocol to receive payments: Add file to [wallets/server/protocols](/wallets/server/protocols) (see [JSDoc](/wallets/server/protocols/index.js) for details)
- if protocol to send payments: Add file to [wallets/client/protocols](/wallets/client/protocols) (see [JSDoc](/wallets/client/protocols/index.js) for details)
- import in index.js file and add to default export

<details>
<summary>Example</summary>

```js
// wallets/server/protocols/bolt12.js

// same as enum value we added
export const name = 'BOLT12'

export async function createInvoice ({ msats, description, expiry }, config, { signal }) {
  /* ... code to create invoice using protocol config ... */
}

export async function testCreateInvoice ({ url }, { signal }) {
  return await createInvoice(
    { msats: 1000, description: 'SN test invoice', expiry: 1 },
    { url },
    { signal }
  )
}
```

```diff
diff --git a/wallets/server/protocols/index.js b/wallets/server/protocols/index.js
index 26c292d9..3ac88ae1 100644
--- a/wallets/server/protocols/index.js
+++ b/wallets/server/protocols/index.js
@@ -5,6 +5,7 @@ import * as clnRest from './clnRest'
 import * as phoenixd from './phoenixd'
 import * as blink from './blink'
 import * as lndGrpc from './lndGrpc'
+import * as bolt12 from './bolt12'

 export * from './util'

@@ -56,5 +57,6 @@ export default [
   clnRest,
   phoenixd,
   blink,
-  lndGrpc
+  lndGrpc,
+  bolt12
 ]
```

</details>

<br />

**5. Update GraphQL code**

- add GraphQL type
- add GraphQL type to `WalletProtocolConfig` union
- add GraphQL type to `WalletProtocolFields` fragment via spread operator (...)
- add GraphQL mutation to upsert and test protocol
- resolve GraphQL type in `mapWalletResolveTypes` function

<details>
<summary>Example</summary>

```diff
diff --git a/api/typeDefs/wallet.js b/api/typeDefs/wallet.js
index 3c1fffd1..af3858a5 100644
--- a/api/typeDefs/wallet.js
+++ b/api/typeDefs/wallet.js
@@ -38,6 +38,7 @@ const typeDefs = gql`
     upsertWalletRecvLNDGRPC(walletId: ID, templateId: ID, enabled: Boolean!, socket: String!, macaroon: String!, cert: String): WalletRecvLNDGRPC!
     upsertWalletSendLNC(walletId: ID, templateId: ID, enabled: Boolean!, pairingPhrase: VaultEntryInput!, localKey: VaultEntryInput!, remoteKey: VaultEntryInput!, serverHost: VaultEntryInput!): WalletSendLNC!
     upsertWalletSendWebLN(walletId: ID, templateId: ID, enabled: Boolean!): WalletSendWebLN!
+    upsertWalletRecvBolt12(walletId: ID, templateId: ID, enabled: Boolean!, offer: String!): WalletRecvBolt12!
     removeWalletProtocol(id: ID!): Boolean
     updateWalletEncryption(keyHash: String!, wallets: [WalletEncryptionUpdate!]!): Boolean
     updateKeyHash(keyHash: String!): Boolean
@@ -111,6 +112,7 @@ const typeDefs = gql`
     | WalletRecvLightningAddress
     | WalletRecvCLNRest
     | WalletRecvLNDGRPC
+    | WalletRecvBolt12

   type WalletSettings {
     receiveCreditsBelowSats: Int!
@@ -207,6 +209,11 @@ const typeDefs = gql`
     cert: String
   }

+  type WalletRecvBolt12 {
+    id: ID!
+    offer: String!
+  }
+
   input AutowithdrawSettings {
     autoWithdrawThreshold: Int!
     autoWithdrawMaxFeePercent: Float!
diff --git a/wallets/client/fragments/protocol.js b/wallets/client/fragments/protocol.js
index d1a65ff4..138d1a62 100644
--- a/wallets/client/fragments/protocol.js
+++ b/wallets/client/fragments/protocol.js
@@ -109,3 +109,11 @@ export const UPSERT_WALLET_SEND_WEBLN = gql`
     }
   }
 `
+
+export const UPSERT_WALLET_RECEIVE_BOLT12 = gql`
+  mutation upsertWalletRecvBolt12($walletId: ID, $templateId: ID, $enabled: Boolean!, $offer: String!) {
+    upsertWalletRecvBolt12(walletId: $walletId, templateId: $templateId, enabled: $enabled, offer: $offer) {
+      id
+    }
+  }
+`
diff --git a/wallets/client/fragments/wallet.js b/wallets/client/fragments/wallet.js
index c301f5c1..73d59e6d 100644
--- a/wallets/client/fragments/wallet.js
+++ b/wallets/client/fragments/wallet.js
@@ -106,6 +106,10 @@ const WALLET_PROTOCOL_FIELDS = gql`
         macaroon
         cert
       }
+      ... on WalletRecvBolt12 {
+        id
+        offer
+      }
     }
   }
 `
diff --git a/wallets/server/resolvers/util.js b/wallets/server/resolvers/util.js
index 0155a422..ced4b399 100644
--- a/wallets/server/resolvers/util.js
+++ b/wallets/server/resolvers/util.js
@@ -19,6 +19,8 @@ export function mapWalletResolveTypes (wallet) {
         return 'WalletRecvCLNRest'
       case 'LND_GRPC':
         return 'WalletRecvLNDGRPC'
+      case 'BOLT12':
+        return 'WalletRecvBolt12'
       default:
         return null
     }
```

</details>
