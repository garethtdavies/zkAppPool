import {
  PrivateKey,
  Mina,
  isReady,
  shutdown,
  PublicKey,
  UInt64,
  AccountUpdate,
  UInt32,
  fetchAccount,
} from 'snarkyjs';
import * as fs from 'fs';

await isReady;

// Use MinaExplorer GraphQL endpoint
let Berkeley = Mina.BerkeleyQANet(
  'https://proxy.berkeley.minaexplorer.com/graphql'
);
Mina.setActiveInstance(Berkeley);

// Need to track these manually offline
let feePayerNonce = 466;
let senderAddressNonce = 2;

// B62qij84rwTzzTiompizumg46WFAGgQ7bss7ephB47xxag8oDaDsGhX
let feePayerKey = PrivateKey.fromBase58(
  'EKEEvWvRxGzLmb4RY2EFtMMxr2tAbKUnmMUBh6K5iv73VjnassXH'
);
let feePayerAddress = feePayerKey.toPublicKey();

// B62qn5oSwNZfK8bnsZoWLPeFATiBSvaNA68njLWCuh451sHRR77CEdw
let senderAddressKey = PrivateKey.fromBase58(
  'EKE4w9R13UyHuAMo3BoDtsfTohGvpt2pZgfiofMsvH7GXmAJA937'
);

let senderAddress = senderAddressKey.toPublicKey();

// These are the precalculated values that we have determined via a payout script to send
let zkAppSendAddresses = [
  {
    publicKey: 'B62qmQsEHcsPUs5xdtHKjEmWqqhUPRSF2GNmdguqnNvpEZpKftPC69e',
    total: 100_000,
  },
];

// Transaction fee to use
let transactionFee = 100_000_000;

await fetchAccount({ publicKey: feePayerAddress });

// This will increment the nonce for the zkApp tx
for (let i = 0; i < 2; i++) {
  console.log('Making a transfer');
  let tx = await Mina.transaction(
    {
      feePayerKey,
      fee: transactionFee,
      memo: 'Batch differing senders',
      nonce: feePayerNonce,
    },
    () => {
      let payer = AccountUpdate.create(senderAddress);
      for (let [key, value] of Object.entries(zkAppSendAddresses)) {
        payer.send({
          to: PublicKey.fromBase58(value['publicKey']),
          amount: UInt64.from(value['total']),
        });
      }
      payer.sign(senderAddressKey);

      // Manually specify the nonce which is incremented
      payer.account.nonce.assertEquals(UInt32.from(senderAddressNonce));
    }
  );

  // Need to sign the transaction before broadcast
  tx.sign();

  // Write this to a file so we can broadcast seperately
  fs.writeFileSync('payments/' + i + '.json', tx.toGraphqlQuery());

  // Sending the transaction to debug
  await tx.send().wait();

  // Increment the nonces
  console.log('incrementing the nonces');
  feePayerNonce++;
  senderAddressNonce++;
}

shutdown();
