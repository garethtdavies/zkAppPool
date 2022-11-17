import { PoolPayout, Reward, Rewards2 } from './PoolPayout.js';

import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  UInt32,
  UInt64,
  Signature,
} from 'snarkyjs';

(async function main() {

  await isReady;

  console.log('SnarkyJS loaded');

  // Connect to Berkeley
  const Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;
  let feePayerPrivateKey = PrivateKey.fromBase58(
    'EKDvE7umHorQrXFq1AAwV4zEDLGtZuqpn1mhsgxvYRneUpKxRUF8'
  );

  const zkAppAddress = PublicKey.fromBase58("B62qmFzf13S4WpbNnUZAYnwwCPEgaRiLZF7ZxGKE7LHKbZXMYe3LEYM");
  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  await PoolPayout.compile();

  // Function URL
  let functionUrl = "https://kodem6bg3gatbplrmoiy2sxnty0wfrhp.lambda-url.us-west-2.on.aws/?publicKey=B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg&epoch=39"

  console.log(functionUrl);

  // Make the API call
  const data = await fetch(functionUrl).then((response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Something went wrong fetching the data.');
  }).catch((error: any) => {
    console.log(error)
  });

  // Take a small slice to test batch sending payouts
  let testData = data.rewards.slice(0, 2);

  // This always need to be a fixed size so we would have to create dummy rewards to fill it

  console.log(testData);

  let rewardFields: Rewards2 = [];

  // Now we have to convert this to Fields
  testData.forEach((element) => {
    rewardFields.push({
      index: UInt32.from(element.index),
      publicKey: PublicKey.fromBase58(element.publicKey),
      delegatingBalance: UInt64.from(element.delegatingBalance),
      rewards: UInt64.from(element.rewards)
    });
  });

  console.log(rewardFields.length);

  try {
    let transaction = await Mina.transaction(
      { feePayerKey: feePayerPrivateKey, fee: transactionFee },
      () => {
        rewardFields.forEach(function (value) {
          zkAppInstance.sendReward(value);
        });
      }
    );

    console.log("Proving transaction");
    await transaction.prove();

    console.log("Sending transaction");
    console.log(transaction.toPretty());
    await transaction.send();
  } catch (error: any) {
    console.log("There was an issue");
    console.log(error.message);
  }

  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();
