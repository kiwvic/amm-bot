import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();
const CONFIG_URL = process.env.CONFIG_URL

const client = axios.create({
    baseURL: 'https://indexer.ref.finance/',
});
  
export const getPrice = async (token_id: string) => {
return client
    .get('get-token-price', {
    params: {
    token_id: token_id,
    },
    })
    .then((res) => res.data[token_id]['usd']) as unknown as number;
};

const getConfig = async () => {
    return (await axios.get(CONFIG_URL!)).data
}


async function main() {
    const config = await getConfig();
    console.log(config)
}

main();
