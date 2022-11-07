# zkAppPool
A zkApp based staking pool for MINA (WIP) developed for the zkApp builders program.

The aim of the project is to research and improve the mechanisms for MINA staking pool payouts. The current major issues are:

* Delegators have to trust the validator calculated the rewards correctly.
* All rewards are custodied by the validator, who can simply not pay or steal funds at their discretion.
* Pool payouts dominate transaction throughput of the network, particularly at the start of an epoch. Due to the number of transactions and block size it is very slow for a payout run for a larger validator to complete.

The overarching goal is to develop a trust-minimized zkApp staking pool such that anyone can, in the case of last resort, force a payout from a validator. A zkApp should verify the payout calculation, and a validator can also not steal funds, which could be held in a coinbase receiver account with permissions to only send via a valid proof.

This repo also contains some other scripts/examples that help in developing the zkApp pool.

## Delegation Program Oracle example
A sample project that uses historical data from the [MinaExplorer GraphQL API](https://berkeley.graphql.minaexplorer.com/) in a zkApp to verify that a delegation program member has made the required payouts for an epoch. If they have, a transaction with an associated event will be broadcast. This can be subsequently read from data stored in an archive server e.g. with a script such as [output.ts](https://github.com/garethtdavies/zkAppPool/blob/main/oracle/src/output.ts). For more details on the delegation program see [here](https://docs.minaprotocol.com/node-operators/foundation-delegation-program).

The **lambda** folder contains an example of an oracle that uses an AWS serverless function, that signs the response from the GraphQL API. An example output is [here](https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz&epoch=38) (could be slow the first time it is run). It takes as inputs a delegating public key and the epoch number.

The **oracle** folder is a zkApp that consumes the oracle data, verifies the signature, and checks to see if the sent amount is greater than the amount required to be sent. If so, the zkApp sends a transaction with an event containing the epoch and both delegator and block producer keys. The zkApp account is [B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM](https://berkeley.minaexplorer.com/wallet/B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM) and is currently upgradable. The zkApp stores the oracle public key B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1 as an on-chain state variable. You can confirm this by manually decoding via [this script](https://github.com/garethtdavies/zkAppPool/blob/main/oracle/src/debug-events.ts).

An example transaction is [here](https://berkeley.minaexplorer.com/transaction/CkpZUfHgefJ3EAb9kFTx6P37qSy6vBRcYPwW72TGnDwv66K67s8WA).

You can query all events for the zkApp using https://berkeley.graphql.minaexplorer.com/ and the following query. Note that the values are returned as fields so need to be converted to e.g. a public key (see the `output.ts` script).

```gql
query getEvents {
  zkapps(query: {zkappCommand: {accountUpdates: {body: {publicKey: "B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM"}}}, canonical: true, failureReason_exists: false}, sortBy: BLOCKHEIGHT_DESC, limit: 100) {
    hash
    blockHeight
    zkappCommand {
      accountUpdates {
        body {
          events
          publicKey
        }
      }
    }
  }
}
```

You can run this for your own key by cloning this repo and entering the value of the key that is delegating:

```
cd oracle
npm install
# Replace the key and epoch you wish the verify here. It will fail (non-gracefully) if the required funds have not been sent
npm run build && node build/src/main.js B62qmRapzi3nrctTihmaeH3CNbsDkpAAmf5osj9SvucNTU7jteFchhZ 39
```

Wait for inclusion in a block, then you can read the values stored as events by running the [output.ts](https://github.com/garethtdavies/zkAppPool/blob/main/oracle/src/output.ts) script:

```
# Wait for inclusion and run from oracle folder
npm run build && node ./build/src/output.js
```

This will output a list of all keys that have sucessfully verified via the zkApp e.g.:
```
39 B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKFWfnXvT4MbtHuiueD B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKHv8hkrgAeqqq6mQ8y
39 B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKFVF255aw3TH4C1Cca B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKG3b5HvLEwBjng3UdF
38 B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKG1niy2McyztRhv98f B62qiTKpEPjGTSHZrtM8uXiKgn8So916pLmNJKFUQAwx6uiqn1gMaLm
```

Note: This is very much a proof of concept. Some testnet keys have been hardcoded into the app to pay for transactions and to sign the data. The oracle only considers the total amount received between slots 3501 of the epoch in question, and slot 3500 of the next epoch, which is how the automated email scripts determine it. If you have paid late, early or have sent different payouts to compensate for earlier epochs it will not take this into account.

Ongoing issue: https://github.com/o1-labs/snarkyjs/issues/530
