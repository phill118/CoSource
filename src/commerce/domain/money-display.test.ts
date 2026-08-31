import { describe, expect, it } from 'vitest'
import { formatMoney, MoneyDisplayError } from './money-display'

describe('ISO-aware money display', () => {
  it('uses real two-fraction-digit GBP semantics', () => {
    expect(formatMoney({ minorAmount: 2499, currency: 'GBP' })).toContain('GBP 24.99')
  })

  it('uses real zero-fraction-digit JPY semantics', () => {
    expect(formatMoney({ minorAmount: 2499, currency: 'JPY' })).toContain('JPY 2,499')
  })

  it('uses real three-fraction-digit KWD semantics when supported by ICU', () => {
    expect(Intl.supportedValuesOf('currency')).toContain('KWD')
    expect(formatMoney({ minorAmount: 2499, currency: 'KWD' })).toContain('KWD 2.499')
  })

  it('formats different currencies independently without conversion', () => {
    expect(formatMoney({ minorAmount: 500, currency: 'GBP' })).toContain('GBP 5.00')
    expect(formatMoney({ minorAmount: 500, currency: 'JPY' })).toContain('JPY 500')
  })

  it.each([
    { minorAmount: 100, currency: 'ZZZ' },
    { minorAmount: 100, currency: 'gbp' },
    { minorAmount: Number.MAX_SAFE_INTEGER + 1, currency: 'GBP' },
  ])('rejects unsupported identifiers and unsafe amounts', (money) => {
    expect(() => formatMoney(money)).toThrow(MoneyDisplayError)
  })
})
