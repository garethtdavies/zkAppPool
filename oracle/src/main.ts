// npm run build && node build/src/main.js B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz 38

import { DelegationOracle } from './DelegationOracleVerifier.js';

import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  UInt32,
  UInt64,
  Signature,
} from 'snarkyjs';

(async function main() {

  await isReady;

  console.log('SnarkyJS loaded');
  
  // Connect to Berkeley
  const Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let transactionFee = 100_000_000;
  let feePayerPrivateKey = PrivateKey.fromBase58(
    'EKF1WVvBi9NVwsnUYiHh272PeWLgiRwDQAJZ2dHxriKFNVcvsc4q'
  );
  // ----------------------------------------------------

  const zkAppAddress = PublicKey.fromBase58("B62qqRJH4TaXxDeyL5yXUafzAmtBcJ53pvDGgXiyKvqgkikcP38SjFs");
  const zkAppInstance = new DelegationOracle(zkAppAddress);
  
  // Get the public key and epoch we want to create a proof for via the command line
  const publicKeyInput = process.argv[2];
  const epochInput = process.argv[3];

  // Function URL
  let functionUrl = "https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=" + publicKeyInput + "&epoch=" + epochInput;

  console.log(functionUrl);

  // Make the API call
  const response = await fetch(
    'https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz&epoch=38'
  );
  const data = await response.json();

  console.log(data);

  const epoch = UInt32.fromNumber(data.data.epoch);
  const publicKey = PublicKey.fromBase58(data.data.publicKey);
  const producerKey = PublicKey.fromBase58(data.data.producerKey);
  const blocksWon = UInt32.fromNumber(data.data.blocksWon);
  const delegatedBalance = UInt64.fromNumber(data.data.delegatedBalance);
  const totalDelegatedBalance = UInt64.fromNumber(data.data.totalDelegatedBalance);
  const amountOwed = UInt64.fromNumber(data.data.amountOwed);
  const amountSent = UInt64.fromNumber(data.data.amountSent);
  const signature = Signature.fromJSON(data.signature);

  let transaction = await Mina.transaction(
    { feePayerKey: feePayerPrivateKey, fee: transactionFee },
    () => {
      zkAppInstance.verify(
        epoch,
        publicKey,
        producerKey,
        blocksWon,
        delegatedBalance,
        totalDelegatedBalance,
        amountOwed,
        amountSent,
        signature ?? fail('something is wrong with the signature')
      );
      // Don't sign...
      zkAppInstance.sign(feePayerPrivateKey);
    }
  );
  
  // ----------------------------------------------------
  console.log('Shutting down');
  
  await shutdown();
})();