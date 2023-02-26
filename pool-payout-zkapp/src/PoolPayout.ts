import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Permissions,
  PublicKey,
  Signature,
  UInt64,
  UInt32,
  Struct,
  Circuit,
  Bool,
} from 'snarkyjs';

import Dotenv from "dotenv";
import { TEST_CONFIG, BERKELEY_CONFIG, PoolPayoutConfig } from './utils/constants.js';

Dotenv.config();
let poolPayoutConfig: PoolPayoutConfig;
switch (process.env.ENV) {
  case 'MAIN_NET':
    throw ("Main net not supported yet");
  case 'BERKELEY':
    poolPayoutConfig = BERKELEY_CONFIG;
    break;
  case 'TEST':
  default:
    poolPayoutConfig = TEST_CONFIG;
}

// The public key of our trusted data provider - this cannot be changed once the contract is deployed.
const ORACLE_PUBLIC_KEY = poolPayoutConfig.oraclePublicKey;

// The public key of the block producer  - this cannot be changed once the contract is deployed.
const VALIDATOR_PUBLIC_KEY = poolPayoutConfig.validatorPublicKey;

// The fee charged by the block producer
const VALIDATOR_FEE = poolPayoutConfig.validatorFee;

// The initial epoch
const INITIAL_EPOCH = poolPayoutConfig.deployEpoch;

// The initial index
const INITIAL_INDEX = poolPayoutConfig.deployIndex;

export class Reward extends Struct({
  index: Field,
  publicKey: PublicKey,
  rewards: UInt64
}) {
  static blank(): Reward {
    return new Reward({
      index: Field(0),
      publicKey: PublicKey.empty(),
      rewards: UInt64.from(0)
    });
  }
  isBlank(): Bool {
    return this.publicKey.equals(PublicKey.empty());
  }
}

export class FeePayout extends Struct({
  numDelegates: Field,
  payout: UInt64
}) { }

export class Rewards2 extends Struct({
  rewards: Circuit.array(Reward, poolPayoutConfig.rewardsArrayLength),
}) { }

export class PoolPayout extends SmartContract {

  // The latest epoch of the payout - this (and all state) can only be updated via a proof.
  @state(Field) currentEpoch = State<Field>();

  // The current index of the payout run.
  @state(Field) currentIndex = State<Field>();

  // The fee of the block producer
  @state(UInt32) feePercentage = State<UInt32>();

  // The oracle public key (takes 2)
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  // Block producer key (takes 2)
  @state(PublicKey) validatorPublicKey = State<PublicKey>();

  // Set the initial state of the zkApp - this is done via a proof and can't then be updated again
  init() {
    super.init()

    this.account.permissions.set({
      ...Permissions.default(),
      editSequenceState: Permissions.proof(),
      editState: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      receive: Permissions.none(),
      send: Permissions.proof(), // Can only send via a proof
      setDelegate: Permissions.proof(), // Could delegate to self 
      setPermissions: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setZkappUri: Permissions.proof(),
    });

    this.currentEpoch.set(Field(INITIAL_EPOCH));
    this.currentIndex.set(Field(INITIAL_INDEX));
    this.feePercentage.set(UInt32.from(VALIDATOR_FEE));
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
    this.validatorPublicKey.set(PublicKey.fromBase58(VALIDATOR_PUBLIC_KEY));
  }

  updateEpoch(n: Field) {
    this.currentEpoch.set(n);
  }

  updateIndex(i: Field) {
    this.currentIndex.set(i);
  }

  updateOracle(publicKey: PublicKey) {
    this.oraclePublicKey.set(publicKey);
  }

  updateValidator(publicKey: PublicKey) {
    this.validatorPublicKey.set(publicKey);
  }

  // This method sends rewards to delegators (up to 8) with a proof.
  // If it is the last payout of the epoch, it sends the block producer rewards.
  // It validates a signature from the oracle.
  // Once complete it updates the state to the latest epoch and epoch.
  @method
  sendReward(accounts: Rewards2, feePayout: FeePayout, epoch: Field, index: Field, validatorKey: PublicKey, signature: Signature) {

    // Get the current epoch stored on-chain
    let currentEpoch = this.currentEpoch.get();
    this.currentEpoch.assertEquals(currentEpoch);
    epoch.assertEquals(currentEpoch, "The epoch must match");

    // Get the current index stored on-chain
    let currentIndex = this.currentIndex.get();
    this.currentIndex.assertEquals(index);
    //Circuit.log(currentIndex);

    // Get the fee stored on-chain.
    const feePercentage = this.feePercentage.get();
    this.feePercentage.assertEquals(feePercentage);

    // Get the oracle public key stored on-chain.
    const oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // Get the block producer stored on-chain.
    let validatorPublicKey = this.validatorPublicKey.get();
    this.validatorPublicKey.assertEquals(validatorKey);
    validatorKey.assertEquals(validatorPublicKey);

    let signedData: Field[] = [];

    // Starting with the index on state, we can increment this variable during this transaction
    let transactionIndex = index;

    for (let i = 0; i < accounts.rewards.length; i++) {
      const reward = accounts.rewards[i];
      const accountIsNotEmpty = Bool.not(reward.publicKey.isEmpty());

      // Assert the index is the same as the current index
      const indexCheck = Bool.or(Bool.not(accountIsNotEmpty), reward.index.equals(transactionIndex));
      indexCheck.assertEquals(Bool(true), "The index must match");

      // Reconstruct the signed data
      signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields());

      // Calculate the rewards
      let payoutPercentage = UInt64.from(100).sub(UInt64.from(feePercentage.toUInt64()));
      let payout = Circuit.if(
        accountIsNotEmpty,
        (() => reward.rewards.mul(payoutPercentage).div(100).div(1000))(), // TODO Temp make this smaller as easier to pay
        (() => UInt64.zero)()
      )
      payout.assertLessThanOrEqual(reward.rewards);

      // If we made it this far we can create the account updates for the transaction. It can still fail when we assert the signature.
      this.send({
        to: reward.publicKey,
        amount: payout
      });

      // Increment the index
      transactionIndex = transactionIndex.add(1);

      // Add precondition for when this can be sent on global slot number
      // There isn't a greater than so specifiy an upper bound that is 2^32 - 1 
      // Have to comment out to test on Berkeley
      //let minimumSlotNumber = epoch.add(1).mul(7140).add(1000);
      //this.network.globalSlotSinceGenesis.assertBetween(UInt32.from(minimumSlotNumber), UInt32.from(4294967295));

    }

    signedData = signedData.concat(epoch.toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields().concat(validatorPublicKey.toFields()));

    const validSignature = signature.verify(oraclePublicKey, signedData);

    // Check that the signature is valid if it isn't the whole transaction will fail
    validSignature.assertTrue("The signature does not match that of the oracle");

    // If we are at the number of delegators we can send the fees to the onchain validated public key
    const [validatorCut, i, e] = Circuit.if(
      transactionIndex.greaterThanOrEqual(feePayout.numDelegates),
      (() => [feePayout.payout.mul(feePercentage.toUInt64()).div(100).div(1000), Field(0), epoch.add(1)])(), //TODO temp make this much smaller for managable payouts
      (() => [UInt64.from(0), transactionIndex, epoch])()
    )

    // Update the on-chain state
    this.currentEpoch.set(e);
    this.currentIndex.set(i);
    this.send({
      to: validatorPublicKey,
      amount: validatorCut
    });
  }
}