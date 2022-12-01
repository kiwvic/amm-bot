import { Market, Tonic } from "@tonic-foundation/tonic";

export interface ProgramOptions {
  network: "mainnet" | "testnet";
  nearAccountId: string;
  privateKey: string;
  tonicContractId: string;
  marketId: string;
  assetName: string;
  baseQuantity: number;
  quoteQuantity: number
  orderDelayMs: number;

  hft: boolean;
  hftChance: number;
  orderPricePercentHft: number;
  randomTokenMin: number;
  randomTokenMax: number;
  mandatoryIterationRecharge: number;
  sameOrderStreak: number;
  priceChangeThresholdPercent: number
}

export interface MarketMakerParams {
  tonic: Tonic;
  market: Market;
  assetName: string;
  baseQuantity: number;
  quoteQuantity: number;
  orderDelayMs: number;
  network: "mainnet" | "testnet";
}

interface OrderConfig {
  quantity: number;
  spread: number;
}

export interface Config {
  bids: Array<OrderConfig>;
  asks: Array<OrderConfig>;
  priceThreshold: number;
  quantityThreshold: number;
}

export interface Order {
  quantity: number;
  price: number;
}

export interface OrderBook {
  buy: Array<Order>;
  sell: Array<Order>;
}
