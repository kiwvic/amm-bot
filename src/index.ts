import {Tonic} from "@tonic-foundation/tonic";
import {getNearConfig} from "@tonic-foundation/config";
import {Near} from "near-api-js";
import {getKeystore} from "./util";
import {ProgramOptions} from "./types";
import {makeMarket} from "./core";


async function main() {
  const args: ProgramOptions = require("../config.json");
  
  const keyStore = await getKeystore();
  const near = new Near({...getNearConfig(args.network), keyStore});
  const account = await near.account(args.nearAccountId);

  const tonic = new Tonic(account, args.tonicContractId);
  const market = await tonic.getMarket(args.marketId);

  await makeMarket({tonic, market, ...args});
}

main();
