import * as dotenv from 'dotenv';

dotenv.config();


export const CONFIG_URL = process.env.CONFIG_URL;

const TOKEN_DECIMALS = 18;
const PRICE_DECIMALS = 6;

export const QUANTITY_FACTOR = Math.pow(10, TOKEN_DECIMALS);
export const PRICE_FACTOR = Math.pow(10, PRICE_DECIMALS);
