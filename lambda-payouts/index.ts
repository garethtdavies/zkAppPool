// This will just return precalculated payouts for an epoch payout
// We can then use this in a zkApp or store ina merkle tree
// Need to check in the zkApp that 290 blocks have passed of the epoch after
// Can do that via preconditions
// The zkApp will create the merkle tree?

import { isReady, PublicKey, PrivateKey, Field, Signature, UInt32, UInt64 } from "snarkyjs";
import { request, gql } from 'graphql-request';

// This query gets the blocks won in an epoch for a producer
const query = gql`
query($creator: String!, $epoch: Int){
  blocks(query: {creator: $creator, protocolState: {consensusState: {epoch: $epoch}}, canonical: true}, sortBy: DATETIME_DESC, limit: 10000) {
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
  stakes(query: {delegate: $delegate, epoch: $epoch}, limit: 10) {
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

exports.handler = async (event) => {

  console.log("Running");

  await isReady;

  // Define the type that our function (and API) will return
  type Data = {
    data: Reward[];
    //signature: Signature;
    publicKey: PublicKey;
  };

  type Reward = {
    "index": UInt32;
    "publicKey": PublicKey;
    "delegatingBalance": UInt64;
    "rewards": UInt64;
    "epoch": UInt32;
  };

  // get the event from Lambda URI
  //const eventKey = event.queryStringParameters.publicKey;
  //const epochEvent = event.queryStringParameters.epoch;

  // mock this for testing
  const eventKey = "B62qpge4uMq4Vv5Rvc8Gw9qSquUYd6xoW1pz7HQkMSHm6h1o7pvLPAN";
  const epochEvent = 39;

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

  //console.log(stakingData);

  let outputArray: Reward[] = [];

  var index = 0;

  // Anyone who is in this list will be getting a reward, asssuming above 0
  stakingData.forEach((staker) => {

    // Can we do this 

    let delegatingKey = staker.public_key;
    // Convert to nanomina and force to an int
    let delegatingBalance = Math.trunc(staker.balance * 1000000000);

    // Determine rewards based on percentage of pool
    let rewards = 123;

    // Add this to our response
    outputArray.push({
      "index": UInt32.from(index),
      "publicKey": PublicKey.fromBase58(delegatingKey),
      "delegatingBalance": UInt64.from(delegatingBalance),
      "rewards": UInt64.from(rewards),
      "epoch": UInt32.from(epochEvent),
    })

    index++;
  });

  //console.log(outputArray);

  // Now to sign the data I have to convert everything to fields


  //const signature = Signature.create(privateKey, [Field("werwerwer")]);

  const data: Data = {
    data: outputArray,
    //signature: signature,
    publicKey: signingKey,
  };

  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
  };

  console.log(response);

  return response;
};
