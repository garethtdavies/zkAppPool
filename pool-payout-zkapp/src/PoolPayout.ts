/*
TODO use the onchain data for the fee payout
Use the on chain data for calculating the rewards
Handle the case where we have less than 9 in the array
Tidy up keys in scripts
Pass the index by variable to the script
*/
import { check } from 'prettier';
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
  Struct,
  Circuit,
  Bool,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

// Using this value as a test as a nice number of delegates
const VALIDATOR_PUBLIC_KEY = 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg';

// This matches our output
export class Reward extends Struct({
  index: Field,
  publicKey: PublicKey,
  rewards: UInt64
}) { // Have the data concatenated here?
}

export class FeePayout extends Struct({
  numDelegates: Field,
  payout: UInt64
}) { };

export class Rewards2 extends Struct(
  [Reward, Reward, Reward, Reward, Reward, Reward, Reward, Reward]) { }

export class PoolPayout extends SmartContract {

  // The latest epoch - will init this variable to have a starting point
  @state(Field) currentEpoch = State<Field>();

  // The current index of the payout run
  @state(Field) currentIndex = State<Field>();

  // Fee
  @state(UInt32) feePercentage = State<UInt32>();

  // The Oracle public key (takes 2)
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  // Validator key (takes 2)
  @state(PublicKey) validatorPublicKey = State<PublicKey>();

  // Deploy this - tighten permissions and move init stuff to an init method
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editSequenceState: Permissions.proofOrSignature(),
      editState: Permissions.proofOrSignature(),
      incrementNonce: Permissions.proofOrSignature(),
      receive: Permissions.none(),
      send: Permissions.proofOrSignature(),
      setDelegate: Permissions.impossible(),
      setPermissions: Permissions.proofOrSignature(),
      setTokenSymbol: Permissions.proofOrSignature(),
      setVerificationKey: Permissions.proofOrSignature(),
      setVotingFor: Permissions.proofOrSignature(),
      setZkappUri: Permissions.impossible(),
    });

    // Move this to an init() method but this is useful to redeploy
    this.currentEpoch.set(Field(39));
    this.currentIndex.set(Field(0));
    this.feePercentage.set(UInt32.from(5));
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
    this.validatorPublicKey.set(PublicKey.fromBase58(VALIDATOR_PUBLIC_KEY));
  }

  // This method sends the rewards to the validator
  // It verifies the index and epoch from the oracle
  @method sendReward(accounts: Rewards2, feePayout: FeePayout, epoch: Field, signature: Signature) {

    // get the current epoch
    let currentEpoch = this.currentEpoch.get();
    this.currentEpoch.assertEquals(currentEpoch);
    this.currentEpoch.assertEquals(epoch);

    // get the current index
    let currentIndex = this.currentIndex.get();
    this.currentIndex.assertEquals(currentIndex);
    //Circuit.log(currentIndex);

    // get the current fee
    const feePercentage = this.feePercentage.get();
    //Circuit.log(feePercentage);
    this.feePercentage.assertEquals(feePercentage);

    // Assert the validating key on chain
    const oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // get the current validator
    let validatorPublicKey = this.validatorPublicKey.get();
    this.validatorPublicKey.assertEquals(validatorPublicKey);

    // Assert the epoch is correct
    epoch.assertEquals(currentEpoch, "The epoch must match");

    var signedData: Field[] = [];

    for (let [_, value] of Object.entries(accounts)) {

      // reconstruct the signed data
      signedData = signedData.concat(value.index.toFields()).concat(value.publicKey.toFields()).concat(value.rewards.toFields());


      // Assert the index is the same as the current index
      value.index.assertEquals(currentIndex, "The index must match");

      // calculate the rewards
      let payoutPercentage = UInt64.from(100).sub(UInt64.from(5));
      let payout = value.rewards.mul(payoutPercentage).div(100).div(1000); // Temp make this smaller as easier to pay
      payout.assertLte(value.rewards);

      // If we made it this far we can send the 
      this.send({
        to: value.publicKey,
        amount: payout
      });

      // Increment the index
      currentIndex = currentIndex.add(1);

      // Add precondition for when this can be sent on global slot number
      // There isn't a greater than so specifiy an upper bound that is 2^32 - 1 
      let minimumSlotNumber = epoch.add(1).mul(7140).add(1000);
      this.network.globalSlotSinceGenesis.assertBetween(UInt32.from(minimumSlotNumber), UInt32.from(4294967295));

    }

    signedData = signedData.concat(epoch.toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

    const validSignature = signature.verify(oraclePublicKey, signedData);

    // Check that the signature is valid if it isn't the transaction will fail
    validSignature.assertTrue();

    // Debugging control flow
    const checkBigger = Circuit.if(
      currentIndex.gte(feePayout.numDelegates),
      (() => {
        // TRUE
        return currentIndex;
      })(),
      (() => {
        // FALSE
        return feePayout.numDelegates;
      })(),
    );

    Circuit.log(checkBigger);

    // If the index is gte the number of delegates we advance the epoch
    /*
    Circuit.if(currentIndex.equals(feePayout.numDelegates),
      (() => {
        // TRUE
        this.currentIndex.set(Field(0));
        this.currentEpoch.set(epoch.add(1));
        this.send({
          to: validatorPublicKey,
          amount: feePayout.payout.mul(5).div(100).div(1000), // Temp make this smaller as easier to pay
        });
        return Field(1);
      })(),
      (() => {
        // FALSE
        return Field(0);
      })()
    );
    */
  }
}
