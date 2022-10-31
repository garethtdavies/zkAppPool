import { isReady, PublicKey, PrivateKey, Field, Signature, UInt32, UInt64 } from "snarkyjs";
import { request, gql } from 'graphql-request';

// This query gets the delegation balance of the key in question
const query = gql`
query foundationDelegation {
  stake(query: {public_key: "B62qjWrka3sHmyX9E3LLk7DYwTkD3xpVxJVWeC1jWesvUCw98jzwLEb", epoch: 38}) {
    delegate
    balance
  }
}
`

// This query gets the total staked in the pool
const query2 = gql`
query totalStaked {
  stake(query: {public_key: "B62qkLn4YDsHjoiRus1G2HmUKUutGbQGTVEtRT6NKaB1RRMYCN2d6JM", epoch: 38}) {
    delegationTotals {
      totalDelegated
    }
  }
}
`

// This query gets the number of blocks won by the producer
const query3 = gql`
query blocksWon {
  blocks(query: {transactions: {coinbase_ne: "0"}, protocolState: {consensusState: {epoch: 38}}, canonical: true, creator: "B62qkLn4YDsHjoiRus1G2HmUKUutGbQGTVEtRT6NKaB1RRMYCN2d6JM"}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {
    blockHeight
  }
}
`

// This query gets the total amount received to an address between slot numbers


exports.handler = async (event) => {

  // Eventually we will process the event and use it to generate the correct response for the key and epoch 
  // but for now, we'll just mock  this data
  await isReady;

  // Define the type that our function (and API) will return
  type Data = {
    data: {
      "epoch": UInt32,
      "publicKey": PublicKey,
      "delegateKey": PublicKey,
      "blocksWon": UInt32,
      "delegatedBalance": UInt64,
      "totalDelegatedBalance": UInt64,
      "amountOwed": UInt64,
      "amountSent": UInt64
    },
    signature: Signature,
    publicKey: PublicKey
  };

  // This is the key we use to sign our data
  const privateKey = PrivateKey.fromBase58(
    "EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53"
  );

  // We compute the public key associated with our private key
  const signingKey = privateKey.toPublicKey();

  // Get the balance data
  const balanceData = await request('https://graphql.minaexplorer.com', query).then((data) => {
    return data.stake.balance;
  });

  // Get the total delegated balance
  const delegatedBalanceData = await request('https://graphql.minaexplorer.com', query2).then((data) => {
    console.log(data);
    return data.stake.delegationTotals.totalDelegated;
  });

  // Get the total blocks won
  const blocksWonData = await request('https://graphql.minaexplorer.com', query3).then((data) => {
    console.log(data);
    return data.blocks.length
  });

  // Determine what should be paid
  // We can round down to 5 decimal places
  let payout = Math.floor(0.95 * 720 * (balanceData / delegatedBalanceData) * blocksWonData * 100000) / 100000;

  console.log(payout);
  console.log(balanceData);
  console.log(delegatedBalanceData);
  console.log(blocksWonData);

  // Mock some fields
  const epoch = UInt32.fromNumber(200);
  const totalDelegatedBalance = UInt64.fromNumber(delegatedBalanceData * 1000000000);
  // This is the Foundation/O(1) Labs address
  const publicKey = PublicKey.fromBase58("B62qjWrka3sHmyX9E3LLk7DYwTkD3xpVxJVWeC1jWesvUCw98jzwLEb");
  // This is the block producer address
  const delegateKey = PublicKey.fromBase58("B62qkLn4YDsHjoiRus1G2HmUKUutGbQGTVEtRT6NKaB1RRMYCN2d6JM");
  const blocksWon = UInt32.fromNumber(blocksWonData);
  const delegatedBalance = UInt64.fromNumber(balanceData * 1000000000);
  const amountOwed = UInt64.fromNumber(338921504);
  const amountSent = UInt64.fromNumber(338921504);

  // Sign all the data
  const data1 = epoch.toFields().concat(publicKey.toFields()).concat(delegateKey.toFields()).concat(blocksWon.toFields()).concat(delegatedBalance.toFields()).concat(totalDelegatedBalance.toFields()).concat(amountOwed.toFields()).concat(amountSent.toFields());

  const signature = Signature.create(privateKey, data1);

  const data: Data = {
    data: {
      "epoch": epoch,
      "publicKey": publicKey,
      "delegateKey": delegateKey,
      "blocksWon": blocksWon,
      "delegatedBalance": delegatedBalance,
      "totalDelegatedBalance": totalDelegatedBalance,
      "amountOwed": amountOwed,
      "amountSent": amountSent
    },
    signature: signature,
    publicKey: publicKey,
  };

  console.log(data)

  const response = {
    statusCode: 200,
    body: JSON.stringify(data),
  };

  return response;
};
