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

### 1. Update db schema

**1.1 Update prisma.schema**

- add enum value to `WalletProtocolName` enum
- add enum value to `WalletRecvProtocolName` or `WalletSendProtocolName`
- add table to store protocol config
- run `npx prisma migrate dev --create-only`
- **for send protocols, it is important that the names for encrypted columns end with `vaultId`**

**1.2 Update migration file**

- add `COMMIT` after statements to add enum values
- add required triggers: `wallet_to_jsonb` and if send protocol, also `wallet_clear_vault`
- run `npx prisma migrate dev`

<details>
<summary>Example</summary>

```diff
commit 0834650e84e3c0ba86f881f0f3643e87b26108e7
Author: ekzyis <ek@stacker.news>
Date:   Tue Sep 23 07:24:37 2025 +0200

    DB schema for Spark

diff --git a/prisma/migrations/20250923052230_spark/migration.sql b/prisma/migrations/20250923052230_spark/migration.sql
new file mode 100644
index 00000000..04ff1847
--- /dev/null
+++ b/prisma/migrations/20250923052230_spark/migration.sql
@@ -0,0 +1,64 @@
+-- AlterEnum
+ALTER TYPE "WalletName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletSendProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+INSERT INTO "WalletTemplate" ("name", "sendProtocols", "recvProtocols")
+VALUES ('SPARK', '{SPARK}', '{SPARK}');
+
+-- CreateTable
+CREATE TABLE "WalletSendSpark" (
+    "id" SERIAL NOT NULL,
+    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "protocolId" INTEGER NOT NULL,
+    "mnemonicVaultId" INTEGER NOT NULL,
+
+    CONSTRAINT "WalletSendSpark_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "WalletRecvSpark" (
+    "id" SERIAL NOT NULL,
+    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "protocolId" INTEGER NOT NULL,
+    "address" TEXT NOT NULL,
+
+    CONSTRAINT "WalletRecvSpark_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletSendSpark_protocolId_key" ON "WalletSendSpark"("protocolId");
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletSendSpark_mnemonicVaultId_key" ON "WalletSendSpark"("mnemonicVaultId");
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletRecvSpark_protocolId_key" ON "WalletRecvSpark"("protocolId");
+
+-- AddForeignKey
+ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_mnemonicVaultId_fkey" FOREIGN KEY ("mnemonicVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "WalletRecvSpark" ADD CONSTRAINT "WalletRecvSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+CREATE TRIGGER wallet_to_jsonb
+    AFTER INSERT OR UPDATE ON "WalletSendSpark"
+    FOR EACH ROW
+    EXECUTE PROCEDURE wallet_to_jsonb();
+
+CREATE TRIGGER wallet_clear_vault
+   AFTER DELETE ON "WalletSendSpark"
+   FOR EACH ROW
+   EXECUTE PROCEDURE wallet_clear_vault();
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 4f3cb9e2..c25c0fc8 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -221,6 +221,7 @@ model Vault {
   walletSendLNCRemoteKey     WalletSendLNC?      @relation("lncRemoteKey")
   walletSendLNCServerHost    WalletSendLNC?      @relation("lncServerHost")
   walletSendCLNRestRune      WalletSendCLNRest?  @relation("clnRune")
+  walletSendSparkMnemonic    WalletSendSpark?    @relation("sparkMnemonic")
 }

 model WalletLog {
@@ -1214,6 +1215,7 @@ enum WalletProtocolName {
   CLN_REST
   LND_GRPC
   CLINK
+  SPARK
 }

 enum WalletSendProtocolName {
@@ -1224,6 +1226,7 @@ enum WalletSendProtocolName {
   WEBLN
   LNC
   CLN_REST
+  SPARK
 }

 enum WalletRecvProtocolName {
@@ -1235,6 +1238,7 @@ enum WalletRecvProtocolName {
   CLN_REST
   LND_GRPC
   CLINK
+  SPARK
 }

 enum WalletProtocolStatus {
@@ -1270,6 +1274,7 @@ enum WalletName {
   LN_ADDR
   CASH_APP
   BLITZ
+  SPARK
 }

 model WalletTemplate {
@@ -1327,6 +1332,7 @@ model WalletProtocol {
   walletSendWebLN    WalletSendWebLN?
   walletSendLNC      WalletSendLNC?
   walletSendCLNRest  WalletSendCLNRest?
+  walletSendSpark    WalletSendSpark?

   walletRecvNWC              WalletRecvNWC?
   walletRecvLNbits           WalletRecvLNbits?
@@ -1336,6 +1342,7 @@ model WalletProtocol {
   walletRecvCLNRest          WalletRecvCLNRest?
   walletRecvLNDGRPC          WalletRecvLNDGRPC?
   walletRecvClink            WalletRecvClink?
+  walletRecvSpark            WalletRecvSpark?

   @@unique(name: "WalletProtocol_walletId_send_name_key", [walletId, send, name])
   @@index([walletId])
@@ -1420,6 +1427,16 @@ model WalletSendCLNRest {
   rune        Vault?         @relation("clnRune", fields: [runeVaultId], references: [id])
 }

+model WalletSendSpark {
+  id              Int            @id @default(autoincrement())
+  createdAt       DateTime       @default(now()) @map("created_at")
+  updatedAt       DateTime       @default(now()) @updatedAt @map("updated_at")
+  protocolId      Int            @unique
+  protocol        WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
+  mnemonicVaultId Int            @unique
+  mnemonic        Vault?         @relation("sparkMnemonic", fields: [mnemonicVaultId], references: [id])
+}
+
 model WalletRecvNWC {
   id         Int            @id @default(autoincrement())
   createdAt  DateTime       @default(now()) @map("created_at")
@@ -1498,3 +1515,12 @@ model WalletRecvClink {
   protocol   WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
   noffer     String
 }
+
+model WalletRecvSpark {
+  id         Int            @id @default(autoincrement())
+  createdAt  DateTime       @default(now()) @map("created_at")
+  updatedAt  DateTime       @default(now()) @updatedAt @map("updated_at")
+  protocolId Int            @unique
+  protocol   WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
+  address    String
+}

```

</details>

### 2. Update JS code

**2.1 Add protocol lib file**

- add file to [wallets/lib/protocols](/wallets/lib/protocols) (see [JSDoc](/wallets/lib/protocols/index.js) for details)
- import in index.js file and add to default export
- update JSDoc in index.js by adding the name to `ProtocolName`

**2.2 Add protocol method file**

- if protocol to receive payments: Add file to [wallets/server/protocols](/wallets/server/protocols) (see [JSDoc](/wallets/server/protocols/index.js) for details)
- if protocol to send payments: Add file to [wallets/client/protocols](/wallets/client/protocols) (see [JSDoc](/wallets/client/protocols/index.js) for details)
- import in index.js file and add to default export

<details>
<summary>Example</summary>

```diff
commit 53f6de1e4380a3209bf0beba966b9592259f11de
Author: ekzyis <ek@stacker.news>
Date:   Tue Sep 23 07:41:47 2025 +0200

    JS code for Spark

diff --git a/wallets/client/protocols/index.js b/wallets/client/protocols/index.js
index c25805f7..3d6b00f6 100644
--- a/wallets/client/protocols/index.js
+++ b/wallets/client/protocols/index.js
@@ -5,6 +5,7 @@ import * as blink from './blink'
 import * as webln from './webln'
 import * as lnc from './lnc'
 import * as clnRest from './clnRest'
+import * as spark from './spark'

 export * from './util'

@@ -54,5 +55,6 @@ export default [
   blink,
   webln,
   lnc,
-  clnRest
+  clnRest,
+  spark
 ]
diff --git a/wallets/client/protocols/spark.js b/wallets/client/protocols/spark.js
new file mode 100644
index 00000000..ef3209e6
--- /dev/null
+++ b/wallets/client/protocols/spark.js
@@ -0,0 +1,7 @@
+export const name = 'SPARK'
+
+export async function sendPayment (bolt11, { mnemonic }, { signal }) {
+  // TODO: implement
+}
+
+export async function testSendPayment (config, { signal }) {}
diff --git a/wallets/lib/protocols/index.js b/wallets/lib/protocols/index.js
index a999fb37..7812e23a 100644
--- a/wallets/lib/protocols/index.js
+++ b/wallets/lib/protocols/index.js
@@ -8,10 +8,11 @@ import phoenixdSuite from './phoenixd'
 import blinkSuite from './blink'
 import webln from './webln'
 import clink from './clink'
+import sparkSuite from './spark'

 /**
  * Protocol names as used in the database
- * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'|'CLINK'} ProtocolName
+ * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'|'CLINK'|'SPARK'} ProtocolName
  * @typedef {'text'|'password'} InputType
  */

@@ -49,5 +50,6 @@ export default [
   ...lnbitsSuite,
   ...blinkSuite,
   webln,
-  clink
+  clink,
+  ...sparkSuite
 ]
diff --git a/wallets/lib/protocols/spark.js b/wallets/lib/protocols/spark.js
new file mode 100644
index 00000000..0c4ba2dd
--- /dev/null
+++ b/wallets/lib/protocols/spark.js
@@ -0,0 +1,39 @@
+import { bip39Validator, externalLightningAddressValidator } from '@/wallets/lib/validate'
+
+// Spark
+// https://github.com/breez/spark-sdk
+// https://sdk-doc-spark.breez.technology/
+
+export default [
+  {
+    name: 'SPARK',
+    send: true,
+    displayName: 'Spark',
+    fields: [
+      {
+        name: 'mnemonic',
+        label: 'mnemonic',
+        type: 'password',
+        required: true,
+        validate: bip39Validator(),
+        encrypt: true
+      }
+    ],
+    relationName: 'walletSendSpark'
+  },
+  {
+    name: 'SPARK',
+    send: false,
+    displayName: 'Spark',
+    fields: [
+      {
+        name: 'address',
+        label: 'address',
+        type: 'text',
+        required: true,
+        validate: externalLightningAddressValidator
+      }
+    ],
+    relationName: 'walletRecvSpark'
+  }
+]
diff --git a/wallets/lib/wallets.json b/wallets/lib/wallets.json
index 1975a9d2..98fe5bf8 100644
--- a/wallets/lib/wallets.json
+++ b/wallets/lib/wallets.json
@@ -168,5 +168,9 @@
         "displayName": "Blitz Wallet",
         "image": "/wallets/blitz.png",
         "url": "https://blitz-wallet.com/"
+    },
+    {
+        "name": "SPARK",
+        "displayName": "Spark"
     }
 ]
diff --git a/wallets/server/protocols/index.js b/wallets/server/protocols/index.js
index 6bf8ca04..6151e217 100644
--- a/wallets/server/protocols/index.js
+++ b/wallets/server/protocols/index.js
@@ -6,6 +6,7 @@ import * as phoenixd from './phoenixd'
 import * as blink from './blink'
 import * as lndGrpc from './lndGrpc'
 import * as clink from './clink'
+import * as spark from './spark'

 export * from './util'

@@ -58,5 +59,6 @@ export default [
   phoenixd,
   blink,
   lndGrpc,
-  clink
+  clink,
+  spark
 ]
diff --git a/wallets/server/protocols/spark.js b/wallets/server/protocols/spark.js
new file mode 100644
index 00000000..abc610ac
--- /dev/null
+++ b/wallets/server/protocols/spark.js
@@ -0,0 +1,16 @@
+export const name = 'SPARK'
+
+export async function createInvoice (
+  { msats, description, descriptionHash, expiry },
+  { address },
+  { signal }
+) {
+  // TODO: implement
+}
+
+export async function testCreateInvoice ({ address }, { signal }) {
+  return await createInvoice(
+    { msats: 1000, description: 'SN test invoice', expiry: 1 },
+    { address },
+    { signal })
+}

```

</details>

### 3. Update GraphQL code

- add GraphQL type
- add GraphQL type to `WalletProtocolConfig` union
- add GraphQL type to `WalletProtocolFields` fragment via spread operator (...)
- add GraphQL mutation to upsert and test protocol
- resolve GraphQL type in `mapWalletResolveTypes` function

<details>
<summary>Example</summary>

```diff
commit 72c9d3a46928775d66ac93ed1e66294f435bbcb7
Author: ekzyis <ek@stacker.news>
Date:   Tue Sep 23 07:55:17 2025 +0200

    GraphQL code for Spark

diff --git a/api/typeDefs/wallet.js b/api/typeDefs/wallet.js
index 6284b821..7420ec15 100644
--- a/api/typeDefs/wallet.js
+++ b/api/typeDefs/wallet.js
@@ -108,6 +108,16 @@ const typeDefs = gql`
       ${shared}
     ): WalletSendWebLN!

+    upsertWalletSendSpark(
+      ${shared},
+      mnemonic: VaultEntryInput!
+    ): WalletSendSpark!
+
+    upsertWalletRecvSpark(
+      ${shared},
+      address: String!
+    ): WalletRecvSpark!
+
     upsertWalletRecvClink(
       ${shared},
       noffer: String!
@@ -153,6 +163,10 @@ const typeDefs = gql`
       noffer: String!
     ): Boolean!

+    testWalletRecvSpark(
+      address: String!
+    ): Boolean!
+
     # delete
     deleteWallet(id: ID!): Boolean

@@ -228,6 +242,7 @@ const typeDefs = gql`
     | WalletSendWebLN
     | WalletSendLNC
     | WalletSendCLNRest
+    | WalletSendSpark
     | WalletRecvNWC
     | WalletRecvLNbits
     | WalletRecvPhoenixd
@@ -236,6 +251,7 @@ const typeDefs = gql`
     | WalletRecvCLNRest
     | WalletRecvLNDGRPC
     | WalletRecvClink
+    | WalletRecvSpark

   type WalletSettings {
     receiveCreditsBelowSats: Int!
@@ -296,6 +312,11 @@ const typeDefs = gql`
     rune: VaultEntry!
   }

+  type WalletSendSpark {
+    id: ID!
+    mnemonic: VaultEntry!
+  }
+
   type WalletRecvNWC {
     id: ID!
     url: String!
@@ -343,6 +364,11 @@ const typeDefs = gql`
     noffer: String!
   }

+  type WalletRecvSpark {
+    id: ID!
+    address: String!
+  }
+
   input AutowithdrawSettings {
     autoWithdrawThreshold: Int!
     autoWithdrawMaxFeePercent: Float!
diff --git a/wallets/client/fragments/protocol.js b/wallets/client/fragments/protocol.js
index 8b132e82..38586def 100644
--- a/wallets/client/fragments/protocol.js
+++ b/wallets/client/fragments/protocol.js
@@ -249,6 +249,34 @@ export const UPSERT_WALLET_RECEIVE_CLINK = gql`
   }
 `

+export const UPSERT_WALLET_SEND_SPARK = gql`
+  mutation upsertWalletSendSpark(
+    ${shared.variables},
+    $mnemonic: VaultEntryInput!
+  ) {
+    upsertWalletSendSpark(
+      ${shared.arguments},
+      mnemonic: $mnemonic
+    ) {
+      id
+    }
+  }
+`
+
+export const UPSERT_WALLET_RECEIVE_SPARK = gql`
+  mutation upsertWalletRecvSpark(
+    ${shared.variables},
+    $address: String!
+  ) {
+    upsertWalletRecvSpark(
+      ${shared.arguments},
+      address: $address
+    ) {
+      id
+    }
+  }
+`
+
 // tests

 export const TEST_WALLET_RECEIVE_NWC = gql`
@@ -298,3 +326,9 @@ export const TEST_WALLET_RECEIVE_CLINK = gql`
     testWalletRecvClink(noffer: $noffer)
   }
 `
+
+export const TEST_WALLET_RECEIVE_SPARK = gql`
+  mutation testWalletRecvSpark($address: String!) {
+    testWalletRecvSpark(address: $address)
+  }
+`
diff --git a/wallets/client/fragments/wallet.js b/wallets/client/fragments/wallet.js
index 6d8676cc..b646c890 100644
--- a/wallets/client/fragments/wallet.js
+++ b/wallets/client/fragments/wallet.js
@@ -78,6 +78,12 @@ const WALLET_PROTOCOL_FIELDS = gql`
           ...VaultEntryFields
         }
       }
+      ... on WalletSendSpark {
+        id
+        encryptedMnemonic: mnemonic {
+          ...VaultEntryFields
+        }
+      }
       ... on WalletRecvNWC {
         id
         url
@@ -117,6 +123,10 @@ const WALLET_PROTOCOL_FIELDS = gql`
         id
         noffer
       }
+      ... on WalletRecvSpark {
+        id
+        address
+      }
     }
   }
 `
diff --git a/wallets/client/hooks/query.js b/wallets/client/hooks/query.js
index 51cf44b0..37169a69 100644
--- a/wallets/client/hooks/query.js
+++ b/wallets/client/hooks/query.js
@@ -13,6 +13,7 @@ import {
   UPSERT_WALLET_RECEIVE_NWC,
   UPSERT_WALLET_RECEIVE_PHOENIXD,
   UPSERT_WALLET_RECEIVE_CLINK,
+  UPSERT_WALLET_RECEIVE_SPARK,
   UPSERT_WALLET_SEND_BLINK,
   UPSERT_WALLET_SEND_LNBITS,
   UPSERT_WALLET_SEND_LNC,
@@ -20,6 +21,7 @@ import {
   UPSERT_WALLET_SEND_PHOENIXD,
   UPSERT_WALLET_SEND_WEBLN,
   UPSERT_WALLET_SEND_CLN_REST,
+  UPSERT_WALLET_SEND_SPARK,
   WALLETS,
   UPDATE_WALLET_ENCRYPTION,
   RESET_WALLETS,
@@ -34,6 +36,7 @@ import {
   TEST_WALLET_RECEIVE_CLN_REST,
   TEST_WALLET_RECEIVE_LND_GRPC,
   TEST_WALLET_RECEIVE_CLINK,
+  TEST_WALLET_RECEIVE_SPARK,
   DELETE_WALLET
 } from '@/wallets/client/fragments'
 import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
@@ -320,6 +323,8 @@ function protocolUpsertMutation (protocol) {
       return protocol.send ? UPSERT_WALLET_SEND_WEBLN : NOOP_MUTATION
     case 'CLINK':
       return protocol.send ? NOOP_MUTATION : UPSERT_WALLET_RECEIVE_CLINK
+    case 'SPARK':
+      return protocol.send ? UPSERT_WALLET_SEND_SPARK : UPSERT_WALLET_RECEIVE_SPARK
     default:
       return NOOP_MUTATION
   }
@@ -345,6 +350,8 @@ function protocolTestMutation (protocol) {
       return TEST_WALLET_RECEIVE_LND_GRPC
     case 'CLINK':
       return TEST_WALLET_RECEIVE_CLINK
+    case 'SPARK':
+      return TEST_WALLET_RECEIVE_SPARK
     default:
       return NOOP_MUTATION
   }
diff --git a/wallets/server/resolvers/util.js b/wallets/server/resolvers/util.js
index e11ee3e1..6d3741bc 100644
--- a/wallets/server/resolvers/util.js
+++ b/wallets/server/resolvers/util.js
@@ -21,6 +21,8 @@ export function mapWalletResolveTypes (wallet) {
         return 'WalletRecvLNDGRPC'
       case 'CLINK':
         return 'WalletRecvClink'
+      case 'SPARK':
+        return send ? 'WalletSendSpark' : 'WalletRecvSpark'
       default:
         return null
     }

```

</details>
