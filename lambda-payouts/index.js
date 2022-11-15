"use strict";
// This will just return precalculated payouts for an epoch payout
// We can then use this in a zkApp or store ina merkle tree
// Need to check in the zkApp that 290 blocks have passed of the epoch after
// Can do that via preconditions
// The zkApp will create the merkle tree?
Object.defineProperty(exports, "__esModule", { value: true });
const snarkyjs_1 = require("snarkyjs");
const graphql_request_1 = require("graphql-request");
// This query gets the blocks won in an epoch for a producer
const query = (0, graphql_request_1.gql) `
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
const query2 = (0, graphql_request_1.gql) `
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
    await snarkyjs_1.isReady;
    // get the event from Lambda URI
    //const eventKey = event.queryStringParameters.publicKey;
    //const epochEvent = event.queryStringParameters.epoch;
    // mock this for testing
    const eventKey = "B62qpge4uMq4Vv5Rvc8Gw9qSquUYd6xoW1pz7HQkMSHm6h1o7pvLPAN";
    const epochEvent = 39;
    // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
    const privateKey = snarkyjs_1.PrivateKey.fromBase58("EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53");
    // We compute the public key associated with our private key
    const signingKey = privateKey.toPublicKey();
    // Get the blocks won
    const blocksData = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query, { creator: eventKey, epoch: epochEvent }).then((data) => {
        return data.blocks;
    });
    //console.log(blocksData);
    // Get the staking balances
    const stakingData = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query2, { delegate: eventKey, epoch: epochEvent }).then((data) => {
        return data.stakes;
    });
    //console.log(stakingData);
    let outputArray = [];
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
            "index": snarkyjs_1.UInt32.from(index),
            "publicKey": snarkyjs_1.PublicKey.fromBase58(delegatingKey),
            "delegatingBalance": snarkyjs_1.UInt64.from(delegatingBalance),
            "rewards": snarkyjs_1.UInt64.from(rewards),
            "epoch": snarkyjs_1.UInt32.from(epochEvent),
        });
        index++;
    });
    //console.log(outputArray);
    // Now to sign the data I have to convert everything to fields
    //const signature = Signature.create(privateKey, [Field("werwerwer")]);
    const data = {
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
