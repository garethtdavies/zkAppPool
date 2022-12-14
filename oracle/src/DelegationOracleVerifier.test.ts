import { DelegationOracle } from './DelegationOracleVerifier';
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
  zkAppInstance: DelegationOracle,
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

describe('DelegationOracle', () => {
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
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `DelegationOracle` smart contract', async () => {
    const zkAppInstance = new DelegationOracle(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
    expect(oraclePublicKey).toEqual(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  });

  describe('actual API requests', () => {
    it('emits an event that the amount paid is valid', async () => {
      const zkAppInstance = new DelegationOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const response = await fetch(
        'https://xiyh2rxrqdnbv3jeaiscukkngi0rkili.lambda-url.us-west-2.on.aws/?publicKey=B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz&epoch=38'
      );
      const data = await response.json();

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

      // Test against these emitted after got it working
      const events = await zkAppInstance.fetchEvents();
    });
  });

  describe('hardcoded values', () => {
    it('emits event if everythiong is valid', async () => {
      const zkAppInstance = new DelegationOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

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

      // Test events after we have this working
      const events = await zkAppInstance.fetchEvents();
    });
  });

  describe('hardcoded values with a proof', () => {
    it('emits event if everythiong is valid', async () => {
      const zkAppInstance = new DelegationOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      console.log("Compiling")
      await DelegationOracle.compile();

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
      });
      await txn.prove();
      await txn.send().wait();

      const events = await zkAppInstance.fetchEvents();
      console.log(events);
    });
  });
});