```bash
npm i -g @tonic-foundation/cli
export TONIC_CONTRACT_ID=v1.orderbook.near
export NEAR_ENV=mainnet

# Also don't forget to fill .env vars

screen -S amm ./startbot.sh # run screen

# register account with the exchange if first time
tonic storage-deposit --accountId $YOUR_ACCOUNT_ID --registration-only
```

```bash
yarn
yarn make-market \
    --network=mainnet \
    --nearAccountId=$YOUR_ACCOUNT_ID \
    --tonicContractId=v1.orderbook.near \
    --marketId=$MARKET_ID \
    --assetName=near \
    --baseQuantity=1 \
    --orderDelayMs 60000
```
