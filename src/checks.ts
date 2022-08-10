import { assert } from "console";

const amountOfOrdersChanged = (currentOrders: any, configOrders: any) => {
    return currentOrders.buy.length !== configOrders.buy.length ||
        currentOrders.sell.length !== configOrders.sell.length;
}

const priceChanged = (currentOrders: any, configOrders: any, spreadDelta: any) => {
    assert(currentOrders.length === configOrders.length);
    // TODO must be sorted

    for (let i = 0; currentOrders.buy.length; i++) {
        if (Math.abs(currentOrders.buy[i].price - configOrders.buy[i].price) < spreadDelta) {
            return true;
        } else if (Math.abs(currentOrders.sell[i].price - configOrders.sell[i].price) < spreadDelta) {
            return true;
        }
    }

    return false;
}

const quantityChanged = (currentOrders: any, configOrders: any, quantityDelta: any) => {
    assert(currentOrders.length === configOrders.length);
    // TODO must be sorted

    for (let i = 0; currentOrders.buy.length; i++) {
        if (Math.abs(currentOrders.buy[i].quantity - configOrders.buy[i].quantity) < quantityDelta) {
            return true;
        } else if (Math.abs(currentOrders.sell[i].quantity - configOrders.sell[i].quantity) < quantityDelta) {
            return true;
        }
    }

    return false;
}

export const isMakeMarketNeeded = (currentOrders: any, configOrders: any, spreadDelta: any, quantityDelta: any) => {
    if (amountOfOrdersChanged(currentOrders, configOrders)) return true;
    if (priceChanged(currentOrders, configOrders, spreadDelta)) return true;
    if (quantityChanged(currentOrders, configOrders, quantityDelta)) return true;

    return false;
}
