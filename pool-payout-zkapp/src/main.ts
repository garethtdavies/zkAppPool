//https://berkeley.minaexplorer.com/transaction/CkpaG8iqhthWpvMhUCcJG6n51ojPJaQLbwKGMQMJfFMabaF3b9XKE

import { FeePayout, PoolPayout, Reward, Rewards2 } from './PoolPayout.js';

import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  UInt64,
  Signature,
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
  // B62qqPo32ULMxYW745CFdF1z8KAtxbT6Du7jnxVy2XWrBxryQeX72HH
  let feePayerPrivateKey = PrivateKey.fromBase58(
    'EKDvE7umHorQrXFq1AAwV4zEDLGtZuqpn1mhsgxvYRneUpKxRUF8'
  );

  const zkAppAddress = PublicKey.fromBase58("B62qkB9vHzqLd6itsg3b9oMKJLVGhXShffXNXqqvgXqF3fJrmeHiJdo");
  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  try {
    await PoolPayout.compile();
  } catch (error) {
    console.log(error);
  }

  // Prime the cache as otherwise this falls over
  await fetchAccount({ publicKey: zkAppAddress });

  // Need to keep manual track of the nonces and current index so we can process many tx in a block
  // Need to track these manually offline
  let feePayerNonce = 15;
  let index = 0;
  let epochOracle = 39;

  // Function URL
  // TODO pass the epoch via the command line - hardcoded here for testing
  let functionUrl = "https://kodem6bg3gatbplrmoiy2sxnty0wfrhp.lambda-url.us-west-2.on.aws/?publicKey=B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg&epoch=" + epochOracle + "&index=" + index;

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

  let rewardFields: Rewards2 = {
    rewards: [
      Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(),
      Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank()
    ]
  };

  // Now we have to convert this to Fields
  data.rewards.forEach((element, i) => {
    rewardFields.rewards[i] = new Reward({
      index: Field(element.index),
      publicKey: PublicKey.fromBase58(element.publicKey),
      rewards: UInt64.from(element.rewards)
    });
  });

  let feePayout = new FeePayout({
    numDelegates: Field(data.feePayout.numDelegates),
    payout: UInt64.from(data.feePayout.payout),
  })

  let epoch = Field(data.epoch);
  let signature = Signature.fromJSON(data.signature);


  try {
    let transaction = await Mina.transaction(
      { feePayerKey: feePayerPrivateKey, fee: transactionFee, memo: `zkApp payout epoch ${epochOracle}`, nonce: feePayerNonce },
      () => {
        // All accounts must be in the ledger to delegate
        zkAppInstance.sendReward(rewardFields, feePayout, epoch, signature);
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