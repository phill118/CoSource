export type CommerceProviderErrorKind =
  | 'invalid_request'
  | 'transport'
  | 'throttled'
  | 'invalid_response'
  | 'provider_error'

export class CommerceProviderError extends Error {
  readonly kind: CommerceProviderErrorKind
  readonly status?: number
  readonly retryAfterSeconds?: number

  constructor(
    kind: CommerceProviderErrorKind,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'CommerceProviderError'
    this.kind = kind
    this.status = options.status
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}
