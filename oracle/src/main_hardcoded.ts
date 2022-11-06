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

  const zkAppAddress = PublicKey.fromBase58("B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM");
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
  const response = await fetch(functionUrl);
  const data = await response.json();

  console.log(data);

  // Hardcode the data for now as this test works...

  const epoch = UInt32.fromNumber(38);
  const publicKey = PublicKey.fromBase58("B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz");
  const producerKey = PublicKey.fromBase58("B62qpLST3UC1rpVT6SHfB7wqW2iQgiopFAGfrcovPgLjgfpDUN2LLeg");
  const blocksWon = UInt32.fromNumber(9);
  const delegatedBalance = UInt64.fromNumber(951659889077537);
  const totalDelegatedBalance = UInt64.fromNumber(951659889077537);
  const amountOwed = UInt64.fromNumber(6156000000000);
  const amountSent = UInt64.fromNumber(17784000000000);
  const signature = Signature.fromJSON({
    r: '4585336111649222276312617544050671811572206187060030835626544623230564871660',
    s: '23705120429500629446892768253494096656563972492453883998435780307943658192079'
  });

  let transaction = await Mina.transaction(
    { feePayerKey: feePayerPrivateKey, fee: transactionFee },
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
  await transaction.send().wait();

  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();