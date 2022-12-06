//https://berkeley.minaexplorer.com/transaction/CkpaG8iqhthWpvMhUCcJG6n51ojPJaQLbwKGMQMJfFMabaF3b9XKE

import { FeePayout, PoolPayout, Reward, Rewards2 } from './PoolPayout.js';

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
  fetchAccount,
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

  const zkAppAddress = PublicKey.fromBase58("B62qihz5QxyK8C93KAUxvv1fXB1fdirWA5tj4QUhboenxhGtjp7ipm3");
  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  try {
    await PoolPayout.compile();
  } catch(error) {
    console.log(error);
  }

  // Prime the cache as otherwise this falls over
  await fetchAccount({publicKey: zkAppAddress});

  // Need to keep manual track of the nonces and current index so we can process many tx in a block
  // Need to track these manually offline
  let feePayerNonce = 466;
  let zkAppAddressNonce = 2;
  let index = 0;

  // TODO need to manually set the fee payer nonce and zkApp nonce, plus keep track of the index. 
  // Why? Because we want to sign these all offline and get more than 1 tx in a block

  // Function URL
  // TODO pass the epoch via the command line - hardcoded here for testing
  let functionUrl = "https://kodem6bg3gatbplrmoiy2sxnty0wfrhp.lambda-url.us-west-2.on.aws/?publicKey=B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg&epoch=39&index=" + index;

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

  // This always need to be a fixed size so we would have to create dummy rewards to fill it

  let rewardFields: Rewards2 = [];

  // Now we have to convert this to Fields
  data.rewards.forEach((element) => {
    rewardFields.push({
      index: Field(element.index),
      publicKey: PublicKey.fromBase58(element.publicKey),
      rewards: UInt64.from(element.rewards)
    });
  });

  // Ensure we always have a fixed length array or pass some dummy data
  for (let i = rewardFields.length; i < 8; i++) {
    rewardFields.push({
      index: Field(i),
      publicKey: zkAppAddress,
      rewards: UInt64.from(0)
    });
  }
  
  let feePayout = new FeePayout({
    numDelegates: Field(data.feePayout.numDelegates),
    payout: UInt64.from(data.feePayout.payout),
  })

  let epoch = Field(data.epoch);
  let signature = Signature.fromJSON(data.signature);


  try {
    let transaction = await Mina.transaction(
      { feePayerKey: feePayerPrivateKey, fee: transactionFee },
      () => {
        //AccountUpdate.fundNewAccount(feePayerPrivateKey);
        zkAppInstance.sendReward(rewardFields, feePayout, epoch, signature);
      }
    );

    console.log("Proving transaction");
    await transaction.prove();

    console.log("Sending transaction");
    console.log(transaction.toPretty());
    //await transaction.send();
  } catch (error: any) {
    console.log("There was an issue");
    console.log(error.message);
  }

  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();
