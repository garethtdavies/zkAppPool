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
  UInt32,
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
  let delegatorPrivateKeys: Record<number, PrivateKey>;
  let validatorPublicKey: PublicKey;
  let oraclePublicKey: PublicKey;

  let pool: PoolPayout;

  /**
   * Helper method to call in `before` blocks
   * This will reset the local blockchain and redeploy a contract
   */
  const setupPool = async () => {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    zkappPrivateKey = Local.testAccounts[1].privateKey;
    zkappAddress = zkappPrivateKey.toPublicKey();

    deployerPrivateKey = Local.testAccounts[0].privateKey;
    delegatorPrivateKeys = {
      0: Local.testAccounts[2].privateKey,
      1: Local.testAccounts[3].privateKey,
      2: Local.testAccounts[4].privateKey,
      3: Local.testAccounts[5].privateKey,
    }
    validatorPublicKey = PublicKey.fromBase58(poolPayoutConfig.validatorPublicKey);
    oraclePublicKey = PublicKey.fromBase58(poolPayoutConfig.oraclePublicKey);

    pool = new PoolPayout(zkappAddress);

    // setup
    const tx = await Mina.transaction(deployerPrivateKey, () => {
      AccountUpdate.fundNewAccount(deployerPrivateKey);
      pool.deploy({ zkappKey: zkappPrivateKey });
      const createValidatorAccount = AccountUpdate.create(deployerPrivateKey.toPublicKey());
      createValidatorAccount.send({ to: validatorPublicKey, amount: 1 });
      createValidatorAccount.requireSignature();
    });
    tx.sign([deployerPrivateKey]);
    await tx.send();
  };

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  describe('deploy state', () => {
    /**
     * Setup a fresh contract before running this describe block
     * Only need to run this once, as the tests do not interfere with each other
     */
    beforeAll(async () => {
      await setupPool();
    });

    it('cannot redeploy', async () => {
      const pool = new PoolPayout(zkappAddress);
      const tx = await Mina.transaction(deployerPrivateKey, () => {
        pool.deploy({ zkappKey: zkappPrivateKey });
      });
      tx.sign([deployerPrivateKey]);
      await expect(async () => {
        await tx.send();
      }).rejects.toThrow("Transaction verification failed: Cannot update field 'appState' because permission for this field is 'Proof', but the required authorization was not provided or is invalid.");
    });
  
    it('initializes correctly', async () => {
      const pool = new PoolPayout(zkappAddress);
      const appState = Mina.getAccount(pool.address).appState!;

      expect(appState[0].toString()).toBe(String(poolPayoutConfig.deployEpoch));
      expect(appState[1].toString()).toBe(String(poolPayoutConfig.deployIndex));
      expect(appState[2].toString()).toBe(String(poolPayoutConfig.validatorFee));
      expect(appState[3].toString()).toBe(oraclePublicKey.x.toString());
      expect(appState[4].toString()).toBe(oraclePublicKey.isOdd.toField().toString());
      expect(appState[5].toString()).toBe(validatorPublicKey.x.toString());
      expect(appState[6].toString()).toBe(validatorPublicKey.isOdd.toField().toString());
    });
  
    it('cannot trivially update state', async () => {
      const dummyFeePct = '100';
      const pool = new PoolPayout(zkappAddress);
      const tx = await Mina.transaction(deployerPrivateKey, () => {
        pool.feePercentage.set(UInt32.from(dummyFeePct));
      });
      tx.sign([deployerPrivateKey]);
      await tx.send();
      
      const appState = Mina.getAccount(pool.address).appState!;

      expect(appState[2].toString()).toBe(String(poolPayoutConfig.validatorFee));
      expect(appState[2].toString()).not.toBe(dummyFeePct);
    });
  });

  describe('#sendReward', () => {
    let startingDelegatorBalances: Record<number, UInt64>;
    let startingZkAppBalance: UInt64;
    let startingValidatorBalance: UInt64;
    let rewardFields: Rewards2;
    let feePayout: FeePayout;
    let signedData: Field[];
    let signature: Signature;

    /**
     * Setup a fresh contract before running this describe block
     * Will run this again in child block if necessary
     */
    beforeAll(async () => {
      await setupPool();

      startingDelegatorBalances = {};
      Object.keys(delegatorPrivateKeys).map((i) => {
        startingDelegatorBalances[i] = Mina.getAccount(delegatorPrivateKeys[i].toPublicKey()).balance;
      });
      startingZkAppBalance = Mina.getAccount(zkappAddress).balance;

      startingValidatorBalance = Mina.getAccount(validatorPublicKey).balance;
    });

    /**
     * Within the context of the #sendReward tests, before each we
     * - store the starting balances of our accounts
     * - initialize an empty rewards, fee payout, and signature
     * 
     * These values can be set more specifically, later, in tests
     */
    beforeEach(() => {
      rewardFields = { rewards: [] };
      for(let i=0; i<poolPayoutConfig.rewardsArrayLength; i++) {
        rewardFields.rewards.push(Reward.blank());
      }

      feePayout = new FeePayout({
        numDelegates: Field(0),
        payout: UInt64.from(1000).mul(1000), // TODO while testing use 1000th of the rewards to make it easy
      })

      signedData = [];
      rewardFields.rewards.forEach((reward) => {
        signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
      })
      signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

      if(poolPayoutConfig.oraclePrivateKey) {
        signature = Signature.create(
          PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
          signedData
        )
      } else {
        throw("Cannot test without the oracle private key");
      }
    });

    describe('invalid usage', () => {
      it('throws for invalid epoch', async () => {
        const invalidEpoch = Field(0);

        await expect(async () => {
          await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, invalidEpoch, Field(poolPayoutConfig.deployIndex), signature);
          });
        }).rejects.toThrow("The epoch must match");
      });

      it('throws for invalid index', async () => {
        const invalidIndex = Field(999);

        let tx = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
          pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), invalidIndex, signature);
        });
        tx.sign([deployerPrivateKey]);
        await tx.prove();

        // Interesting that this throws later than the other errors... Might be good practice to catch this earlier
        await expect(async () => {
          await tx.send();
        }).rejects.toThrow("Account_app_state_precondition_unsatisfied");
      });

      it('throws for invalid signature', async () => {
        const invalidSignature = Signature.create(
          PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey!),
          [Field(0), Field(1)]
        );

        await expect(async () => {
          await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(poolPayoutConfig.deployIndex), invalidSignature);
          });
        }).rejects.toThrow("The signature does not match that of the oracle");
      });

      /**
       * TODO: Validator key is not an input to the method, so I don't see how it can be "invalid"
       */
      // it('throws for invalid validator key', async () => {});

      /**
       * TODO: Implement this in the contract
       */
      // it('throws if called on current or future block', async () => {});
    });
    describe('correct usage', () => {
      describe('<= n payments', () => {
        /**
         * Within the context of using #sendRewards correctly for a single iteration of rewards payouts, before all we
         * - set a non-blank reward for each account
         * - recreate the signature, overriding the default blank one
         * - send the transaction
         */
        beforeAll(async () => {
          await setupPool();

          // number of payouts to process
          const n = poolPayoutConfig.rewardsArrayLength;
          if(n > Object.keys(delegatorPrivateKeys).length) {
            throw("Rewards array length is too long for testing.  Either configure a shorter length, or add additional keys to the test")
          }
          const totalRewards = 1000;

          feePayout = new FeePayout({
            numDelegates: Field(n),
            payout: UInt64.from(totalRewards).mul(1000), // TODO while testing use 1000th of the rewards to make it easy
          })

          for(let i=0; i<n; i++) {
            rewardFields.rewards[i].index = Field(i);
            rewardFields.rewards[i].publicKey = delegatorPrivateKeys[i].toPublicKey();
            rewardFields.rewards[i].rewards = UInt64.from(totalRewards / n).mul(1000); // TODO while testing use 1000th of the rewards to make it easier
          }
    
          signedData = [];
          rewardFields.rewards.forEach((reward) => {
            signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
          })
          signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());
    
    
          if(poolPayoutConfig.oraclePrivateKey) {
            signature = Signature.create(
              PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
              signedData
            )
          } else {
            throw("Cannot test without the oracle private key");
          }

          let tx = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(poolPayoutConfig.deployIndex), signature);
          });
          tx.sign([deployerPrivateKey]);
          await tx.prove();
          await tx.send();
        });

        it('Sets index to 0', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[1].toString()).toBe('0');
        });

        it('updates the state epoch', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[0].toString()).toBe(String(poolPayoutConfig.deployEpoch + 1));
        });

        it('pays each delegator', async () => {
          const n = poolPayoutConfig.rewardsArrayLength;
          const totalRewards = 1000;
          const validatorFee = poolPayoutConfig.validatorFee / 100;
          const expectedPayout = (totalRewards / n) * (1 - validatorFee);

          Object.keys(startingDelegatorBalances).forEach((i) => {
            const accountBalance = Mina.getBalance(delegatorPrivateKeys[i].toPublicKey());
            
            if(Number(i) < n) {
              accountBalance.sub(startingDelegatorBalances[i]).toString();
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe(String(expectedPayout));
            } else {
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe('0');
            }
          });
        });

        it('pays the validator', async () => {
          const n = poolPayoutConfig.rewardsArrayLength;
          const totalRewards = 1000;
          const validatorFee = poolPayoutConfig.validatorFee / 100;
          const expectedPayout = totalRewards * validatorFee;

          const accountBalance = Mina.getBalance(validatorPublicKey);
          expect(accountBalance.sub(startingValidatorBalance).toString()).toBe(String(expectedPayout));
        });
      });

      describe('> n payments', () => {
        /**
         * Within the context of using #sendRewards correctly for a multi iteration of rewards payouts
         * For the first iteration, before all we
         * - set a non-blank reward for each account
         * - recreate the signature, overriding the default blank one
         * - send the transaction
         */
        beforeAll(async () => {
          await setupPool();

          // number of payouts to process
          const n = poolPayoutConfig.rewardsArrayLength + 1;
          // batch size
          const b = poolPayoutConfig.rewardsArrayLength;
          if(n > Object.keys(delegatorPrivateKeys).length) {
            throw("Rewards array length is too long for testing.  Either configure a shorter length, or add additional keys to the test")
          }
          const totalRewards = 1200;

          feePayout = new FeePayout({
            numDelegates: Field(n),
            payout: UInt64.from(totalRewards).mul(1000), // TODO while testing use 1000th of the rewards to make it easy
          })

          for(let i=0; i<b; i++) {
            rewardFields.rewards[i].index = Field(i);
            rewardFields.rewards[i].publicKey = delegatorPrivateKeys[i].toPublicKey();
            rewardFields.rewards[i].rewards = UInt64.from(totalRewards / n).mul(1000); // TODO while testing use 1000th of the rewards to make it easier
          }
    
          signedData = [];
          rewardFields.rewards.forEach((reward) => {
            signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
          })
          signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());
    
    
          if(poolPayoutConfig.oraclePrivateKey) {
            signature = Signature.create(
              PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
              signedData
            )
          } else {
            throw("Cannot test without the oracle private key");
          }

          let tx = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(poolPayoutConfig.deployIndex), signature);
          });
          tx.sign([deployerPrivateKey]);
          await tx.prove();
          await tx.send();
        });
        it('updates the state index', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[1].toString()).toBe(String(poolPayoutConfig.rewardsArrayLength));
        });

        it('does not update the state epoch', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[0].toString()).toBe(String(poolPayoutConfig.deployEpoch));
        });

        it('pays first b delegators', async () => {
          const n = poolPayoutConfig.rewardsArrayLength + 1;
          const b = poolPayoutConfig.rewardsArrayLength;
          const totalRewards = 1200;
          const validatorFee = poolPayoutConfig.validatorFee / 100;
          const expectedPayout = (totalRewards / n) * (1 - validatorFee);

          Object.keys(startingDelegatorBalances).forEach((i) => {
            const accountBalance = Mina.getBalance(delegatorPrivateKeys[i].toPublicKey());
            
            if(Number(i) < b) {
              accountBalance.sub(startingDelegatorBalances[i]).toString();
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe(String(expectedPayout));
            } else {
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe('0');
            }
          });
        });

        it('does not pay the validator', async () => {
          const accountBalance = Mina.getBalance(validatorPublicKey);
          expect(accountBalance.sub(startingValidatorBalance).toString()).toBe('0');
        });
      });

      describe('Complete > n payments', () => {
        /**
         * Within the context of using #sendRewards correctly for a multi iteration of rewards payouts
         * For the final iteration, before all we
         * - set a non-blank reward for each account
         * - pre-play the first transaction(s) to reach the expected state
         * - recreate the signature, overriding the default blank one
         * - send the transaction
         */
        beforeAll(async () => {
          await setupPool();

          // number of payouts to process
          const n = poolPayoutConfig.rewardsArrayLength + 1;
          // batch size
          const b = poolPayoutConfig.rewardsArrayLength;
          if(n > Object.keys(delegatorPrivateKeys).length) {
            throw("Rewards array length is too long for testing.  Either configure a shorter length, or add additional keys to the test")
          }
          const totalRewards = 1200;

          feePayout = new FeePayout({
            numDelegates: Field(n),
            payout: UInt64.from(totalRewards).mul(1000), // TODO while testing use 1000th of the rewards to make it easy
          })

          for(let i=0; i<b; i++) {
            rewardFields.rewards[i].index = Field(i);
            rewardFields.rewards[i].publicKey = delegatorPrivateKeys[i].toPublicKey();
            rewardFields.rewards[i].rewards = UInt64.from(totalRewards / n).mul(1000); // TODO while testing use 1000th of the rewards to make it easier
          }
    
          signedData = [];
          rewardFields.rewards.forEach((reward) => {
            signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
          })
          signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());
    
    
          if(poolPayoutConfig.oraclePrivateKey) {
            signature = Signature.create(
              PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
              signedData
            )
          } else {
            throw("Cannot test without the oracle private key");
          }

          let tx = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(poolPayoutConfig.deployIndex), signature);
          });
          tx.sign([deployerPrivateKey]);
          await tx.prove();
          await tx.send();

          // ----- Setup for the final transaction -------
          if ((n-b) > poolPayoutConfig.rewardsArrayLength) {
            throw("The test is setup such that the second batch of payouts is the final.  The current config breaks this assumption.")
          }
          // Clear previous rewards array
          rewardFields = { rewards: [] };
          for(let i=0; i<poolPayoutConfig.rewardsArrayLength; i++) {
            rewardFields.rewards.push(Reward.blank());
          }

          for(let i=b; i<n; i++) {
            rewardFields.rewards[i-b].index = Field(i);
            rewardFields.rewards[i-b].publicKey = delegatorPrivateKeys[i].toPublicKey();
            rewardFields.rewards[i-b].rewards = UInt64.from(totalRewards / n).mul(1000); // TODO while testing use 1000th of the rewards to make it easier
          }
    
          signedData = [];
          rewardFields.rewards.forEach((reward) => {
            signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields())
          })
          signedData = signedData.concat(Field(poolPayoutConfig.deployEpoch).toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());
    
    
          if(poolPayoutConfig.oraclePrivateKey) {
            signature = Signature.create(
              PrivateKey.fromBase58(poolPayoutConfig.oraclePrivateKey),
              signedData
            )
          } else {
            throw("Cannot test without the oracle private key");
          }

          let tx2 = await Mina.transaction({ feePayerKey: deployerPrivateKey, fee: 1_000_000_000 }, () => {
            pool.sendReward(rewardFields, feePayout, Field(poolPayoutConfig.deployEpoch), Field(b), signature);
          });
          tx2.sign([deployerPrivateKey]);
          await tx2.prove();
          await tx2.send();
        });

        it('Sets index to 0', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[1].toString()).toBe('0');
        });

        it('updates the state epoch', async () => {
          const appState = Mina.getAccount(pool.address).appState!;

          expect(appState[0].toString()).toBe(String(poolPayoutConfig.deployEpoch + 1));
        });

        it('pays each delegator', async () => {
          const n = poolPayoutConfig.rewardsArrayLength + 1;
          const totalRewards = 1200;
          const validatorFee = poolPayoutConfig.validatorFee / 100;
          const expectedPayout = (totalRewards / n) * (1 - validatorFee);

          Object.keys(startingDelegatorBalances).forEach((i) => {
            const accountBalance = Mina.getBalance(delegatorPrivateKeys[i].toPublicKey());
            
            if(Number(i) < n) {
              accountBalance.sub(startingDelegatorBalances[i]).toString();
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe(String(expectedPayout));
            } else {
              expect(accountBalance.sub(startingDelegatorBalances[i]).toString()).toBe('0');
            }
          });
        });

        it('pays the validator', async () => {
          const n = poolPayoutConfig.rewardsArrayLength;
          const totalRewards = 1200;
          const validatorFee = poolPayoutConfig.validatorFee / 100;
          const expectedPayout = totalRewards * validatorFee;

          const accountBalance = Mina.getBalance(validatorPublicKey);
          expect(accountBalance.sub(startingValidatorBalance).toString()).toBe(String(expectedPayout));
        });
      });
    });
  });
});
