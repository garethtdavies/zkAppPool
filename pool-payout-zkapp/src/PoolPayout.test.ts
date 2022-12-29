import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Field,
  Signature,
  UInt64,
} from 'snarkyjs';

import { PoolPayout, Reward, Rewards2, FeePayout } from './PoolPayout';
import { BERKELEY_CONFIG, TEST_CONFIG, type PoolPayoutConfig } from './utils/constants';

import Dotenv from "dotenv";

Dotenv.config();
let poolPayoutConfig: PoolPayoutConfig;
switch(process.env.ENV) {
  case 'MAIN_NET':
    throw("Main net not supported yet");
  case 'BERKELY':
    poolPayoutConfig = BERKELEY_CONFIG;
    break;
  case 'TEST':
  default:
    poolPayoutConfig = TEST_CONFIG;
}

await isReady;
await PoolPayout.compile();

describe('pool payout', () => {
  let zkappPrivateKey: PrivateKey;
  let zkappAddress: PublicKey;

  let deployerPrivateKey: PrivateKey;
  let delegator1PrivateKey: PrivateKey;
  let validatorPublicKey: PublicKey;

  beforeEach(async () => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    zkappPrivateKey = Local.testAccounts[2].privateKey;
    zkappAddress = zkappPrivateKey.toPublicKey();

    deployerPrivateKey = Local.testAccounts[0].privateKey;
    delegator1PrivateKey = Local.testAccounts[1].privateKey;
    validatorPublicKey = PublicKey.fromBase58(poolPayoutConfig.validatorPublicKey);
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  describe('deploy state', () => {
    it('cannot redeploy', async () => {
    });
  
    it('initializes correctly', async () => {
  
    });
  
    it('cannot trivially update state', async () => {
  
    });
  });

  describe('#sendReward', () => {
    describe('invalid usage', () => {
      it('throws for invalid epoch', async () => {

      });

      it('throws for invalid epoch', async () => {

      });

      it('throws for invalid signature', async () => {

      });

      it('throws for invalid validator key', async () => {

      });

      it('throws if called on current or future block', async () => {

      });
    });
    describe('correct usage', () => {
      describe('<= n payments', () => {
        it('updates the state index', async () => {

        });

        it('updates the state epoch', async () => {

        });

        it('pays each delegator', async () => {

        });
      });

      describe('> n payments', () => {
        it('updates the state index', async () => {

        });

        it('does not update the state epoch', async () => {

        });

        it('pays first n delegators', async () => {

        });
      });

      describe('Complete > n payments', () => {
        it('updates the state index', async () => {

        });

        it('updates the state epoch', async () => {

        });

        it('pays each delegator', async () => {

        });
      });
    });
  });

  // Integration tests with real oracle data
  // Test for rounding errors / balance empty


  it('pays out', async () => {
    // setup
    const pool = new PoolPayout(zkappAddress);
    const tx = await Mina.transaction(deployerPrivateKey, () => {
      AccountUpdate.fundNewAccount(deployerPrivateKey);
      pool.deploy({ zkappKey: zkappPrivateKey });
      const createValidatorAccount = AccountUpdate.create(deployerPrivateKey.toPublicKey());
      createValidatorAccount.send({ to: validatorPublicKey, amount: 1 });
      createValidatorAccount.requireSignature();
    });
    tx.sign([deployerPrivateKey]);
    await tx.send();

    const startingDelegator1Balance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    const startingZkAppBalance = Mina.getAccount(zkappAddress).balance;
    const startingValidatorBalance = Mina.getAccount(validatorPublicKey).balance;
    console.log(`Delegator Starting Balance: ${startingDelegator1Balance.toString()} ${delegator1PrivateKey.toPublicKey().toBase58()}`)
    console.log(`ZKAPP starting balance: ${startingZkAppBalance.toString()} ${zkappPrivateKey.toPublicKey().toBase58()}`)
    console.log(`Validator starting balance: ${startingValidatorBalance.toString()} ${validatorPublicKey.toBase58()}`)


    /**
     * Setting up case
     * One delegator receives all of the rewards
     * Rest of delegators are empty
     */
    let rewardFields: Rewards2 = {
      rewards: [
        Reward.blank(), Reward.blank()
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
    signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

    // TODO temp this is the same as in the lambda-payouts oracle but need to find a different way
    let signature: Signature;
    if(poolPayoutConfig.oraclePrivateKey) {
      signature = Signature.create(
        PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
        signedData
      )
    } else {
      throw("Cannot test without the oracle private key");
    }
    

    // Make the payouts
    let tx2 = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
      pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(poolPayoutConfig.deployIndex), signature);
    });
    tx2.sign([deployerPrivateKey]);
    console.log("Proving transaction");
    await tx2.prove();

    console.log("Sending transaction");
    console.log(tx2.toPretty());
    await tx2.send();

    // Payouts | Delegator 1: 950, Validator: 50
    const delegator1Balance = Mina.getAccount(delegator1PrivateKey.toPublicKey()).balance;
    const validatorBalance = Mina.getAccount(validatorPublicKey).balance;
    expect(delegator1Balance.sub(startingDelegator1Balance).toString()).toBe('950');
    expect(validatorBalance.sub(startingValidatorBalance).toString()).toBe('50');

    // ZkAPP has paid out 1000 total
    const zkappBalance = Mina.getAccount(zkappAddress).balance;
    expect(startingZkAppBalance.sub(zkappBalance).toString()).toBe('1000');

    // Epoch has advanced
    const zkappState = Mina.getAccount(zkappAddress).appState;
    expect(zkappState![0].toString()).toBe(Field(poolPayoutConfig.deployEpoch + 1).toString());
  });
});
