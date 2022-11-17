/*
* First we get the data from the oracle and verify it by checking the signature
* Then we get the latest index from the chain
* Then we batch up 9 accounts
* We do all the assertions, right epoch, right index etc...
*/

import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  Signature,
  UInt64,
  UInt32,
  verify,
  Struct,
  Circuit,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

// Using this value as a test as a nice number of delegates
const VALIDATOR_PUBLIC_KEY = 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg';

// This matches our output
export class Reward extends Struct({
  index: UInt32,
  publicKey: PublicKey,
  delegatingBalance: UInt64,
  rewards: UInt64
}) { // Have the data concatenated here?
}

export class Rewards2 extends Struct(
  [Reward, Reward]) { }

export class PoolPayout extends SmartContract {

  // What state variables do we need to store

  // The Oracle public key (takes 2)
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  // The latest epoch - will init this variable to have a starting point
  @state(Field) currentEpoch = State<Field>();

  // The current index of the payout run
  @state(Field) currentIndex = State<Field>();

  // Validator key
  @state(PublicKey) validatorPublicKey = State<PublicKey>();

  // Deploy this - tighten permissions and move init stuff to an init method
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
      setDelegate: Permissions.impossible(),
      setZkappUri: Permissions.impossible(),
    });

    // Move this to an init() method
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
    this.currentEpoch.set(Field(39));
    this.currentIndex.set(Field(0));
    this.validatorPublicKey.set(PublicKey.fromBase58(VALIDATOR_PUBLIC_KEY));

    // TODO emit an event for each payout?
  }

  /*
  @method sendReward(accounts: Rewards2) {

    // Assert the validating key on chain
    let oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // Assert the epoch
    let currentEpoch = this.currentEpoch.get();
    //currentEpoch.assertEquals(Field(39));
    Circuit.log(currentEpoch);

    let currentIndex = this.currentIndex.get();
    Circuit.log(currentIndex);

    for (let [_, value] of Object.entries(accounts)) {
      this.send({
        to: value.publicKey,
        //amount: value.rewards,
        amount: 1_000_000
      });
    };
    // TODO lets send the correct amount when claimed
  }
  */

  @method sendReward(account: Reward) {

    // Assert the validating key on chain
    let oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // Assert the epoch
    let currentEpoch = this.currentEpoch.get();
    this.currentEpoch.assertEquals(this.currentEpoch.get());
    Circuit.log(currentEpoch);

    let currentIndex = this.currentIndex.get();
    this.currentIndex.assertEquals(this.currentIndex.get());
    Circuit.log(currentIndex);

    this.send({
      to: account.publicKey,
      //amount: account.rewards,
      amount: 1_000_000
    });

  }

  @method claimReward() {
    // TO IMPLEMENT
    // Can only claim rewards when all payouts have been sent for an epoch
    // This also updates the epoch to the next epoch, i.e. epoch is over...
  }

  @method closeEpoch() {
    // maybe ensure everything claimed
  }

}

// We'll use a seperate fee payer so we can increment the nonces properly. This also simplifies the handling of fees.


