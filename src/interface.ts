import { Market, Tonic } from "@tonic-foundation/tonic";

export interface ProgramOptions {
  marketId: string;
  nearAccountId: string;
  tonicContractId: string;
  assetName: string;
  baseQuantity: number;
  network: "mainnet" | "testnet";
  orderDelayMs: number;
}

export interface MarketMakerParams {
  tonic: Tonic;
  market: Market;
  coinName: string;
  baseQuantity: number;
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
  spreadDelta: number;
  quantityDelta: number;
}
