import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore, sleep } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();
const CONFIG_URL = process.env.CONFIG_URL

export interface ProgramOptions {
  marketId: string;
  nearAccountId: string;
  tonicContractId: string;
  assetName: string;
  baseQuantity: number;
  network: 'mainnet' | 'testnet';
  orderDelayMs: number;
}

export interface MarketMakerParams {
  tonic: Tonic;
  market: Market;
  config: any;
  coinName: string;
  baseQuantity: number;
  orderDelayMs: number;
  network: 'mainnet' | 'testnet';
}

const client = axios.create({
  baseURL: 'https://indexer.ref.finance/',
});

export const getPrice = async (tokenId: string) => {
  return client
    .get('get-token-price', {
      params: {
        token_id: tokenId
      },
    })
    .then((res) => res.data[tokenId]['usd']) as unknown as number;
};

export const getConfig = async () => {
  return (await axios.get(CONFIG_URL!)).data;
}


async function makeMarket(params: MarketMakerParams) {
  const {
    tonic,
    market,
    config,
    coinName,
    baseQuantity, 
    orderDelayMs,
    network
  } = params;
  while (true) {
    // TODO get current percents on market, compare them with config
    // TODO raise error if length arent equal
    
    const mockBids = new Array(6);
    const mockAsks = new Array(6);

    for (let i = 0; i < mockBids.length; i++) {
      const bidsSpreadDelta = Math.abs(mockBids[i].spread - config.bids[i].spread);
      const asksSpreadDelta = Math.abs(mockAsks[i].spread - config.asks[i].spread);

      if (
        bidsSpreadDelta < config.spreadDelta && 
        asksSpreadDelta < config.quantityDelta
        ) {
        return
      }
    }

    const indexPrice = await getPrice(coinName);

    const batch = market.createBatchAction();
    batch.cancelAllOrders();

    for (const bid_ of config.bids) {
      const bid = parseFloat((indexPrice * (1 - bid_.spread)).toFixed(market.quoteDecimals));
      const quantity = baseQuantity * bid_.quantity;

      batch.newOrder({
        quantity: quantity,
        side: 'Buy',
        limitPrice: bid,
        orderType: 'Limit',
      });
    }

    for (const ask_ of config.asks) {
      const ask = parseFloat((indexPrice * (1 + ask_.spread)).toFixed(market.quoteDecimals));
      const quantity = baseQuantity * ask_.quantity;

      batch.newOrder({
        quantity: quantity,
        side: 'Sell',
        limitPrice: ask,
        orderType: 'Limit',
      });
    }

    try {
      console.log('Sending transaction...');
      const { executionOutcome: tx, response: _ } = await tonic.executeBatch(batch);
      console.log('Transaction', getExplorerUrl(network, 'transaction', tx.transaction_outcome.id));
      console.log(`Gas usage: ${getGasUsage(tx)}`);
    } catch (e) {
      console.log('Order failed', e);
    }
    console.log(`Waiting ${orderDelayMs}ms`);
    await sleep(orderDelayMs);
  }
}

async function main() {
  const args = parse<ProgramOptions>({
    marketId: String,
    nearAccountId: String,
    tonicContractId: String,
    assetName: String,
    baseQuantity: Number,
    // @ts-ignore
    network: String,
    orderDelayMs: Number,
  });
  const config = await getConfig();
  const keyStore = await getKeystore();
  const near = new Near({ ...getNearConfig(args.network), keyStore });
  const account = await near.account(args.nearAccountId);
  const tonic = new Tonic(account, args.tonicContractId);
  const market = await tonic.getMarket(args.marketId);

  await makeMarket({ tonic, market, config, coinName: args.assetName, ...args });
}

main();
