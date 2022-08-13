env_parse() {
    echo `cat .env | grep $1= | cut -d '=' -f2`
}

YOUR_ACCOUNT_ID=$(env_parse YOUR_ACCOUNT_ID)
MARKET_ID=$(env_parse MARKET_ID)

yarn make-market \
    --network=mainnet \
    --nearAccountId=$YOUR_ACCOUNT_ID \
    --tonicContractId=v1.orderbook.near \
    --marketId=$MARKET_ID \
    --assetName=token.pembrock.near \
    --baseQuantityPEM=10000 \
    --baseQuantityUSDC=1400 \
    --orderDelayMs 120000