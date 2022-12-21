import { Tonic, ExchangeBalances } from "@tonic-foundation/tonic";
import { getProgramConfig } from "./util";
import BN from "bn.js"

export interface ProgramOptions {
  network: "mainnet" | "testnet";

  nearAccountId: string;
  privateKey: string;

  nearAccountIdHFT: string;
  privateKeyHFT: string;

  baseName: string;
  quoteName: string;

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
  tonicHFT: Tonic;
  marketId: string;
  assetName: string;
  baseName: string;
  quoteName: string;
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

export interface MandatoryHFTIter {
  counter: number,
  appeared: boolean
}

export interface OrderTypeStreak {
  counter: number,
  type: number
}

export class Balance {
  deposits: ExchangeBalances;
  baseAvailable: BN;
  quoteAvailable: BN;

  constructor(deposits: ExchangeBalances) {  
    const config = getProgramConfig();

    this.deposits = deposits;
    this.baseAvailable = deposits[config.baseName];
    this.quoteAvailable = deposits[config.quoteName];
  }
}
