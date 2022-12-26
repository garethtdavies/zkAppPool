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

    const startingEpoch = Field(10);
    const startingIndex = Field(0);
    const testOracle = PrivateKey.fromBase58(ORACLE_PRIVATE_KEY_TESTING).toPublicKey();

    const tx2 = await Mina.transaction(deployerPrivateKey, () => {
      pool.updateEpoch(startingEpoch);
      pool.updateIndex(startingIndex);
      pool.updateOracle(testOracle);
      pool.updateValidator(validatorPrivateKey.toPublicKey());
    });
    tx2.sign([deployerPrivateKey, zkappPrivateKey]);
    await tx2.prove();
    await tx2.send();
    
    const startingDelegator1Balance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    const startingZkAppBalance = Mina.getAccount(zkappAddress).balance;
    const startingValidatorBalance = Mina.getAccount(validatorPrivateKey.toPublicKey()).balance;
    console.log(`Delegator Starting Balance: ${startingDelegator1Balance.toString()}`)
    console.log(`ZKAPP starting balance: ${startingZkAppBalance.toString()}`)
    console.log(`Validator starting balance: ${startingValidatorBalance.toString()}`)


    /**
     * Setting up case
     * One delegator receives all of the rewards
     * Rest of delegators are empty
     */
    let rewardFields: Rewards2 = {
      rewards: [
        Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank()
      ]
    };
    rewardFields.rewards[0].index = Field(0);
    rewardFields.rewards[0].publicKey = delegator1PrivateKey.toPublicKey();
    rewardFields.rewards[0].rewards = UInt64.from(1000).mul(1000); // TODO while testing use 1000th of the rewards to make it easier

    let feePayout = new FeePayout({
      numDelegates: Field(1),
      payout: UInt64.from(1000).mul(1000), // TODO while testing use 1000th of the rewards to make it easy
    })

    let signedData: Field[] = [];
    rewardFields.rewards.forEach((reward) => {
      signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
    })
    signedData = signedData.concat(startingEpoch.toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

    const signature = Signature.create(
      PrivateKey.fromBase58(ORACLE_PRIVATE_KEY_TESTING),
      signedData
    )

    let tx3 = await Mina.transaction(deployerPrivateKey, () => {
      pool.sendReward(rewardFields, feePayout, startingEpoch, signature);
    });
    tx3.sign([deployerPrivateKey]);
    await tx3.prove();
    await tx3.send();

    // Payouts | Delegator 1: 950, Validator: 50
    const delegator1Balance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    const validatorBalance = Mina.getAccount(validatorPrivateKey.toPublicKey()).balance;
    expect(delegator1Balance.sub(startingDelegator1Balance).toString()).toBe('950');
    expect(validatorBalance.sub(startingValidatorBalance).toString()).toBe('50');

    // ZkAPP has paid out 1000 total
    const zkappBalance = Mina.getAccount(zkappAddress).balance;
    expect(startingZkAppBalance.sub(zkappBalance).toString()).toBe('1000');

    // Epoch has advanced
    const zkappState = Mina.getAccount(zkappAddress).appState;
    expect(zkappState![0].toString()).toBe(Field(startingEpoch.add(1)).toString());
  });
});
