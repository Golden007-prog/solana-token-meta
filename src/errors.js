// Errors thrown by solana-token-meta. All extend TokenMetaError, so one `instanceof` catches everything.

export class TokenMetaError extends Error {
  constructor(message, options) { super(message, options); this.name = "TokenMetaError"; }
}

/** Bad input from the caller: not an address, wrong type, bad option. */
export class InvalidInputError extends TokenMetaError {
  constructor(message, options) { super(message, options); this.name = "InvalidInputError"; }
}

/** The RPC answered with an error, a non-2xx status, or something that is not JSON-RPC. `code` is the JSON-RPC error code or HTTP status. */
export class RpcError extends TokenMetaError {
  constructor(message, { code = null, status = null, cause } = {}) { super(message, { cause }); this.name = "RpcError"; this.code = code; this.status = status; }
}

/** The RPC (or the off-chain URI) did not answer within the timeout. */
export class RpcTimeoutError extends TokenMetaError {
  constructor(message, options) { super(message, options); this.name = "RpcTimeoutError"; }
}

/** Account data that does not decode as the expected layout. */
export class DecodeError extends TokenMetaError {
  constructor(message, options) { super(message, options); this.name = "DecodeError"; }
}
