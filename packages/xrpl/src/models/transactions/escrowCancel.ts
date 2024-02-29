import { ValidationError } from '../../errors'

import { BaseTransaction, validateBaseTransaction } from './common'

/**
 * Return escrowed amount to the sender.
 *
 * @category Transaction Models
 */
export interface EscrowCancel extends BaseTransaction {
  TransactionType: 'EscrowCancel'
  /** Address of the source account that funded the escrow payment. */
  Owner: string
  /**
   * Transaction sequence (or Ticket  number) of EscrowCreate transaction that.
   * created the escrow to cancel.
   */
  OfferSequence?: number
  /**
   * The ID of the Escrow ledger object to cancel as a 64-character hexadecimal
   * string.
   */
  EscrowID?: string
}

/**
 * Verify the form and type of an EscrowCancel at runtime.
 *
 * @param tx - An EscrowCancel Transaction.
 * @throws When the EscrowCancel is Malformed.
 */
export function validateEscrowCancel(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  if (tx.Owner === undefined) {
    throw new ValidationError('EscrowCancel: missing Owner')
  }

  if (typeof tx.Owner !== 'string') {
    throw new ValidationError('EscrowCancel: Owner must be a string')
  }

  if (tx.OfferSequence === undefined && tx.EscrowID === undefined) {
    throw new ValidationError(
      'EscrowCancel: must include OfferSequence or EscrowID',
    )
  }

  if (tx.OfferSequence !== undefined && typeof tx.OfferSequence !== 'number') {
    throw new ValidationError('EscrowCancel: invalid OfferSequence')
  }

  if (tx.EscrowID !== undefined && typeof tx.EscrowID !== 'string') {
    throw new ValidationError('EscrowCancel: invalid EscrowID')
  }
}
