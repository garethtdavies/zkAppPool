import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Field,
  Poseidon,
  Circuit,
  Signature,
  Encryption,
  Int64,
  UInt64,
} from 'snarkyjs';

import { PoolPayout, Reward, Rewards2, FeePayout } from './PoolPayout';
import { ORACLE_PRIVATE_KEY_TESTING, VALIDATOR_PRIVATE_KEY_TESTING } from './constants';

await isReady;
await PoolPayout.compile();

describe('pool payout', () => {
  let zkappPrivateKey: PrivateKey;
  let zkappAddress: PublicKey;

  let deployerPrivateKey: PrivateKey;
  let delegator1PrivateKey: PrivateKey;
  let validatorPrivateKey: PrivateKey;

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    zkappPrivateKey = PrivateKey.random();
    zkappAddress = zkappPrivateKey.toPublicKey();

    deployerPrivateKey = Local.testAccounts[0].privateKey;
    delegator1PrivateKey = Local.testAccounts[1].privateKey;
    validatorPrivateKey = PrivateKey.fromBase58(VALIDATOR_PRIVATE_KEY_TESTING);
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  it('pays out', async () => {
    // setup
    const pool = new PoolPayout(zkappAddress);
    const tx = await Mina.transaction(deployerPrivateKey, () => {
      AccountUpdate.fundNewAccount(deployerPrivateKey);
      AccountUpdate.fundNewAccount(deployerPrivateKey);
      pool.deploy({ zkappKey: zkappPrivateKey });
      const fundPool = AccountUpdate.create(deployerPrivateKey.toPublicKey());
      fundPool.send({ to: zkappAddress, amount: 1_000_000_000 });
      fundPool.requireSignature();
      const createValidatorAccount = AccountUpdate.create(deployerPrivateKey.toPublicKey());
      createValidatorAccount.send({ to: validatorPrivateKey.toPublicKey(), amount: 1 });
      createValidatorAccount.requireSignature();
    });
    tx.sign([deployerPrivateKey]);
    await tx.send();
    
    let delegatorBalance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    // expect(delegatorBalance.toString()).toBe('1000');
    console.log(`Delegator Starting Balance: ${delegatorBalance.toString()}`)

    let zkappBalance = Mina.getAccount(zkappAddress).balance;
    // expect(zkappBalance.toString()).toBe('999999000');
    console.log(`ZKAPP starting balance: ${zkappBalance.toString()}`)

    const balance = Mina.getBalance(zkappAddress);
    console.log(`Balance: ${balance.toString()}`);

    const appState = Mina.getAccount(zkappAddress).appState;
    console.log(`App State: ${appState!.toString()}`);

    let rewardFields: Rewards2 = {
      rewards: [
        Reward.blank(),  Reward.blank()
      ]
    };

    rewardFields.rewards[0].index = Field(0);
    rewardFields.rewards[0].publicKey = delegator1PrivateKey.toPublicKey();
    rewardFields.rewards[0].rewards = UInt64.from(1000);

    let feePayout = new FeePayout({
      numDelegates: Field(1),
      payout: UInt64.from(1000),
    })

    let epoch = Field(39);

    let signedData: Field[] = [];
    rewardFields.rewards.forEach((reward) => {
      signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
    })
    signedData = signedData.concat(epoch.toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

    const signature = Signature.create(
      PrivateKey.fromBase58(ORACLE_PRIVATE_KEY_TESTING),
      signedData
    )

    console.log("Sending tx2");
    let tx2 = await Mina.transaction(deployerPrivateKey, () => {
      pool.sendReward(rewardFields, feePayout, epoch, signature);
    });
    tx2.sign([deployerPrivateKey]);
    await tx2.prove();
    await tx2.send();

    console.log("Sent tx2");

    delegatorBalance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    expect(delegatorBalance.toString()).toBe('1000000000950'); // received 950

    zkappBalance = Mina.getAccount(zkappAddress).balance;
    expect(zkappBalance.toString()).toBe('999999000'); // sent 1000

    const zkappState = Mina.getAccount(zkappAddress).appState;
    expect(zkappState![0].toString()).toBe('40'); // epoch has advanced

    const validatorBalance = Mina.getAccount(validatorPrivateKey.toPublicKey()).balance;
    expect(validatorBalance.toString()).toBe('51'); // received 50

  });
});
