import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore, sleep, getCurrentOrders, getConfigOrders } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';
import { CONFIG_URL } from './consts'
import { isMakeMarketNeeded } from './checks'


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
    .then((res) => res.data.price) as unknown as number;
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
    const indexPrice = await getPrice(coinName);

    const openOrders = await tonic.getOpenOrders(market.id);  

    const currentOrders = getCurrentOrders(tonic, openOrders);
    const configOrders = getConfigOrders(config, indexPrice, baseQuantity);

    if (isMakeMarketNeeded(currentOrders, configOrders, config.spreadDelta, config.quantityDelta)) {
      const batch = market.createBatchAction();
      batch.cancelAllOrders();

      for (const bid of configOrders.sell) {
        batch.newOrder({
          quantity: bid.quantity,
          side: 'Sell',
          limitPrice: bid.price,
          orderType: 'Limit',
        });
      }

      for (const ask of configOrders.buy) {
        batch.newOrder({
          quantity: ask.quantity,
          side: 'Buy',
          limitPrice: ask.price,
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
