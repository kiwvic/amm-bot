```bash
npm i -g @tonic-foundation/cli
export TONIC_CONTRACT_ID=v1.orderbook.near
export MARKET_ID=EQNFsoETbeJshWW4h2sh7bsqJ4Cz2XSHsSDETj1Q2uUb # PEM/USDC
export YOUR_ACCOUNT_ID= # your NEAR wallet address
export NEAR_ENV=mainnet

screen -S amm ./startbot.sh # run screen

# register account with the exchange
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
