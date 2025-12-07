UPDATE "WalletTemplate" SET "recvProtocols" = array_remove("recvProtocols", 'NWC') WHERE name = 'COINOS';
