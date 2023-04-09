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
const ORACLE_PUBLIC_KEY = 'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

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
  await txn.send();
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
    console.log(zkAppAddress.toBase58());
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkAppInstance.oraclePublicKey.get();
    console.log(oraclePublicKey.toBase58());
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

      const epoch = UInt32.from(data.data.epoch);
      const publicKey = PublicKey.fromBase58(data.data.publicKey);
      const producerKey = PublicKey.fromBase58(data.data.producerKey);
      const blocksWon = UInt32.from(data.data.blocksWon);
      const delegatedBalance = UInt64.from(data.data.delegatedBalance);
      const totalDelegatedBalance = UInt64.from(data.data.totalDelegatedBalance);
      const amountOwed = UInt64.from(data.data.amountOwed);
      const amountSent = UInt64.from(data.data.amountSent);
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
      await txn.send();

      // Test against these emitted after got it working
      const events = await zkAppInstance.fetchEvents();
    });
  });

  describe('hardcoded values', () => {
    it('emits event if everything is valid', async () => {
      const zkAppInstance = new DelegationOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const epoch = UInt32.from(38);
      const publicKey = PublicKey.fromBase58("B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz");
      const producerKey = PublicKey.fromBase58("B62qpLST3UC1rpVT6SHfB7wqW2iQgiopFAGfrcovPgLjgfpDUN2LLeg");
      const blocksWon = UInt32.from(9);
      const delegatedBalance = UInt64.from(951659889077537);
      const totalDelegatedBalance = UInt64.from(951659889077537);
      const amountOwed = UInt64.from(6156000000000);
      const amountSent = UInt64.from(11628000000000);
      const signature = Signature.fromJSON({
        r: '11178104113474293670471888220696304416600280095673567481961419203491285971485',
        s: '27565248587410953883411290683130593943413486921108649703344192390853827590628'
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
      await txn.send();

      // Test events after we have this working
      const events = await zkAppInstance.fetchEvents();
    });
  });

  describe('hardcoded values with a proof', () => {
    it('emits event if everything is valid', async () => {
      
      console.log("Compiling")
      await DelegationOracle.compile();

      const zkAppInstance = new DelegationOracle(zkAppAddress);
      await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

      const epoch = UInt32.from(38);
      const publicKey = PublicKey.fromBase58("B62qpBVRzjqFcbzMk3JAFdjruMAoqdHyHiE9XNyshZ5NjGo2gY7CxZz");
      const producerKey = PublicKey.fromBase58("B62qpLST3UC1rpVT6SHfB7wqW2iQgiopFAGfrcovPgLjgfpDUN2LLeg");
      const blocksWon = UInt32.from(9);
      const delegatedBalance = UInt64.from(951659889077537);
      const totalDelegatedBalance = UInt64.from(951659889077537);
      const amountOwed = UInt64.from(6156000000000);
      const amountSent = UInt64.from(11628000000000);
      const signature = Signature.fromJSON({
        r: '11178104113474293670471888220696304416600280095673567481961419203491285971485',
        s: '27565248587410953883411290683130593943413486921108649703344192390853827590628'
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
      await txn.send();

      const events = await zkAppInstance.fetchEvents();
      console.log(events);
    });
  });
});