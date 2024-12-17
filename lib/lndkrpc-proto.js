export default `
syntax = "proto3";
package lndkrpc;

service Offers {
    rpc PayOffer (PayOfferRequest) returns (PayOfferResponse);
    rpc GetInvoice (GetInvoiceRequest) returns (GetInvoiceResponse);
    rpc DecodeInvoice (DecodeInvoiceRequest) returns (Bolt12InvoiceContents);
    rpc PayInvoice (PayInvoiceRequest) returns (PayInvoiceResponse);
}

message PayOfferRequest {
   string offer = 1;
   optional uint64 amount = 2;
   optional string payer_note = 3;
   optional uint32 response_invoice_timeout = 4;
   optional uint64 max_fee = 5;
}

message PayOfferResponse {
    string payment_preimage = 2;
}

message GetInvoiceRequest {
    string offer = 1;
    optional uint64 amount = 2;
    optional string payer_note = 3;
    optional uint32 response_invoice_timeout = 4;
}

message DecodeInvoiceRequest {
    string invoice = 1;
}

message GetInvoiceResponse {
    string invoice_hex_str = 1;
    Bolt12InvoiceContents invoice_contents = 2;
}

message PayInvoiceRequest {
    string invoice = 1;
    optional uint64 amount = 2;
    optional uint64 max_fee = 3;
}

message PayInvoiceResponse {
    string payment_preimage = 1;
}

message Bolt12InvoiceContents {
    string chain = 1;
    optional uint64 quantity = 2;
    uint64 amount_msats = 3;
    optional string description = 4;
    PaymentHash payment_hash = 5;
    repeated PaymentPaths payment_paths = 6;
    int64 created_at = 7;
    uint64 relative_expiry = 8;
    PublicKey node_id = 9;
    string signature = 10;
    repeated FeatureBit features = 11;
    optional string payer_note = 12;
}

message PaymentHash {
    bytes hash = 1;
}

message PublicKey {
    bytes key = 1;
}

message BlindedPayInfo {
    uint32 fee_base_msat = 1;
    uint32 fee_proportional_millionths = 2;
    uint32 cltv_expiry_delta = 3;
    uint64 htlc_minimum_msat = 4;
    uint64 htlc_maximum_msat = 5;
    repeated FeatureBit features = 6;
}

message BlindedHop {
    PublicKey blinded_node_id = 1;
    bytes encrypted_payload = 2;
}

message BlindedPath {
    IntroductionNode introduction_node = 1;
    PublicKey blinding_point = 2;
    repeated BlindedHop blinded_hops = 3;
}

message PaymentPaths {
    BlindedPayInfo blinded_pay_info = 1;
    BlindedPath blinded_path = 2;
}

message IntroductionNode {
    optional PublicKey node_id = 1;
    optional DirectedShortChannelId directed_short_channel_id = 2;
}

message DirectedShortChannelId {
    Direction direction = 1;
    uint64 scid = 2;
}

enum Direction {
    NODE_ONE = 0;
    NODE_TWO = 1;
}

enum FeatureBit {
    DATALOSS_PROTECT_REQ = 0;
    DATALOSS_PROTECT_OPT = 1;
    INITIAL_ROUING_SYNC = 3;
    UPFRONT_SHUTDOWN_SCRIPT_REQ = 4;
    UPFRONT_SHUTDOWN_SCRIPT_OPT = 5;
    GOSSIP_QUERIES_REQ = 6;
    GOSSIP_QUERIES_OPT = 7;
    TLV_ONION_REQ = 8;
    TLV_ONION_OPT = 9;
    EXT_GOSSIP_QUERIES_REQ = 10;
    EXT_GOSSIP_QUERIES_OPT = 11;
    STATIC_REMOTE_KEY_REQ = 12;
    STATIC_REMOTE_KEY_OPT = 13;
    PAYMENT_ADDR_REQ = 14;
    PAYMENT_ADDR_OPT = 15;
    MPP_REQ = 16;
    MPP_OPT = 17;
    WUMBO_CHANNELS_REQ = 18;
    WUMBO_CHANNELS_OPT = 19;
    ANCHORS_REQ = 20;
    ANCHORS_OPT = 21;
    ANCHORS_ZERO_FEE_HTLC_REQ = 22;
    ANCHORS_ZERO_FEE_HTLC_OPT = 23;
    ROUTE_BLINDING_REQUIRED = 24;
    ROUTE_BLINDING_OPTIONAL = 25;
    AMP_REQ = 30;
    AMP_OPT = 31;
}
`
