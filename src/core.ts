import { getOrderConfig, getPrice, getProgramConfig, getRandomArbitrary } from "./util";
import { Balance, MandatoryHFTIter, MarketMakerParams, OrderTypeStreak } from "./types";
import { Tonic, Market } from "@tonic-foundation/tonic";
import { isMakeMarketNeeded, notEnoughFunds } from "./checks";
import { Buy, Sell, TOKEN_DECIMALS, PRICE_DECIMALS } from "./consts"
import BN from "bn.js";
import {
  orderTypeChangeIsNeeded,
  openOrdersToOrderBook,
  getOrderBookFromConfig,
  calculateBestPrice,
  changeIndexPrice,
  getExplorerUrl,
  getBestPrice,
  getOrderType,
  getGasUsage,
  sleep,
  convertToDecimals
} from "./util";


function createBatch(market: any, configOrders: { buy: any[]; sell: any[] }) {
  const batch = market.createBatchAction();

  batch.cancelAllOrders();

  for (const bid of configOrders.sell) {
    batch.newOrder({
      quantity: bid.quantity,
      side: "Sell",
      limitPrice: bid.price,
      orderType: "Limit",
    });
  }

  for (const ask of configOrders.buy) {
    batch.newOrder({
      quantity: ask.quantity,
      side: "Buy",
      limitPrice: ask.price,
      orderType: "Limit",
    });
  }

  return batch;
}

function skipHFT(mandatoryHftIter: MandatoryHFTIter) {
  const config = getProgramConfig()

  const skip = Math.random() > config.hftChance;

  if (!mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
    mandatoryHftIter.counter = 0;
  } else if (mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
    mandatoryHftIter.counter = 0;
    mandatoryHftIter.appeared = false;
    return true;
  } else if (mandatoryHftIter.appeared || skip) {
    mandatoryHftIter.counter += 1;
    return true;
  } 
  mandatoryHftIter.appeared = true;
  mandatoryHftIter.counter += 1;

  return false;
}

async function makeHFT(
    tonic: Tonic, tonicHFT: Tonic, 
    market: Market, marketHFT: Market, 
    mandatoryHftIter: MandatoryHFTIter, orderTypeStreak: OrderTypeStreak
  ) {
  const config = getProgramConfig();
  let randomSleepTimeMs = 0;

  if (!config.hft) return randomSleepTimeMs;
  if (skipHFT(mandatoryHftIter)) return randomSleepTimeMs;

  let randomAmount = getRandomArbitrary(config.randomTokenMin, config.randomTokenMax);
  let orderType = getRandomArbitrary(1, 2) - 1;
  
  const { bestAskPrice, bestBidPrice } = getBestPrice(await tonic.getOpenOrders(market.id))
  let price = calculateBestPrice(bestBidPrice, bestAskPrice);

  const amountBN = new BN(convertToDecimals(randomAmount, TOKEN_DECIMALS));
  const priceBN = new BN(convertToDecimals(price, PRICE_DECIMALS));
  const priceForOrderBN = amountBN.mul(priceBN);

  const balance = new Balance(await tonic.getBalances());
  const balanceHFT = new Balance(await tonicHFT.getBalances());

  if (
    notEnoughFunds(balance, priceForOrderBN, amountBN) && 
    notEnoughFunds(balanceHFT, priceForOrderBN, amountBN)
    ) {
    return randomSleepTimeMs;
  }

  let forceChangeOrderType = false;
  if (orderType == Buy) {
    if (
      balanceHFT.quoteAvailable.lt(priceForOrderBN) || 
      balance.baseAvailable.lt(amountBN)) {
        orderType = orderType == Buy ? Sell : Buy;
        forceChangeOrderType = true;
    }
  } else {
    if (
      balanceHFT.baseAvailable.lt(amountBN) || 
      balance.quoteAvailable.lt(priceForOrderBN)) {
        orderType = orderType == Buy ? Sell : Buy;
        forceChangeOrderType = true;
    }
  }

  return 0;

  if (orderTypeChangeIsNeeded(orderType, orderTypeStreak) && !forceChangeOrderType) {
    orderType = orderType == Buy ? Sell : Buy;
  }

  const {response} = await market.placeOrder({
    quantity: randomAmount, 
    side: getOrderType(orderType == Buy ? Sell : Buy),
    limitPrice: price,
    orderType: "Limit"
  });

  const {response: responseHFT} = await marketHFT.placeOrder({
    quantity: randomAmount, 
    side: getOrderType(orderType),
    limitPrice: price,
    orderType: "Limit"
  });

  try {
    await tonic.cancelOrder(market.id, response.id);
  } catch (e) {}
  try {
    await tonicHFT.cancelOrder(market.id, responseHFT.id);
  } catch(e) {}

  return randomSleepTimeMs;
}


export async function makeMarket(params: MarketMakerParams) {
  const {
    tonic,
    tonicHFT,
    marketId,
    assetName,
    baseQuantity,
    quoteQuantity,
    orderDelayMs,
    network,
  } = params;

  const market = await tonic.getMarket(marketId);
  const marketHFT = await tonicHFT.getMarket(marketId);

  let mandatoryHftIter: MandatoryHFTIter = {counter: 0, appeared: false};
  let orderTypeStreak: OrderTypeStreak = {counter: 0, type: 0};
  let indexPrice = await getPrice(assetName);

  while (true) {
    const config = await getOrderConfig();

    let randomSleepTimeMs = 0;
    let newPrice;
    try {
        newPrice = await getPrice(assetName);
    } catch(e: any) {
        await sleep(orderDelayMs);
        continue;
    }
    indexPrice = changeIndexPrice(indexPrice, newPrice);

    const currentOrders = openOrdersToOrderBook(await tonic.getOpenOrders(market.id));
    const configOrders = getOrderBookFromConfig(config, indexPrice, baseQuantity, quoteQuantity);

    if (currentOrders.buy.length > 0) {
      randomSleepTimeMs = await makeHFT(tonic, tonicHFT, market, marketHFT, mandatoryHftIter, orderTypeStreak);
    }

    if (isMakeMarketNeeded(currentOrders, configOrders, config.priceThreshold, config.quantityThreshold)) {
      const batch = createBatch(market, configOrders);

      try {
        console.log("Sending transaction...");
        const { executionOutcome: tx, response: _ } = await tonic.executeBatch(batch);
        console.log("Transaction", getExplorerUrl(network, "transaction", tx.transaction_outcome.id));
        console.log(`Gas usage: ${getGasUsage(tx)}`);
      } catch (e) {
        console.log("Order failed", e);
      }
    }

    console.log(`Waiting ${orderDelayMs}ms`);
    await sleep(orderDelayMs - randomSleepTimeMs);
  }
}
