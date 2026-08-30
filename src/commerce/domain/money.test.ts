import { describe, expect, it } from 'vitest'
import { assertSameCurrency, createMoney } from './money'

describe('canonical money', () => {
  it('preserves exact provider minor units and currency', () => {
    expect(createMoney(2900, 'GBP')).toEqual({ minorAmount: 2900, currency: 'GBP' })
  })

  it('refuses silent cross-currency arithmetic', () => {
    expect(() =>
      assertSameCurrency(createMoney(1000, 'GBP'), createMoney(1000, 'USD')),
    ).toThrow('explicit FX source')
  })

  it('rejects floating point minor units', () => {
    expect(() => createMoney(10.5, 'GBP')).toThrow('safe integer')
  })
})
