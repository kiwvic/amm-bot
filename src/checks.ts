import { assert } from "console";

const amountOfOrdersChanged = (currentOrders: any, configOrders: any) => {
  return (
    currentOrders.buy.length !== configOrders.buy.length ||
    currentOrders.sell.length !== configOrders.sell.length
  );
};

const priceChanged = (
  currentOrders: any,
  configOrders: any,
  priceThreshold: any
) => {
  assert(currentOrders.length === configOrders.length);

  currentOrders.buy.sort((a: any, b: any) => a.price - b.price);
  currentOrders.sell.sort((a: any, b: any) => a.price - b.price);

  for (let i = 0; currentOrders.buy.length; i++) {
    if (
      Math.abs(1 - currentOrders.buy[i].price / configOrders.buy[i].price) > priceThreshold 
      ||
      Math.abs(1 - currentOrders.sell[i].price / configOrders.sell[i].price) > priceThreshold
    )
      return true;
  }

  return false;
};

const quantityChanged = (
  currentOrders: any,
  configOrders: any,
  quantityThreshold: any
) => {
  assert(currentOrders.length === configOrders.length);

  currentOrders.buy.sort((a: any, b: any) => a.price - b.price);
  currentOrders.sell.sort((a: any, b: any) => a.price - b.price);

  for (let i = 0; currentOrders.buy.length; i++) {
    if (
      Math.abs(1 - currentOrders.buy[i].quantity / configOrders.buy[i].quantity) > quantityThreshold 
      ||
      Math.abs(1 - currentOrders.sell[i].quantity / configOrders.sell[i].quantity) > quantityThreshold
    )
      return true;
  }

  return false;
};

export const isMakeMarketNeeded = (
  currentOrders: any,
  configOrders: any,
  priceThreshold: any,
  quantityThreshold: any
) => {
  if (amountOfOrdersChanged(currentOrders, configOrders)) return true;
  if (priceChanged(currentOrders, configOrders, priceThreshold)) return true;
  if (quantityChanged(currentOrders, configOrders, quantityThreshold)) return true;

  return false;
};
