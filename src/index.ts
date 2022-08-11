import { Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore, sleep, getCurrentOrders, getConfigOrders } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';
import { CONFIG_URL } from './consts';
import { isMakeMarketNeeded } from './checks';
import { MarketMakerParams, ProgramOptions } from './interface';


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
    coinName,
    baseQuantityToken,
    baseQuantityUSDC, 
    orderDelayMs,
    network
  } = params;
  while (true) {    
    const config = await getConfig();

    const batch = market.createBatchAction();

    const indexPrice = await getPrice(coinName);

    const openOrders = await tonic.getOpenOrders(market.id);  
    const currentOrders = getCurrentOrders(openOrders);
    const configOrders = getConfigOrders(config, indexPrice, baseQuantityToken, baseQuantityUSDC);

    if (isMakeMarketNeeded(currentOrders, configOrders, config.priceThreshold, config.quantityThreshold)) {
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
    baseQuantityToken: Number,
    baseQuantityUSDC: Number,
    // @ts-ignore
    network: String,
    orderDelayMs: Number,
  });
  const keyStore = await getKeystore();
  const near = new Near({ ...getNearConfig(args.network), keyStore });
  const account = await near.account(args.nearAccountId);
  const tonic = new Tonic(account, args.tonicContractId);
  const market = await tonic.getMarket(args.marketId);

  await makeMarket({ tonic, market, coinName: args.assetName, ...args });
}

main();
