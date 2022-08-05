import { Market, Tonic } from '@tonic-foundation/tonic';
import { getNearConfig } from '@tonic-foundation/config';
import { Near } from 'near-api-js';
import { getExplorerUrl, getGasUsage, getKeystore } from './util';
import { parse } from 'ts-command-line-args';
import axios from 'axios';


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

async function main() {
    const indexPrice = await getPrice(coinGeckoName);
}
