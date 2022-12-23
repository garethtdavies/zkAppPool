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
import { ORACLE_PRIVATE_KEY_TESTING } from './constants';

await isReady;
await PoolPayout.compile();

describe('pool payout', () => {
  let zkappPrivateKey: PrivateKey;
  let zkappAddress: PublicKey;

  let deployerPrivateKey: PrivateKey;
  let delegator1PrivateKey: PrivateKey;

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    zkappPrivateKey = PrivateKey.random();
    zkappAddress = zkappPrivateKey.toPublicKey();

    deployerPrivateKey = Local.testAccounts[0].privateKey;
    delegator1PrivateKey = Local.testAccounts[1].privateKey;
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  it('pays out', async () => {
    // setup
    const pool = new PoolPayout(zkappAddress);
    const tx = await Mina.transaction(deployerPrivateKey, () => {
      AccountUpdate.fundNewAccount(deployerPrivateKey);
      pool.deploy({ zkappKey: zkappPrivateKey });
      const update = AccountUpdate.create(deployerPrivateKey.toPublicKey());
      update.send({ to: zkappAddress, amount: 1_000_000_000 });
      update.requireSignature();
    });
    tx.sign([deployerPrivateKey]);
    await tx.send();

    const balance = Mina.getBalance(zkappAddress);
    console.log(`Balance: ${balance.toString()}`);

    const appState = Mina.getAccount(zkappAddress).appState;
    console.log(`App State: ${appState!.toString()}`);

    let rewardFields: Rewards2 = {
      rewards: [
        Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank(),
        Reward.blank(), Reward.blank(), Reward.blank(), Reward.blank()
      ]
    };

    rewardFields.rewards[0].index = Field(0);
    rewardFields.rewards[0].publicKey = delegator1PrivateKey.toPublicKey();
    rewardFields.rewards[0].rewards = UInt64.from(1_000);

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

    console.log(signedData.toString());

    const signature = Signature.create(
      PrivateKey.fromBase58(ORACLE_PRIVATE_KEY_TESTING),
      signedData
    )
    let tx2 = await Mina.transaction(deployerPrivateKey, () => {
      pool.sendReward(rewardFields, feePayout, epoch, signature);
    });
    tx2.sign([deployerPrivateKey]);
    await tx2.prove();
    await tx2.send();

    const delegatorBalance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    // expect(delegatorBalance.toString()).toBe('1000');
    console.log(`Expected: 1000, Got: ${delegatorBalance.toString()}`)

    const zkappBalance = Mina.getAccount(zkappAddress).balance;
    // expect(zkappBalance.toString()).toBe('999999000');
    console.log(`Expected: 999999000, Got: ${zkappBalance.toString()}`)
  });
});
