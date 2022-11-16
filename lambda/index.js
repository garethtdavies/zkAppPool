"use strict";
// This API returns data for the Foundation delegation program
// Using this API in a zkApp you can prove (using MinaExplorer data) that a delegating key
// received the rewards for the stated epoch
// Takes as input the delegating key and the epoch in question
// Can emit the public key, eppoch and whether or not enough payment was sent for the epoch determined by a zkApp
// Invoke function https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz&epoch=38
Object.defineProperty(exports, "__esModule", { value: true });
const snarkyjs_1 = require("snarkyjs");
const graphql_request_1 = require("graphql-request");
// This query gets the delegation balance of the key in question
const query = (0, graphql_request_1.gql) `
query foundationDelegation($pk: String!, $epoch: Int!) {
  stake(query: {public_key: $pk, epoch: $epoch}) {
    delegate
    balance
  }
}
`;
// This query gets the total staked in the pool
const query2 = (0, graphql_request_1.gql) `
query totalStaked($pk: String!, $epoch: Int!) {
  stake(query: {public_key: $pk, epoch: $epoch}) {
    delegationTotals {
      totalDelegated
    }
  }
}
`;
// This query gets the number of blocks won by the producer
const query3 = (0, graphql_request_1.gql) `
query blocksWon($pk: String!, $epoch: Int!) {
  blocks(query: {transactions: {coinbase_ne: "0"}, protocolState: {consensusState: {epoch: $epoch}}, canonical: true, creator: $pk}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {
    blockHeight
  }
}
`;
// This query gets the total amount received to an address between slot numbers
// Slot numbers are slow so we get the block heights
const query4 = (0, graphql_request_1.gql) `
query minBlockHeight($slotMin: Int!, $slotMax: Int!) {
  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_ASC) {
    blockHeight
  }
}
`;
const query5 = (0, graphql_request_1.gql) `
query maxBlockHeight($slotMin: Int!, $slotMax: Int!) {
  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_DESC) {
    blockHeight
  }
}
`;
const query6 = (0, graphql_request_1.gql) `
query receivedAmounts($pk: String!, $blockMin: Int!, $blockMax: Int!) {
  transactions(query: {to: $pk, canonical: true, blockHeight_gte: $blockMin, blockHeight_lte: $blockMax}) {
    amount
  }
}
`;
exports.handler = async (event) => {
    await snarkyjs_1.isReady;
    // get the event from Lambda URI
    const eventKey = event.queryStringParameters.publicKey;
    const epochEvent = event.queryStringParameters.epoch;
    let minSlotNumber = (epochEvent * 7140) + 3501;
    let maxSlotNumber = ((epochEvent + 1) * 7140) + 3500;
    console.log(minSlotNumber);
    console.log(maxSlotNumber);
    // TODO REPLACE THIS WITH OUR OWN KEY SERVER BY SECRET ENV
    const privateKey = snarkyjs_1.PrivateKey.fromBase58("EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53");
    // We compute the public key associated with our private key
    const signingKey = privateKey.toPublicKey();
    // Get the balance data
    const balanceData = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query, { pk: eventKey, epoch: epochEvent }).then((data) => {
        return data.stake;
    });
    const epochBalanceData = balanceData.balance;
    const delegatingKeyData = balanceData.delegate;
    // Get the total delegated balance
    const delegatedBalanceData = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query2, { pk: delegatingKeyData, epoch: epochEvent }).then((data) => {
        return data.stake.delegationTotals.totalDelegated;
    });
    // Get the total blocks won
    const blocksWonData = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query3, { pk: delegatingKeyData, epoch: epochEvent }).then((data) => {
        return data.blocks.length;
    });
    // Determine what should be paid
    // We can round down to 5 decimal places
    let payout = Math.floor(0.95 * 720 * (epochBalanceData / delegatedBalanceData) * blocksWonData * 100000) / 100000;
    // Determine what was paid. Find the block heights corresponding to the slots
    const minBlockHeight = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query4, { slotMin: minSlotNumber, slotMax: maxSlotNumber }).then((data) => {
        return data.blocks[0].blockHeight;
    });
    const maxBlockHeight = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query5, { slotMin: minSlotNumber, slotMax: maxSlotNumber }).then((data) => {
        return data.blocks[0].blockHeight;
    });
    const receivedAmounts = await (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query6, { pk: eventKey, blockMin: minBlockHeight, blockMax: maxBlockHeight }).then((data) => {
        return data.transactions;
    });
    // Sum all transactions received
    const sum = receivedAmounts.reduce((sum, current) => sum + current.amount, 0);
    //console.log(sum);
    //console.log(payout);
    //console.log(epochBalanceData);
    //console.log(delegatedBalanceData);
    //console.log(blocksWonData);
    // convert all of our data to fields
    const epoch = snarkyjs_1.UInt32.from(epochEvent);
    const totalDelegatedBalance = snarkyjs_1.UInt64.from(delegatedBalanceData * 1000000000);
    // This is the Foundation/O(1) Labs address
    const publicKey = snarkyjs_1.PublicKey.fromBase58(eventKey);
    // This is the block producer address
    const producerKey = snarkyjs_1.PublicKey.fromBase58(delegatingKeyData);
    const blocksWon = snarkyjs_1.UInt32.from(blocksWonData);
    const delegatedBalance = snarkyjs_1.UInt64.from(epochBalanceData * 1000000000);
    const amountOwed = snarkyjs_1.UInt64.from(payout * 1000000000);
    const amountSent = snarkyjs_1.UInt64.from(sum);
    // Sign all the data
    const signedData = epoch.toFields().concat(publicKey.toFields()).concat(producerKey.toFields()).concat(blocksWon.toFields()).concat(delegatedBalance.toFields()).concat(totalDelegatedBalance.toFields()).concat(amountOwed.toFields()).concat(amountSent.toFields());
    const signature = snarkyjs_1.Signature.create(privateKey, signedData);
    const data = {
        data: {
            "epoch": epoch,
            "publicKey": publicKey,
            "producerKey": producerKey,
            "blocksWon": blocksWon,
            "delegatedBalance": delegatedBalance,
            "totalDelegatedBalance": totalDelegatedBalance,
            "amountOwed": amountOwed,
            "amountSent": amountSent
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
