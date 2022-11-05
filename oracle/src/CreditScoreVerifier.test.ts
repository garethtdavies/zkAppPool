import { CreditScoreOracle } from './CreditScoreVerifier';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
  UInt64,
  UInt32,
} from 'snarkyjs';
import {jest} from '@jest/globals'

jest.setTimeout(30000);

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: CreditScoreOracle,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    zkAppInstance.init();
    zkAppInstance.sign(zkAppPrivatekey);
  });
  await txn.send().wait();
}

describe('CreditScoreOracle', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `CreditScoreOracle` smart contract', async () => {
    const zkAppInstance = new CreditScoreOracle(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
    expect(oraclePublicKey).toEqual(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  });

  describe('actual API requests', () => {
    it('emits an `id` event containing the users id if their credit score is above 700 and the provided signature is valid', async () => {
      const zkAppInstance = new CreditScoreOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

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

      const txn = await Mina.transaction(deployerAccount, () => {
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
        zkAppInstance.sign(zkAppPrivateKey);
      });
      await txn.send().wait();

      const events = await zkAppInstance.fetchEvents();
      const verifiedEventValue = events[0].event.toFields(null)[0];
      //expect(verifiedEventValue).toEqual(epoch);
      console.log(events);
    });
  });
});