import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import BN from 'bn.js';
import { getExplorerUrl, getGasUsage, getKeystore, sleep, getCurrentOrders } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();
const CONFIG_URL = process.env.CONFIG_URL;
const TOKEN_DECIMALS = 18;
const PRICE_DECIMALS = 7;

const QUANTITY_FACTOR = Math.pow(10, TOKEN_DECIMALS - 1);
const PRICE_FACTOR = Math.pow(10, PRICE_DECIMALS - 1);

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

export const getConfigOrders = (config: any, indexPrice: any, baseQuantity: any) => {
  let buy = new Array();
  let sell = new Array();

  for (let i = 0; i < config.bids.length; i++) {
    const bidQuantity = new BN(baseQuantity * config.bids[i].quantity * QUANTITY_FACTOR);
    const bidPrice = new BN((indexPrice * (1 + config.bids[i].spread)) * PRICE_FACTOR);

    sell.push({"quantity": bidQuantity, "price": bidPrice});
  }

  for (let i = 0; i < config.asks.length; i++) {
    const askQuantity = new BN(baseQuantity * config.asks[i].quantity * QUANTITY_FACTOR);
    const askPrice = new BN((indexPrice * (1 - config.asks[i].spread)) * PRICE_FACTOR);

    buy.push({"quantity": askQuantity, "price": askPrice});
  }

  return { buy, sell }
}

const amountOfOrdersChanged = (currentOrders: any, configOrders: any) => {
  return currentOrders.buy.length !== configOrders.buy.length ||
         currentOrders.sell.length !== configOrders.sell.length;
}

const priceChanged = (currentOrders: any, configOrders: any) => {
  return true;
}

const quantityChanged = (currentOrders: any, configOrders: any) => {
  return true;
}

const isMakeMarketNeeded = (currentOrders: any, configOrders: any, indexPrice: any) => {
  return amountOfOrdersChanged(currentOrders, configOrders) ||
         priceChanged(currentOrders, configOrders) ||
         quantityChanged(currentOrders, configOrders) 
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
    const indexPrice = await getPrice(coinName);

    const currentOrders = await getCurrentOrders(tonic, market.id);
    const configOrders = getConfigOrders(config, indexPrice, baseQuantity);

    if (isMakeMarketNeeded(currentOrders, configOrders, indexPrice)) {
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
    }

    console.log(`Waiting ${orderDelayMs}ms`);
    await sleep(orderDelayMs);
    /*
    const {bids, asks} = await tonic.getOrderbook(market.id);

    for (let i = 0; i < bids.length; i++) {
      const bidsQuantityDelta = Math.abs(bids[i][1] - config.bids[i].quantity);
      const asksQuantityDelta = Math.abs(asks[i][1] - config.asks[i].quantity);

      const bidsSpreadDelta = Math.abs(bids[i][0] - config.bids[i].spread);
      const asksSpreadDelta = Math.abs(asks[i][0] - config.asks[i].spread);

      if (
        (bidsSpreadDelta < config.spreadDelta && asksSpreadDelta < config.spreadDelta) ||
        (bidsQuantityDelta < config.quantityDelta && asksQuantityDelta < config.quantityDelta)
        ) {
        return
      }
    }
    */
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
