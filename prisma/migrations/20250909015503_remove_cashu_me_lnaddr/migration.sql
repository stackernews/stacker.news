UPDATE "WalletTemplate" SET "recvProtocols" = array_remove("recvProtocols", 'LN_ADDR') WHERE name = 'CASHU_ME';
