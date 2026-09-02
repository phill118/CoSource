import { createMoney } from './money'
import { currencyFractionDigits, MoneyDisplayError } from './money-display'

export class MoneyInputError extends Error {}

export function formatMoneyInput(minorAmount: number, currency: string): string {
  if (!Number.isSafeInteger(minorAmount) || minorAmount < 0) throw new MoneyInputError('Amount must be a non-negative safe integer')
  let fractionDigits: number
  try { fractionDigits = currencyFractionDigits(currency) }
  catch (error) { throw new MoneyInputError(error instanceof MoneyDisplayError ? error.message : 'Currency is invalid') }
  const digits = minorAmount.toString()
  if (fractionDigits === 0) return digits
  const padded = digits.padStart(fractionDigits + 1, '0')
  return `${padded.slice(0, -fractionDigits)}.${padded.slice(-fractionDigits)}`
}

export function parseMoneyInput(input: string, currency: string) {
  let fractionDigits: number
  try { fractionDigits = currencyFractionDigits(currency) }
  catch (error) { throw new MoneyInputError(error instanceof MoneyDisplayError ? error.message : 'Currency is invalid') }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(input.trim())
  if (!match) throw new MoneyInputError('Amount must be a non-negative decimal')
  const whole = match[1]!
  const fraction = match[2] ?? ''
  if (fraction.length > fractionDigits || (fractionDigits === 0 && fraction.length > 0)) throw new MoneyInputError('Amount has too many fraction digits')

  const minorText = `${whole}${fraction.padEnd(fractionDigits, '0')}`.replace(/^0+(?=\d)/, '')
  const minor = BigInt(minorText)
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyInputError('Amount exceeds the safe integer range')
  return createMoney(Number(minor), currency)
}
