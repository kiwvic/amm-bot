import { readFileSync, writeFileSync, promises as fsPromises, appendFileSync } from 'fs';
import {QUANTITY_FACTOR, PRICE_FACTOR, PRICE_CONFIG_FIXED, Buy, Sell, LOGFILE} from "./consts";
import {getExplorerBaseUrl} from "@tonic-foundation/config";
import {FinalExecutionOutcome} from "near-api-js/lib/providers";
import {Config, Order, OrderTypeStreak} from "./types";
import {OpenLimitOrder, Tonic} from "@tonic-foundation/tonic";
import {getNearConfig} from "@tonic-foundation/config";
import {keyStores, KeyPair, connect} from "near-api-js";
import { join } from 'path';
import axios from "axios";
import BN from "bn.js";


export const getPrice = async (tokenId: string) => {
  const client = axios.create({
    baseURL: "https://indexer.ref.finance/",
  });
  
  return client.get("get-token-price", {params: {token_id: tokenId}})
    .then((res) => res.data.price) as unknown as number;
};

export const getOrderConfig = () => {
  return require("../order-config.json");
};

export const getProgramConfig = () => {
  return require("../config.json");
};

export const getRandomArbitrary = (min: number, max: number) => {
  return Math.round(Math.random() * (max - min) + min);
}

export const getRandomDecimal = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

export const toFixedNoRound = (number: number, precision: number): number => {
  const factor = Math.pow(10, precision);
  return Math.floor(number * factor) / factor;
}

export const getOrderType = (type_: number) => {
  if (type_ == Buy) return "Buy";
  return "Sell";
}

export async function sleep(n: number) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

const relDiff = (a: any, b: any) => {
  return 100*((a-b)/((a+b)/2));
}


export const getGasUsage = (o: FinalExecutionOutcome) => {
  const receiptGas = o.transaction_outcome.outcome.gas_burnt;
  const actionGas = o.receipts_outcome.reduce(
    (acc, x) => acc + x.outcome.gas_burnt,
    0
  );
  return `${((receiptGas + actionGas) / Math.pow(10, 12)).toFixed(2)} TGas`;
};


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
    const bidPrice = parseFloat((indexPrice * (1 + item.spread)).toFixed(PRICE_CONFIG_FIXED));
    sell.push({ quantity: bidQuantity, price: bidPrice });
  });

  config.asks.forEach(item => {
    const totalUSDC = baseQuantityUSDC * item.quantity;
    const askPrice = parseFloat((indexPrice * (1 - item.spread)).toFixed(PRICE_CONFIG_FIXED)); // price per token
    const askQuantity = parseFloat((totalUSDC / askPrice).toFixed(1));

    buy.push({quantity: askQuantity, price: askPrice});
  });

  return {buy, sell};
};


export const getTonic = async (
    network: "mainnet" | "testnet", 
    accountId: string, privateKey: string, 
    contractId: string
  ) => {
  const keyStore = new keyStores.InMemoryKeyStore();
  const nearConfig = {...getNearConfig(network), keyStore: keyStore};
  const keyPair = KeyPair.fromString(privateKey);
  await nearConfig.keyStore?.setKey(nearConfig.networkId, accountId, keyPair);
  const near = await connect(nearConfig);
  const account = await near.account(accountId);

  return new Tonic(account, contractId);
}

export const getBestPrice = (orders: OpenLimitOrder[]) => {
  let bestAsk = {limitPrice: new BN("0")};
  let bestBid = {limitPrice: new BN("1000000000")};

  for (let order of orders) {
    if (order.side == "Buy" && order.limitPrice.gt(bestAsk.limitPrice)) {
      bestAsk = order;
    } else if (order.side == "Sell" && order.limitPrice.lt(bestBid.limitPrice)) {
      bestBid = order;
    }
  }

  return {
    bestAskPrice: bestAsk.limitPrice.toNumber() / PRICE_FACTOR, 
    bestBidPrice: bestBid.limitPrice.toNumber() / PRICE_FACTOR
  };
}

export const calculateBestPrice = (orderType: number, bestBid: number, bestAsk: number) => {
  const config = getProgramConfig()

  // TODO
  let price = orderType == Buy ? bestAsk : bestBid;

  if (orderType == Sell) {
      price -= price * (getRandomDecimal(0, config.orderPricePercentHft) / 100);
  } else {
      price += price * (getRandomDecimal(0, config.orderPricePercentHft) / 100);
  }

  return toFixedNoRound(price, PRICE_CONFIG_FIXED);
}


export const orderTypeChangeIsNeeded = (orderType: number, orderTypeStreak: OrderTypeStreak) => {
  const config = getProgramConfig()

  if (orderTypeStreak.type == orderType && orderTypeStreak.counter >= config.sameOrderStreak) {
    orderTypeStreak.counter = 0;
    return true;
  } else if (orderTypeStreak.type != orderType || orderTypeStreak.counter >= config.sameOrderStreak) {
    orderTypeStreak.type = orderType;
    orderTypeStreak.counter = 0;
  } else {
    orderTypeStreak.counter += 1;
  }

  return false;
}


export const changeIndexPrice = (price: number, newPrice: number) => { 
  const config = getProgramConfig()

  let priceDiff = relDiff(newPrice, price);

  if (priceDiff > 0 && priceDiff > config.priceChangeThresholdPercent) {
    price += (price * (config.priceChangeThresholdPercent / 100));
  } else if (priceDiff < 0 && priceDiff < (-1) * config.priceChangeThresholdPercent) {
    price -= (price * (config.priceChangeThresholdPercent / 100));
  }

  return price;
}

export function log(data: any) {
  appendFileSync(
    join(__dirname, LOGFILE), 
    `[${(new Date()).toLocaleString()}] ${data}\n`
  );
}
