import {
  xAddressToClassicAddress,
  isValidXAddress,
} from '@transia/ripple-address-codec'
import { encode } from '@transia/ripple-binary-codec'

import type { Client } from '..'
import { ValidationError, XrplError } from '../errors'
import { AccountInfoRequest, AccountObjectsRequest } from '../models/methods'
import { Transaction } from '../models/transactions'
import { setTransactionFlagsToNumber } from '../models/utils/flags'

import { getFeeEstimateXrp } from './getFeeXrp'

// Expire unconfirmed transactions after 20 ledger versions, approximately 1 minute, by default
const LEDGER_OFFSET = 20
const RESTRICTED_NETWORKS = 1024
interface ClassicAccountAndTag {
  classicAccount: string
  tag: number | false | undefined
}

/**
 * Autofills fields in a transaction. This will set `Sequence`, `Fee`,
 * `lastLedgerSequence` according to the current state of the server this Client
 * is connected to. It also converts all X-Addresses to classic addresses and
 * flags interfaces into numbers.
 *
 * @param this - A client.
 * @param transaction - A {@link Transaction} in JSON format
 * @param signersCount - The expected number of signers for this transaction.
 * Only used for multisigned transactions.
 * @returns The autofilled transaction.
 */
async function autofill<T extends Transaction>(
  this: Client,
  transaction: T,
  signersCount?: number,
): Promise<T> {
  const tx = { ...transaction }

  setValidAddresses(tx)

  setTransactionFlagsToNumber(tx)
  const promises: Array<Promise<void>> = []
  if (this.networkID > RESTRICTED_NETWORKS && tx.NetworkID == null) {
    tx.NetworkID = this.networkID
  }
  if (tx.Sequence == null) {
    promises.push(setNextValidSequenceNumber(this, tx))
  }
  if (tx.LastLedgerSequence == null) {
    promises.push(setLatestValidatedLedgerSequence(this, tx))
  }
  if (tx.TransactionType === 'AccountDelete') {
    promises.push(checkAccountDeleteBlockers(this, tx))
  }
  await Promise.all(promises).then(() => tx)

  if (tx.Fee == null) {
    await calculateFeePerTransactionType(this, tx, signersCount)
  }
  return tx
}

function setValidAddresses(tx: Transaction): void {
  validateAccountAddress(tx, 'Account', 'SourceTag')
  // eslint-disable-next-line @typescript-eslint/dot-notation -- Destination can exist on Transaction
  if (tx['Destination'] != null) {
    validateAccountAddress(tx, 'Destination', 'DestinationTag')
  }

  // DepositPreauth:
  convertToClassicAddress(tx, 'Authorize')
  convertToClassicAddress(tx, 'Unauthorize')
  // EscrowCancel, EscrowFinish:
  convertToClassicAddress(tx, 'Owner')
  // SetRegularKey:
  convertToClassicAddress(tx, 'RegularKey')
}

function validateAccountAddress(
  tx: Transaction,
  accountField: string,
  tagField: string,
): void {
  // if X-address is given, convert it to classic address
  const { classicAccount, tag } = getClassicAccountAndTag(tx[accountField])
  // eslint-disable-next-line no-param-reassign -- param reassign is safe
  tx[accountField] = classicAccount

  if (tag != null && tag !== false) {
    if (tx[tagField] && tx[tagField] !== tag) {
      throw new ValidationError(
        `The ${tagField}, if present, must match the tag of the ${accountField} X-address`,
      )
    }
    // eslint-disable-next-line no-param-reassign -- param reassign is safe
    tx[tagField] = tag
  }
}

function getClassicAccountAndTag(
  Account: string,
  expectedTag?: number,
): ClassicAccountAndTag {
  if (isValidXAddress(Account)) {
    const classic = xAddressToClassicAddress(Account)
    if (expectedTag != null && classic.tag !== expectedTag) {
      throw new ValidationError(
        'address includes a tag that does not match the tag specified in the transaction',
      )
    }
    return {
      classicAccount: classic.classicAddress,
      tag: classic.tag,
    }
  }
  return {
    classicAccount: Account,
    tag: expectedTag,
  }
}

function convertToClassicAddress(tx: Transaction, fieldName: string): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- assignment is safe
  const account = tx[fieldName]
  if (typeof account === 'string') {
    const { classicAccount } = getClassicAccountAndTag(account)
    // eslint-disable-next-line no-param-reassign -- param reassign is safe
    tx[fieldName] = classicAccount
  }
}

async function setNextValidSequenceNumber(
  client: Client,
  tx: Transaction,
): Promise<void> {
  const request: AccountInfoRequest = {
    command: 'account_info',
    account: tx.Account,
    ledger_index: 'current',
  }
  const data = await client.request(request)
  // eslint-disable-next-line no-param-reassign, require-atomic-updates -- param reassign is safe with no race condition
  tx.Sequence = data.result.account_data.Sequence
}

async function calculateFeePerTransactionType(
  client: Client,
  tx: Transaction,
  signersCount = 0,
): Promise<void> {
  const copyTx = { ...tx }
  copyTx.SigningPubKey = ``
  copyTx.Fee = `0`
  const tx_blob = encode(copyTx)
  // eslint-disable-next-line require-atomic-updates, no-param-reassign -- ignore
  tx.Fee = await getFeeEstimateXrp(client, tx_blob, signersCount)
}

async function setLatestValidatedLedgerSequence(
  client: Client,
  tx: Transaction,
): Promise<void> {
  const ledgerSequence = await client.getLedgerIndex()
  // eslint-disable-next-line no-param-reassign -- param reassign is safe
  tx.LastLedgerSequence = ledgerSequence + LEDGER_OFFSET
}

async function checkAccountDeleteBlockers(
  client: Client,
  tx: Transaction,
): Promise<void> {
  const request: AccountObjectsRequest = {
    command: 'account_objects',
    account: tx.Account,
    ledger_index: 'validated',
    deletion_blockers_only: true,
  }
  const response = await client.request(request)
  return new Promise((resolve, reject) => {
    if (response.result.account_objects.length > 0) {
      reject(
        new XrplError(
          `Account ${tx.Account} cannot be deleted; there are Escrows, PayChannels, RippleStates, or Checks associated with the account.`,
          response.result.account_objects,
        ),
      )
    }
    resolve()
  })
}

export default autofill
