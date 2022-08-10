import {
    PRICE_FACTOR,
    QUANTITY_FACTOR
} from './consts'

const amountOfOrdersChanged = (currentOrders: any, configOrders: any) => {
    return currentOrders.buy.length !== configOrders.buy.length ||
        currentOrders.sell.length !== configOrders.sell.length;
}

const priceChanged = (currentOrders: any, configOrders: any, spreadDelta: any) => {
    // TODO assert eq length
    // TODO must be sorted

    const delta = spreadDelta * PRICE_FACTOR;

    for (let i = 0; currentOrders.buy.length; i++) {
        if (Math.abs(currentOrders.buy[i].price - configOrders.buy[i].price) < delta) {
            return true;
        } else if (Math.abs(currentOrders.sell[i].price - configOrders.sell[i].price) < delta) {
            return true;
        }
    }

    return false;
}

const quantityChanged = (currentOrders: any, configOrders: any, quantityDelta: any) => {
    // TODO assert eq length
    // TODO must be sorted

    const delta = quantityDelta * QUANTITY_FACTOR;

    for (let i = 0; currentOrders.buy.length; i++) {
        if (Math.abs(currentOrders.buy[i].quantity - configOrders.buy[i].quantity) < delta) {
            return true;
        } else if (Math.abs(currentOrders.sell[i].quantity - configOrders.sell[i].quantity) < delta) {
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
