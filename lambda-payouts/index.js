"use strict";
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
exports.handler = async (event) => {
    await snarkyjs_1.isReady;
    // Get the event from Lambda URI
    const eventKey = event.queryStringParameters.publicKey;
    const epochEvent = event.queryStringParameters.epoch;
    let indexEvent = event.queryStringParameters.index || 0;
    // Local debugging
    //const eventKey = "B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg";
    //const epochEvent = "39";
    //let indexEvent = 58;
    //const limit = 9;
    // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
    // Currently useful for testing
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
    const numDelegators = stakingData.length;
    console.log("There are " + numDelegators + " delegators in the pool");
    /*Calculate rewards*/
    const poolBalance = stakingData.reduce((sum, current) => sum + current.balance, 0);
    console.log("The pool balance is " + poolBalance);
    /* Simplest payout algorithm - can tweak this later
    /* Assuming no supercharged rewards moving forward
    /* We'll just split the total rewards for each block
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
    let outputArray = [];
    var signedData = [];
    // Trim the staking data to match our index and limit
    let trimmedStakingData = stakingData.slice(indexEvent, Number(indexEvent) + 8);
    // Anyone who is in this list will be getting a reward
    trimmedStakingData.forEach((staker) => {
        let delegatingKey = staker.public_key;
        // Convert to nanomina and force to an int
        let delegatingBalance = staker.balance;
        // Determine individual staking rewards based on percentage of pool
        let rewards = Math.trunc((delegatingBalance / poolBalance) * totalPoolToShare);
        // Format 
        const indexToField = snarkyjs_1.UInt32.from(indexEvent);
        const publicKeyToField = snarkyjs_1.PublicKey.fromBase58(delegatingKey);
        const rewardsToField = snarkyjs_1.UInt64.from(rewards);
        // Concat the fields to sign all this data
        signedData = signedData.concat(indexToField.toFields()).concat(publicKeyToField.toFields()).concat(rewardsToField.toFields());
        // Add this to our response
        outputArray.push({
            "index": indexToField,
            "publicKey": publicKeyToField,
            "rewards": rewardsToField,
        });
        indexEvent++;
    });
    // Handle the case where we have less than 8
    // We have to pass a fixed sized array into the zkApp
    for (let i = trimmedStakingData.length; i < 8; i++) {
        signedData = signedData.concat(snarkyjs_1.UInt32.from(0).toFields()).concat(snarkyjs_1.PublicKey.empty().toFields()).concat(snarkyjs_1.UInt64.from(0).toFields());
        outputArray.push({
            index: snarkyjs_1.UInt32.from(0),
            publicKey: snarkyjs_1.PublicKey.empty(),
            rewards: snarkyjs_1.UInt64.from(0)
        });
    }
    // Add data for the fee payout
    const epochToField = snarkyjs_1.UInt32.from(epochEvent);
    const numDelegatesToField = snarkyjs_1.UInt32.from(numDelegators);
    const payoutToField = snarkyjs_1.UInt64.from(totalPoolToShare);
    // Add the validator key so we can commit to it
    const validatorToField = snarkyjs_1.PublicKey.fromBase58(eventKey);
    // We have signed all the reward data already
    signedData = signedData.concat(epochToField.toFields()).concat(numDelegatesToField.toFields()).concat(payoutToField.toFields().concat(validatorToField.toFields()));
    const signature = snarkyjs_1.Signature.create(privateKey, signedData);
    const feePayout = {
        "numDelegates": numDelegatesToField,
        "payout": payoutToField
    };
    const data = {
        rewards: outputArray,
        epoch: epochToField,
        feePayout: feePayout,
        validatorKey: validatorToField,
        publicKey: signingKey,
        signature: signature
    };
    const response = {
        statusCode: 200,
        body: JSON.stringify(data),
    };
    //console.log(response);
    return response;
};
