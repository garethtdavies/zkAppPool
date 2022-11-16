"use strict";
// This API returns the latest price data from Coingecko API
// Can run locall with `npm run build && npm run locally` to simulate the lambda function
// URL to run this is https://hdbuc4znywgfyvhdk7k42525ma0ykwsh.lambda-url.us-west-2.on.aws/
Object.defineProperty(exports, "__esModule", { value: true });
const snarkyjs_1 = require("snarkyjs");
exports.handler = async (event) => {
    await snarkyjs_1.isReady;
    // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
    // Using this as same as examples
    const privateKey = snarkyjs_1.PrivateKey.fromBase58("EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53");
    // We compute the public key associated with our private key
    const signingKey = privateKey.toPublicKey();
    // Make the API call
    const priceData = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=mina-protocol&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true").then((response) => {
        if (response.ok) {
            return response.json();
        }
        throw new Error('Something went wrong fetching the data.');
    }).catch((error) => {
        console.log(error);
    });
    // This price is in dollars e.g. 0.635231 - we want in cents and then rounded to the nearest cent
    const price = snarkyjs_1.UInt32.from(Math.round(priceData["mina-protocol"].usd * 100));
    const marketCap = snarkyjs_1.UInt64.from(Math.round(priceData["mina-protocol"].usd_market_cap));
    const lastUpdate = snarkyjs_1.UInt64.from(priceData["mina-protocol"].last_updated_at);
    // Sign all the data
    const signedData = price.toFields().concat(marketCap.toFields()).concat(lastUpdate.toFields());
    const signature = snarkyjs_1.Signature.create(privateKey, signedData);
    const data = {
        data: {
            "priceCents": price,
            "lastUpdate": lastUpdate,
            "marketCap": marketCap,
        },
        signature: signature,
        publicKey: signingKey,
    };
    const response = {
        statusCode: 200,
        body: JSON.stringify(data),
    };
    console.log(response);
    return response;
};
