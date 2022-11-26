//https://berkeley.minaexplorer.com/transaction/CkpaG8iqhthWpvMhUCcJG6n51ojPJaQLbwKGMQMJfFMabaF3b9XKE

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
  AccountUpdate,
  Bool,
  Field,
} from 'snarkyjs';

(async function main() {

  await isReady;

  console.log('SnarkyJS loaded');

  // Connect to Berkeley
  const Berkeley = Mina.Network(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;
  let feePayerPrivateKey = PrivateKey.fromBase58(
    'EKDvE7umHorQrXFq1AAwV4zEDLGtZuqpn1mhsgxvYRneUpKxRUF8'
  );

  const zkAppAddress = PublicKey.fromBase58("B62qkgSWQkoucJKQ7EVcE3RzmiAJg6e5tUtgATqcJAoARyLZoi14Ff7");
  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  try {
    await PoolPayout.compile();
  } catch(error) {
    console.log(error);
  }

  // Prime the cache


  // TODO need to manually set the fee payer nonce and zkApp nonce, plus keep track of the index. 
  // Why? Because we want to sign these all offline and get more than 1 tx in a block

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
  // This overflows if more than 4 rewards included
  let testData = data.rewards.slice(0, 4);

  // This always need to be a fixed size so we would have to create dummy rewards to fill it

  //console.log(testData);

  let rewardFields: Rewards2 = [];

  // Now we have to convert this to Fields
  testData.forEach((element) => {
    rewardFields.push({
      index: Field(element.index),
      publicKey: PublicKey.fromBase58(element.publicKey),
      rewards: UInt64.from(element.rewards),
      epoch: Field(element.epoch),
      signature: Signature.fromJSON(element.signature),
      confirmed: Bool(element.confirmed)
    });
  });

  console.log(rewardFields.length);
  // TODO check if length is less than 9 if so pad the length until it is

  try {
    //await Mina.getAccount(zkAppAddress);
    let transaction = await Mina.transaction(
      { feePayerKey: feePayerPrivateKey, fee: transactionFee },
      () => {
        zkAppInstance.sendReward(rewardFields, Field(39), Field(0));
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
