import {Tonic} from "@tonic-foundation/tonic";
import {getNearConfig} from "@tonic-foundation/config";
import {keyStores, KeyPair, connect} from "near-api-js";
import {ProgramOptions} from "./types";
import {makeMarket} from "./core";


async function main() {
  const args: ProgramOptions = require("../config.json");
  
  const keyStore = new keyStores.InMemoryKeyStore();
  const nearConfig = getNearConfig(args.network);
  const keyPair = KeyPair.fromString(args.privateKey)
  await nearConfig.keyStore?.setKey(nearConfig.networkId, args.nearAccountId, keyPair)
  const near = await connect(nearConfig)
  const account = await near.account(args.nearAccountId);

  const tonic = new Tonic(account, args.tonicContractId);
  const market = await tonic.getMarket(args.marketId);

  await makeMarket({tonic, market, ...args});
}

main();
