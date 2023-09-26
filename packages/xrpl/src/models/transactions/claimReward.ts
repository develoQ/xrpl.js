import { ValidationError } from '../../errors'

import { BaseTransaction, validateBaseTransaction } from './common'

/**
 * ClaimReward is a transaction model that allows an account to claim rewards.
 *
 * @category Transaction Models
 */
export interface ClaimReward extends BaseTransaction {
  TransactionType: 'ClaimReward'
  /** The unique address of the issuer where the reward.c hook is installed. */
  Issuer?: string
}

/**
 * Verify the form and type of an ClaimReward at runtime.
 *
 * @param tx - An ClaimReward Transaction.
 * @throws When the ClaimReward is Malformed.
 */
export function validateClaimReward(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  if (tx.Issuer !== undefined && typeof tx.Issuer !== 'string') {
    throw new ValidationError('ClaimReward: invalid Issuer')
  }
}
