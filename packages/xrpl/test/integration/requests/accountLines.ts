import { assert } from 'chai'
import omit from 'lodash/omit'
import partial from 'lodash/partial'
import { AccountLinesRequest } from 'xrpl-local'

import serverUrl from '../serverUrl'
import { setupClient, teardownClient } from '../setup'

// how long before each test case times out
const TIMEOUT = 20000

describe('account_lines', function () {
  this.timeout(TIMEOUT)

  beforeEach(partial(setupClient, serverUrl))
  afterEach(teardownClient)

  it('base', async function () {
    const request: AccountLinesRequest = {
      command: 'account_lines',
      account: this.wallet.classicAddress,
      strict: true,
      ledger_index: 'validated',
    }
    const response = await this.client.request(request)
    const expected = {
      id: 0,
      result: {
        account: this.wallet.classicAddress,
        ledger_hash:
          '0C09AAFA88AC1A616058220CF33269788D3985DAA6F2386196D4A7404252BB61',
        ledger_index: 1074,
        lines: [],
        validated: true,
      },
      type: 'response',
    }
    assert.equal(response.type, expected.type)
    assert.equal(typeof response.result.ledger_hash, 'string')
    assert.equal(typeof response.result.ledger_index, 'number')
    assert.deepEqual(
      omit(response.result, ['ledger_hash', 'ledger_index']),
      omit(expected.result, ['ledger_hash', 'ledger_index']),
    )
  })
})
