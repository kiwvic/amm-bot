import { isMakeMarketNeeded } from "./checks";
import { MarketMakerParams } from "./types";
import {
  getExplorerUrl,
  getGasUsage,
  sleep,
  openOrdersToOrderBook,
  getOrderBookFromConfig,
} from "./util";
import { getOrderConfig, getPrice } from "./util";

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

export async function makeMarket(params: MarketMakerParams) {
  const {
    tonic,
    market,
    assetName,
    baseQuantity,
    quoteQuantity,
    orderDelayMs,
    network,
  } = params;

  while (true) {
    const config = await getOrderConfig();

    const indexPrice = await getPrice(assetName);
    const currentOrders = openOrdersToOrderBook(await tonic.getOpenOrders(market.id));
    const configOrders = getOrderBookFromConfig(
      config,
      indexPrice,
      baseQuantity,
      quoteQuantity
    );

    if (
      isMakeMarketNeeded(
        currentOrders,
        configOrders,
        config.priceThreshold,
        config.quantityThreshold
      )
    ) {
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
    await sleep(orderDelayMs);
  }
}
