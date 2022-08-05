import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore } from './util';
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
  coinGeckoName: string;
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
    coinGeckoName,  // tokenId
    baseQuantity, 
    orderDelayMs,
    network
  } = params;
  while (true) {
    const indexPrice = await getPrice(coinGeckoName);

    const batch = market.createBatchAction();
    batch.cancelAllOrders();

    // TODO
    const delta = 10000;
    const bid = parseFloat((indexPrice * (1 - delta)).toFixed(market.quoteDecimals));
    const ask = parseFloat((indexPrice * (1 + delta)).toFixed(market.quoteDecimals));
    batch.newOrder({
      quantity: baseQuantity,
      side: 'Buy',
      limitPrice: bid,
      orderType: 'Limit',
    });
    batch.newOrder({
      quantity: baseQuantity,
      side: 'Sell',
      limitPrice: ask,
      orderType: 'Limit',
    });

    console.log(`Making market at mid: ${indexPrice} buying at ${bid} selling at ${ask}`);

    try {
      console.log('Sending transaction...');
      const { executionOutcome: tx, response: _ } = await tonic.executeBatch(batch);
      console.log('Transaction', getExplorerUrl(network, 'transaction', tx.transaction_outcome.id));
      console.log(`Gas usage: ${getGasUsage(tx)}`);
    } catch (e) {
      console.log('Order failed', e);
    }
    console.log(`Waiting ${orderDelayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, orderDelayMs));
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
  await makeMarket({ tonic, market, config, coinGeckoName: args.assetName, ...args });
}

main();
