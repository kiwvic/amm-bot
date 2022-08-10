import * as dotenv from 'dotenv';

dotenv.config();


export const CONFIG_URL = process.env.CONFIG_URL;

const TOKEN_DECIMALS = 18;
const PRICE_DECIMALS = 7;

export const QUANTITY_FACTOR = Math.pow(10, TOKEN_DECIMALS - 1);
export const PRICE_FACTOR = Math.pow(10, PRICE_DECIMALS - 1);
