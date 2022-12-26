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
  PrivateKey,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY = 'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

// Using this value as a test as a nice number of delegates
const VALIDATOR_PUBLIC_KEY = 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg';

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
  rewards: Circuit.array(Reward, 8),
}) { }

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

    this.currentEpoch.set(Field(39));
    this.currentIndex.set(Field(0));
    this.feePercentage.set(UInt32.from(5));
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
    this.validatorPublicKey.set(PublicKey.fromBase58(VALIDATOR_PUBLIC_KEY));
  }

  @method
  updateEpoch(n: Field) {
    this.currentEpoch.set(n);
  }

  @method
  updateIndex(i: Field) {
    this.currentIndex.set(i);
  }

  @method
  updateOracle(publicKey: PublicKey) {
    this.oraclePublicKey.set(publicKey);
  }

  @method
  updateValidator(publicKey: PublicKey) {
    this.validatorPublicKey.set(publicKey);
  }

  // This method sends the rewards to the validator
  // It verifies the index and epoch from the oracle
  @method sendReward(accounts: Rewards2, feePayout: FeePayout, epoch: Field, signature: Signature) {

    // get the current epoch
    let currentEpoch = this.currentEpoch.get();
    this.currentEpoch.assertEquals(currentEpoch);
    epoch.assertEquals(currentEpoch, "The epoch must match");

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

    let signedData: Field[] = [];

    // starting with the index on state, we can increment this variable during this transaction
    let transactionIndex = currentIndex;

    for (let i = 0; i < accounts.rewards.length; i++) {
      const reward = accounts.rewards[i];
      const accountIsNotEmpty = Bool.not(reward.publicKey.isEmpty());

      // Assert the index is the same as the current index
      const indexCheck = Bool.or(Bool.not(accountIsNotEmpty), reward.index.equals(transactionIndex));
      indexCheck.assertEquals(Bool(true), "The index must match");

      // reconstruct the signed data
      signedData = signedData.concat(reward.index.toFields()).concat(reward.publicKey.toFields()).concat(reward.rewards.toFields());

      // calculate the rewards
      let payoutPercentage = UInt64.from(100).sub(UInt64.from(5)); //TODO use on-chain variable here
      let payout = Circuit.if(
        accountIsNotEmpty,
        (() => reward.rewards.mul(payoutPercentage).div(100).div(1000))(), // TODO Temp make this smaller as easier to pay
        (() => UInt64.zero)()
      )
      payout.assertLte(reward.rewards);

      Circuit.asProver(() => {
        Circuit.log(
          "Payout: ", reward.publicKey, payout.toString()
        )
        Circuit.log(
          "Percent: ", payoutPercentage.toString()
        )
      })

      // If we made it this far we can send the 
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

    signedData = signedData.concat(epoch.toFields()).concat(feePayout.numDelegates.toFields()).concat(feePayout.payout.toFields());

    const validSignature = signature.verify(oraclePublicKey, signedData);

    // Check that the signature is valid if it isn't the transaction will fail
    validSignature.assertTrue();

    // Debugging control flow
    // If we are at the number of delegators we can send the fees to the onchain validated public key
    const [validatorCut, i, e] = Circuit.if(
      transactionIndex.gte(feePayout.numDelegates),
      (() => [feePayout.payout.mul(5).div(100).div(1000), Field(0), epoch.add(1)])(), //TODO temp make this much smaller for managable payouts
      (() => [UInt64.from(0), transactionIndex, epoch])()
    )

    Circuit.asProver(() => {
      Circuit.log(
        "Validator Cut: ", validatorCut.toString()
      )
    })

    this.currentEpoch.set(e);
    this.currentIndex.set(i);
    this.send({
      to: validatorPublicKey,
      amount: validatorCut
    });
  }
}