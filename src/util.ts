import { getExplorerBaseUrl } from '@tonic-foundation/config';
import { keyStores } from 'near-api-js';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { homedir } from 'os';
import { Config } from './interface';
import { QUANTITY_FACTOR, PRICE_FACTOR } from './consts'

export const getGasUsage = (o: FinalExecutionOutcome) => {
  const receiptGas = o.transaction_outcome.outcome.gas_burnt;
  const actionGas = o.receipts_outcome.reduce((acc, x) => acc + x.outcome.gas_burnt, 0);
  return `${((receiptGas + actionGas) / Math.pow(10, 12)).toFixed(2)} TGas`;
};

export const getKeystore = async () => {
  const HOME_DIR = homedir();
  const CREDENTIALS_DIR = '.near-credentials';
  const credentialsPath = require('path').join(HOME_DIR, CREDENTIALS_DIR);

  return new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);
};

export async function sleep(n: number) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

export function getExplorerUrl(network: 'mainnet' | 'testnet', type: 'account' | 'transaction', id: string) {
  const baseUrl = getExplorerBaseUrl(network);
  if (type === 'account') {
    return `${baseUrl}/address/${id}`;
  }
  if (type === 'transaction') {
    return `${baseUrl}/txns/${id}`;
  }
  throw new Error('Invalid resource type');
}

export const getCurrentOrders = (openOrders: any) => {
  let sell = new Array();
  let buy = new Array();

  for (let order of openOrders) {
    if (order.side === "Sell") {
      sell.push({"quantity": order.remainingQuantity / QUANTITY_FACTOR, "price": order.limitPrice / PRICE_FACTOR });
    } 
    else if (order.side === "Buy") {
      buy.push({"quantity": order.remainingQuantity / QUANTITY_FACTOR, "price": order.limitPrice / PRICE_FACTOR });
    }
  }

  return { sell, buy }
}

export const getConfigOrders = (config: Config, indexPrice: number, baseQuantityToken: number, baseQuantityUSDC: number) => {
  let buy = new Array();
  let sell = new Array();

  for (let i = 0; i < config.bids.length; i++) {
    const bidQuantity = baseQuantityToken * config.bids[i].quantity;
    const bidPrice = indexPrice * (1 + config.bids[i].spread);

    sell.push({"quantity": bidQuantity, "price": bidPrice});
  }

  for (let i = 0; i < config.asks.length; i++) {
    const askQuantity = baseQuantityUSDC * config.bids[i].quantity;
    const askPrice = indexPrice * (1 - config.asks[i].spread);

    buy.push({"quantity": askQuantity, "price": askPrice});
  }

  return { buy, sell }
}
