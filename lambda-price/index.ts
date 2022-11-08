// This API returns the latest price data from Coingecko API
// Can run locall with `npm run build && npm run locally` to simulate the lambda function
// URL to run this is https://hdbuc4znywgfyvhdk7k42525ma0ykwsh.lambda-url.us-west-2.on.aws/

import { format } from "path";
import { isReady, PublicKey, PrivateKey, Field, Signature, UInt32, UInt64 } from "snarkyjs";

exports.handler = async (event) => {

  await isReady;

  type Data = {
    data: {
      "priceCents": UInt32,
      "lastUpdate": UInt64,
      "marketCap": UInt64,
    },
    signature: Signature,
    publicKey: PublicKey
  };

  // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
  // Using this as same as examples
  const privateKey = PrivateKey.fromBase58(
    "EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53"
  );
  // We compute the public key associated with our private key
  const signingKey = privateKey.toPublicKey();

  // Make the API call
  const priceData = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=mina-protocol&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true").then((response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Something went wrong fetching the data.');
  }).catch((error: any) => {
    console.log(error)
  });

  // This price is in dollars e.g. 0.635231 - we want in cents and then rounded to the nearest cent
  const price = UInt32.fromNumber(Math.round(priceData["mina-protocol"].usd * 100));
  const marketCap = UInt64.fromNumber(Math.round(priceData["mina-protocol"].usd_market_cap));
  const lastUpdate = UInt64.fromNumber(priceData["mina-protocol"].last_updated_at);

  // Sign all the data
  const signedData = price.toFields().concat(marketCap.toFields()).concat(lastUpdate.toFields());

  const signature = Signature.create(privateKey, signedData);

  const data: Data = {
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
