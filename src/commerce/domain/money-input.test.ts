import { describe, expect, it } from 'vitest'
import { MoneyInputError, parseMoneyInput } from './money-input'

describe('exact decimal money input', () => {
  it.each([
    ['120.45', 'GBP', 12045], ['00120.450', 'KWD', 120450], ['120', 'JPY', 120], ['0.00', 'GBP', 0], ['120.10', 'GBP', 12010],
  ])('parses %s using real %s fraction semantics', (input, currency, minorAmount) => {
    expect(parseMoneyInput(input, currency)).toEqual({ minorAmount, currency })
  })
  it.each([
    ['', 'GBP'], ['1.', 'GBP'], ['1.234', 'GBP'], ['1.0', 'JPY'], ['-1', 'GBP'], ['1,000', 'GBP'], ['abc', 'GBP'], ['1.00', 'ZZZ'],
  ])('rejects malformed, over-precise, negative, or unsupported input', (input, currency) => {
    expect(() => parseMoneyInput(input, currency)).toThrow(MoneyInputError)
  })
  it('rejects exact integer overflow without floating-point arithmetic', () => {
    expect(() => parseMoneyInput('90071992547409.92', 'GBP')).toThrow(MoneyInputError)
  })
})
