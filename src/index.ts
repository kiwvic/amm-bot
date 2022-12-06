import {ProgramOptions} from "./types";
import {makeMarket} from "./core";
import {getTonic} from "./util"


async function main() {
  const args: ProgramOptions = require("../config.json");
  
  const tonic = await getTonic(args.network, args.nearAccountId, args.privateKey, args.tonicContractId);
  const tonicHFT = await getTonic(args.network, args.nearAccountIdHFT, args.privateKeyHFT, args.tonicContractId);

  await makeMarket({tonic, tonicHFT, ...args});
}

main();
