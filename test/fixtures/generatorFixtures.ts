import type {
  TransactionDetailResponse,
  TransactionReceiptResponse
} from '../../src/generator/types.js';

export const mainTransactionId =
  '0x1111111111111111111111111111111111111111111111111111111111111111';

export const transferEventTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const pingEventTopic =
  '0xfd8d0c1dc3ab254ec49463a1192bb2423b3b851adedec1aa94dcd362dc063c9d';

export const transferFunctionSelector = '0xa9059cbb';

export const transferAbiJson = JSON.stringify(
  [
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'from', type: 'address' },
        { indexed: true, name: 'to', type: 'address' },
        { indexed: false, name: 'value', type: 'uint256' }
      ],
      name: 'Transfer',
      type: 'event'
    }
  ],
  null,
  2
);

export const signatureListText = [
  'Ping(address,uint256)',
  'transfer(address,uint256)'
].join('\n');

export const mainTransactionDetail: TransactionDetailResponse = {
  id: mainTransactionId,
  origin: '0x0000000000000000000000000000000000000011',
  gasPayer: '0x0000000000000000000000000000000000000011',
  blockRef: '0x00000000',
  nonce: '1',
  expiration: 32,
  gasPriceCoef: 0,
  gas: 75000,
  size: 420,
  clauses: [
    {
      to: '0x000000000000000000000000000000000000cafe',
      value: '0',
      data:
        '0xa9059cbb000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000003e8'
    },
    {
      to: '0x000000000000000000000000000000000000cafe',
      value: '0',
      data:
        '0xa9059cbb000000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000007d0'
    }
  ],
  meta: {
    blockID: '0xblock-main',
    blockNumber: 42,
    blockTimestamp: 1_716_000_000
  }
};

export const mainTransactionReceipt: TransactionReceiptResponse = {
  gasUsed: 68_000,
  gasPayer: '0x0000000000000000000000000000000000000011',
  paid: '1000',
  reward: '10',
  reverted: false,
  outputs: [
    {
      contractAddress: null,
      events: [
        {
          address: '0x000000000000000000000000000000000000cafe',
          topics: [
            transferEventTopic,
            '0x0000000000000000000000000000000000000000000000000000000000000011',
            '0x0000000000000000000000000000000000000000000000000000000000000022'
          ],
          data: '0x00000000000000000000000000000000000000000000000000000000000003e8'
        }
      ],
      transfers: [
        {
          sender: '0x0000000000000000000000000000000000000011',
          recipient: '0x0000000000000000000000000000000000000022',
          amount: '1000'
        }
      ]
    },
    {
      contractAddress: null,
      events: [
        {
          address: '0x000000000000000000000000000000000000cafe',
          topics: [pingEventTopic],
          data: '0x'
        }
      ],
      transfers: [
        {
          sender: '0x0000000000000000000000000000000000000011',
          recipient: '0x0000000000000000000000000000000000000022',
          amount: '2000'
        }
      ]
    }
  ],
  meta: {
    blockID: '0xblock-main',
    blockNumber: 42,
    blockTimestamp: 1_716_000_000,
    txID: mainTransactionId,
    txOrigin: '0x0000000000000000000000000000000000000011'
  }
};
