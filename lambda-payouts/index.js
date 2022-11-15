"use strict";
// This will just return precalculated payouts for an epoch payout
// TODO this currently doesn't have a fee for the validator
// https://kodem6bg3gatbplrmoiy2sxnty0wfrhp.lambda-url.us-west-2.on.aws/?publicKey=B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg&epoch=39
Object.defineProperty(exports, "__esModule", { value: true });
const snarkyjs_1 = require("snarkyjs");
const graphql_request_1 = require("graphql-request");
// This query gets the blocks won in an epoch for a producer
const query = (0, graphql_request_1.gql) `
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
// This query gets the last block of the epoch in question
const query3 = (0, graphql_request_1.gql) `
query ($epoch: Int) {
  blocks(query: {protocolState: {consensusState: {epoch: $epoch}}, canonical: true}, sortBy: BLOCKHEIGHT_DESC, limit: 1) {
    blockHeight
  }
}
`;
// We need the current block for confirmations
const query4 = (0, graphql_request_1.gql) `
{
  blocks(query: {canonical: true}, sortBy: BLOCKHEIGHT_DESC, limit: 1) {
    blockHeight
  }
}
`;
exports.handler = async (event) => {
    console.log("Let's go...");
    await snarkyjs_1.isReady;
    // The number of confirmations we need
    const confirmations = 15;
    // get the event from Lambda URI
    const eventKey = event.queryStringParameters.publicKey;
    const epochEvent = event.queryStringParameters.epoch;
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
    const numDelegators = stakingData.length;
    console.log("There are " + numDelegators + " delegators in the pool");
    // Get the last block of the epoch in question
    // This enforces we can't run multiple times an epoch as need to wait for it to complete - you could do this differently but this works for now
    const lastBlockOfEpoch = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query3, { epoch: epochEvent }).then((data) => {
        return data.blocks[0].blockHeight;
    });
    console.log("Last block of epoch is: " + lastBlockOfEpoch);
    // Get current height
    const currentHeight = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query4).then((data) => {
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
    let outputArray = [];
    let index = 0;
    var signedData = [];
    // Anyone who is in this list will be getting a reward, asssuming above 0
    stakingData.forEach((staker) => {
        // Can we do this 
        let delegatingKey = staker.public_key;
        // Convert to nanomina and force to an int
        let delegatingBalance = staker.balance;
        // Determine individula staking rewards based on percentage of pool
        let rewards = Math.trunc((delegatingBalance / poolBalance) * totalPoolToShare);
        // Format 
        const indexToField = snarkyjs_1.UInt32.from(index);
        const publicKeyToField = snarkyjs_1.PublicKey.fromBase58(delegatingKey);
        const delegatingBalanceToField = snarkyjs_1.UInt64.from(Math.trunc(delegatingBalance * 1000000000));
        const rewardsToField = snarkyjs_1.UInt64.from(rewards);
        // Concat the fields to sign all this data
        signedData = signedData.concat(indexToField.toFields()).concat(publicKeyToField.toFields()).concat(delegatingBalanceToField.toFields()).concat(rewardsToField.toFields());
        // Add this to our response
        outputArray.push({
            "index": indexToField,
            "publicKey": publicKeyToField,
            "delegatingBalance": delegatingBalanceToField,
            "rewards": rewardsToField,
        });
        // TODO need confirmations here to enforce you can't run this without blocks confirming
        index++;
    });
    const epochToField = snarkyjs_1.UInt32.from(epochEvent);
    const confirmedToField = (0, snarkyjs_1.Bool)(minConfirmations);
    const poolBalanceToField = snarkyjs_1.UInt64.from(Math.trunc(poolBalance * 1000000000));
    const totalRewards = snarkyjs_1.UInt64.from(totalPoolToShare);
    const numDelegatorsFields = snarkyjs_1.UInt32.from(numDelegators);
    // Sign the additional metadata
    signedData.concat(epochToField.toFields()).concat(confirmedToField.toFields()).concat(poolBalanceToField.toFields()).concat(totalRewards.toFields()).concat(numDelegatorsFields.toFields());
    // Sign it with the oracle public key
    const signature = snarkyjs_1.Signature.create(privateKey, signedData);
    const data = {
        data: {
            "epoch": epochToField,
            "confirmed": confirmedToField,
            "poolBalance": poolBalanceToField,
            "totalRewards": totalRewards,
            "numDelegators": numDelegatorsFields,
        },
        rewards: outputArray,
        signature: signature,
        publicKey: signingKey,
    };
    const response = {
        statusCode: 200,
        body: JSON.stringify(data),
    };
    return response;
};
