import { getOrderConfig, getPrice, getProgramConfig, getRandomArbitrary } from "./util";
import { MandatoryHFTIter, MarketMakerParams, OrderTypeStreak } from "./types";
import { Tonic, Market } from "@tonic-foundation/tonic";
import { isMakeMarketNeeded } from "./checks";
import { Buy, Sell } from "./consts"
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


async function makeHFT(
    tonic: Tonic, tonicHFT: Tonic, 
    market: Market, marketHFT: Market, 
    baseName: string, quoteName: string,
    mandatoryHftIter: MandatoryHFTIter, orderTypeStreak: OrderTypeStreak
  ) {
  const config = getProgramConfig();

  if (!config.hft) return 0;
  
  let randomSleepTimeMs = 0;
  const skip = Math.random() > config.hftChance;

  if (!mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
    console.log("!mandatoryHftIter.appeared && mandatoryHftIter.counter >= MANDATORY_ITERATION_RECHARGE");
    mandatoryHftIter.counter = 0;
  } else if (mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
      console.log("mandatoryHftIter.appeared && mandatoryHftIter.counter >= MANDATORY_ITERATION_RECHARGE");
      mandatoryHftIter.counter = 0;
      mandatoryHftIter.appeared = false;
      return randomSleepTimeMs;
  } else if (mandatoryHftIter.appeared) {
      console.log("mandatoryHftIter.appeared");
      mandatoryHftIter.counter += 1;
      return randomSleepTimeMs;
  } else if (skip) {
      console.log("skip");
      mandatoryHftIter.counter += 1;
      return randomSleepTimeMs;
  } 
  mandatoryHftIter.appeared = true;
  mandatoryHftIter.counter += 1;

  let randomAmount = getRandomArbitrary(config.randomTokenMin, config.randomTokenMax);
  let orderType = getRandomArbitrary(1, 2) - 1;

  const balances = await tonic.getBalances();
  const balancesHFT = await tonicHFT.getBalances();
  
  const { bestAskPrice, bestBidPrice } = getBestPrice(await tonic.getOpenOrders(market.id))

  let price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);

  // TODO check funds
  const baseAvailable = balances[baseName];
  const quoteAvailable = balances[quoteName];
  const baseHFTAvailable = balancesHFT[baseName];
  const quoteHFTAvailable = balancesHFT[quoteName];
  
  let forceChangeOrderType = false;
  if (orderType == Buy) {
      if (quoteHFTAvailable.lt(new BN(randomAmount * price)) || baseAvailable.lt(new BN(randomAmount))) {
          orderType = orderType == Buy ? Sell : Buy;
          price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);
          forceChangeOrderType = true;
      }
  } else {
      if (baseHFTAvailable.lt(new BN(randomAmount)) || quoteAvailable.lt(new BN(randomAmount * price))) {
          orderType = orderType == Buy ? Sell : Buy;
          price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);
          forceChangeOrderType = true;
      }
  }

  if (orderTypeChangeIsNeeded(orderType, orderTypeStreak) && !forceChangeOrderType) {
      orderType = orderType == Buy ? Sell : Buy;
      randomAmount += 100;
  }

  await market.placeOrder({
    quantity: randomAmount, 
    side: getOrderType(orderType == Buy ? Sell : Buy),
    limitPrice: price,
    orderType: "Limit"
  });
  await marketHFT.placeOrder({
    quantity: randomAmount, 
    side: getOrderType(orderType),
    limitPrice: price,
    orderType: "Limit"
  });

  return randomSleepTimeMs;
}


export async function makeMarket(params: MarketMakerParams) {
  const {
    tonic,
    tonicHFT,
    marketId,
    baseName, 
    quoteName,
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
      randomSleepTimeMs = await makeHFT(tonic, tonicHFT, market, marketHFT, baseName, quoteName, mandatoryHftIter, orderTypeStreak);
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
