import {getExplorerBaseUrl} from "@tonic-foundation/config";
import {keyStores} from "near-api-js";
import {FinalExecutionOutcome} from "near-api-js/lib/providers";
import {homedir} from "os";
import {Config, Order} from "./types";
import {QUANTITY_FACTOR, PRICE_FACTOR} from "./consts";
import path from "path";

export const getGasUsage = (o: FinalExecutionOutcome) => {
  const receiptGas = o.transaction_outcome.outcome.gas_burnt;
  const actionGas = o.receipts_outcome.reduce(
    (acc, x) => acc + x.outcome.gas_burnt,
    0
  );
  return `${((receiptGas + actionGas) / Math.pow(10, 12)).toFixed(2)} TGas`;
};

export const getKeystore = async () => {
  const HOME_DIR = homedir();
  const CREDENTIALS_DIR = ".near-credentials";
  const credentialsPath = path.join(HOME_DIR, CREDENTIALS_DIR);

  return new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);
};

export async function sleep(n: number) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

export function getExplorerUrl(
  network: "mainnet" | "testnet",
  type: "account" | "transaction",
  id: string
) {
  const baseUrl = getExplorerBaseUrl(network);
  if (type === "account") return `${baseUrl}/address/${id}`
  if (type === "transaction") return `${baseUrl}/txns/${id}`;
  throw new Error("Invalid resource type");
}

export const openOrdersToOrderBook = (openOrders: any) => {
  let sell = [];
  let buy = [];

  for (let order of openOrders) {
    if (order.side === "Sell") {
      sell.push({
        quantity: order.remainingQuantity / QUANTITY_FACTOR,
        price: order.limitPrice / PRICE_FACTOR,
      });
    } else if (order.side === "Buy") {
      buy.push({
        quantity: order.remainingQuantity / QUANTITY_FACTOR,
        price: order.limitPrice / PRICE_FACTOR,
      });
    }
  }

  return {sell, buy};
};

export const getOrderBookFromConfig = (
  config: Config,
  indexPrice: number,
  baseQuantityToken: number,
  baseQuantityUSDC: number
) => {
  let buy: Order[] = [];
  let sell: Order[] = [];

  config.bids.forEach(item => {
    const bidQuantity = baseQuantityToken * item.quantity;
    const bidPrice = indexPrice * (1 + item.spread);
    sell.push({ quantity: bidQuantity, price: bidPrice });
  });

  config.asks.forEach(item => {
    const totalUSDC = baseQuantityUSDC * item.quantity;
    const askPrice = indexPrice * (1 - item.spread); // price per token
    const askQuantity = parseFloat((totalUSDC / askPrice).toFixed(1));

    buy.push({quantity: askQuantity, price: askPrice});
  });

  return {buy, sell};
};
