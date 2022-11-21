// This will just return precalculated payouts for an epoch payout
// TODO this currently doesn't have a fee for the validator
// https://kodem6bg3gatbplrmoiy2sxnty0wfrhp.lambda-url.us-west-2.on.aws/?publicKey=B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg&epoch=39

import { isReady, PublicKey, PrivateKey, Field, Signature, UInt32, UInt64, Bool } from "snarkyjs";
import { request, gql } from 'graphql-request';

// This query gets the blocks won in an epoch for a producer
const query = gql`
query($creator: String!, $epoch: Int){
  blocks(query: {creator: $creator, protocolState: {consensusState: {epoch: $epoch}}, canonical: true}, sortBy: DATETIME_DESC, limit: 1000) {
    blockHeight
    canonical
    creator
    dateTime
    txFees
    snarkFees
    receivedTime
    stateHash
    stateHashField
    protocolState {
      consensusState {
        blockHeight
        epoch
        slotSinceGenesis
      }
    }
    transactions {
      coinbase
      coinbaseReceiverAccount {
        publicKey
      }
      feeTransfer {
        fee
        recipient
        type
      }
    }
  }
}
`;

// This query gets the staking balances for everyone in an epoch
const query2 = gql`
query($delegate: String!, $epoch: Int!){
  stakes(query: {delegate: $delegate, epoch: $epoch}, limit: 100000, sortBy: BALANCE_DESC) {
    public_key
    balance
    chainId
    timing {
      cliff_amount
      cliff_time
      initial_minimum_balance
      timed_epoch_end
      timed_in_epoch
      timed_weighting
      untimed_slot
      vesting_increment
      vesting_period
    }
  }
}
`;

// This query gets the last block of the epoch in question
const query3 = gql`
query ($epoch: Int) {
  blocks(query: {protocolState: {consensusState: {epoch: $epoch}}, canonical: true}, sortBy: BLOCKHEIGHT_DESC, limit: 1) {
    blockHeight
  }
}
`;

// We need the current block for confirmations
const query4 = gql`
{
  blocks(query: {canonical: true}, sortBy: BLOCKHEIGHT_DESC, limit: 1) {
    blockHeight
  }
}
`;

exports.handler = async (event) => {

  console.log("Let's go...");

  await isReady;

  // The number of confirmations we need
  const confirmations = 15;

  // Define the type that our function (and API) will return
  type Data = {
    rewards: Reward[];
    publicKey: PublicKey;
  };

  type Reward = {
    "index": UInt32;
    "publicKey": PublicKey;
    "delegatingBalance": UInt64;
    "rewards": UInt64;
    "epoch": UInt32;
    "signature": Signature;
    "confirmed": Bool;
    "feePayout": Bool;
  };

  // get the event from Lambda URI
  const eventKey = event.queryStringParameters.publicKey;
  const epochEvent = event.queryStringParameters.epoch;

  // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
  const privateKey = PrivateKey.fromBase58(
    "EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53"
  );

  // We compute the public key associated with our private key
  const signingKey = privateKey.toPublicKey();

  // Get the blocks won
  const blocksData = await request('https://graphql.minaexplorer.com', query, { creator: eventKey, epoch: epochEvent }).then((data) => {
    return data.blocks;
  });

  //console.log(blocksData);

  // Get the staking balances
  const stakingData = await request('https://graphql.minaexplorer.com', query2, { delegate: eventKey, epoch: epochEvent }).then((data) => {
    return data.stakes;
  });

  const numDelegators = stakingData.length;

  console.log("There are " + numDelegators + " delegators in the pool");

  // Get the last block of the epoch in question
  // This enforces we can't run multiple times an epoch as need to wait for it to complete - you could do this differently but this works for now
  const lastBlockOfEpoch = await request('https://graphql.minaexplorer.com', query3, { epoch: epochEvent }).then((data) => {
    return data.blocks[0].blockHeight;
  });

  console.log("Last block of epoch is: " + lastBlockOfEpoch);

  // Get current height
  const currentHeight = await request('https://graphql.minaexplorer.com', query4).then((data) => {
    return data.blocks[0].blockHeight;
  });

  console.log("Current height is: " + currentHeight);

  // Check if we have enough confs past end of epoch - we return a boolean so the signed data doesn't change
  const minConfirmations = (currentHeight >= lastBlockOfEpoch + confirmations) ? true : false;
  console.log("Do we have enough confirmations: " + minConfirmations);

  /*Calculate rewards*/
  const poolBalance = stakingData.reduce((sum, current) => sum + current.balance, 0);
  console.log("The pool balance is " + poolBalance);

  /* Simplest payout algorithm - can tweak this later
  /* Assuming no supercharged rewards moving forward
  /* We'll just split the coinbase for each block
  */

  let coinbaseRewards = 0;
  let txRewards = 0;
  let snarkFees = 0;

  //console.log(blocksData);
  blocksData.forEach((block) => {
    coinbaseRewards = coinbaseRewards + Number(block.transactions.coinbase);
    txRewards = txRewards + Number(block.txFees);
    snarkFees = snarkFees + Number(block.snarkFees);
  });

  console.log("Total rewards to share are: " + coinbaseRewards / 1000000000);
  console.log("Total tx fees to share are: " + txRewards / 1000000000);
  console.log("Total snark fees are: " + snarkFees / 1000000000);

  const totalPoolToShare = coinbaseRewards + txRewards - snarkFees;

  console.log("Total payout is: " + totalPoolToShare / 1000000000);

  let outputArray: Reward[] = [];

  let index = 0;

  var signedData: Field[] = [];

  // Anyone who is in this list will be getting a reward, asssuming above 0
  stakingData.forEach((staker) => {

    let delegatingKey = staker.public_key;
    // Convert to nanomina and force to an int
    let delegatingBalance = staker.balance;

    // Determine individual staking rewards based on percentage of pool
    let rewards = Math.trunc((delegatingBalance / poolBalance) * totalPoolToShare);

    // For all stakers feePayout is false
    let feePayout = Bool(false);

    // Format 
    const indexToField = UInt32.from(index);
    const publicKeyToField = PublicKey.fromBase58(delegatingKey);
    const delegatingBalanceToField = UInt64.from(Math.trunc(delegatingBalance * 1000000000));
    const rewardsToField = UInt64.from(rewards);
    const epochToField = UInt32.from(epochEvent);
    const confirmedToField = Bool(minConfirmations);

    // Concat the fields to sign all this data
    signedData = signedData.concat(indexToField.toFields()).concat(publicKeyToField.toFields()).concat(delegatingBalanceToField.toFields()).concat(rewardsToField.toFields()).concat(epochToField.toFields()).concat(confirmedToField.toFields()).concat(feePayout.toFields());

    // Sign it with the oracle public key
    const signature = Signature.create(privateKey, signedData);

    // Add this to our response
    outputArray.push({
      "index": indexToField,
      "publicKey": publicKeyToField,
      "delegatingBalance": delegatingBalanceToField,
      "rewards": rewardsToField,
      "epoch": epochToField,
      "signature": signature,
      "confirmed": confirmedToField,
      "feePayout": feePayout,
    });

    index++;
  });

  // We will make the fee payout the last payout and if true we can bump the epoch
  signedData = signedData.concat(UInt32.from(index).toFields()).concat(PublicKey.fromBase58("B62qiUt6Wf9JTtVUpiHtzcobznPr7dj7V3LZxcP3mn2T1xqNprsQFbb").toFields()).concat(UInt64.from(0).toFields()).concat(UInt64.from(totalPoolToShare).toFields()).concat(UInt32.from(epochEvent).toFields()).concat(Bool(minConfirmations).toFields()).concat(Bool(true).toFields());

  const signature = Signature.create(privateKey, signedData);

  outputArray.push(
    {
      "index": UInt32.from(index),
      "publicKey": PublicKey.fromBase58("B62qiUt6Wf9JTtVUpiHtzcobznPr7dj7V3LZxcP3mn2T1xqNprsQFbb"),
      "delegatingBalance": UInt64.from(0),
      "rewards": UInt64.from(totalPoolToShare),
      "epoch": UInt32.from(epochEvent),
      "signature": signature,
      "confirmed": Bool(minConfirmations),
      "feePayout": Bool(true),
    }
  )

  const data: Data = {
    rewards: outputArray,
    publicKey: signingKey,
  };

  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
  };

  //console.log(response);

  return response;
};
