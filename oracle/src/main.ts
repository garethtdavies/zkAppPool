// npm run build && node build/src/main.js B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz 38

import { DelegationOracle } from './DelegationOracleVerifier.js';

import {
  Mina,
  PrivateKey,
  PublicKey,
  UInt32,
  UInt64,
  Signature,
} from 'snarkyjs';

(async function main() {

  console.log('SnarkyJS loaded');

  // Connect to Berkeley
  const Berkeley = Mina.Network(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;

  // Let's pass this in via a file (or sign via Auro eventually)
  // This works for testing as anyone can send a proof without funds
  let feePayerPrivateKey = PrivateKey.fromBase58(
    'EKDvE7umHorQrXFq1AAwV4zEDLGtZuqpn1mhsgxvYRneUpKxRUF8'
  );
  let feePayerPublicKey = feePayerPrivateKey.toPublicKey();
  // ----------------------------------------------------

  const zkAppAddress = PublicKey.fromBase58("B62qoDSzH2npmB1jC434dYdmw2gbHvhez2rfmzrj9a58RHe1DQLTgps");
  const zkAppInstance = new DelegationOracle(zkAppAddress);

  console.log('Compiling smart contract...');
  await DelegationOracle.compile();

  // Get the public key and epoch we want to create a proof for via the command line
  const publicKeyInput = process.argv[2];
  const epochInput = process.argv[3];

  // Function URL
  let functionUrl = "https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=" + publicKeyInput + "&epoch=" + epochInput;

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

  console.log(data);

  const epoch = UInt32.from(data.data.epoch);
  const publicKey = PublicKey.fromBase58(data.data.publicKey);
  const producerKey = PublicKey.fromBase58(data.data.producerKey);
  const blocksWon = UInt32.from(data.data.blocksWon);
  const delegatedBalance = UInt64.from(data.data.delegatedBalance);
  const totalDelegatedBalance = UInt64.from(data.data.totalDelegatedBalance);
  const amountOwed = UInt64.from(data.data.amountOwed);
  const amountSent = UInt64.from(data.data.amountSent);
  const signature = Signature.fromJSON(data.signature);

  console.log("Creating the transaction");

  try {
    let transaction = await Mina.transaction(
      { sender: feePayerPublicKey, fee: transactionFee },
      () => {
        //zkAppInstance.init();
        zkAppInstance.verify(
          epoch,
          publicKey,
          producerKey,
          blocksWon,
          delegatedBalance,
          totalDelegatedBalance,
          amountOwed,
          amountSent,
          signature
        );
      }
    );

    await transaction.prove();
    transaction.sign([feePayerPrivateKey]);
    await transaction.send();

  } catch (error: any) {
    console.log("There was an issue creating the proof. Check the amount sent (" + amountSent + ") is greater than the amount owed (" + amountOwed + ")");
    console.log(error.message);
  }

  // ----------------------------------------------------
  console.log('Shutting down');

})();
