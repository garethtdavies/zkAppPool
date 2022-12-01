// npm run build && node build/src/local.js

import {
  SmartContract,
  Mina,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  UInt64,
  UInt32,
  Struct,
  isReady,
  shutdown,
  state,
  State,
  PrivateKey,
  Circuit,
  Field,
  Bool,
  fetchAccount
} from 'snarkyjs';

const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

const VALIDATOR_PUBLIC_KEY = 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg';

export class Reward extends Struct({
  index: Field,
  publicKey: PublicKey,
  rewards: UInt64,
  epoch: Field,
  //signature: Signature, // Causes a stack overflow, may need to batch this at oracle
  confirmed: Bool
}) { // Have the data concatenated here?
}

export class Rewards2 extends Struct(
  [Reward, Reward, Reward, Reward, Reward]) { }

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

  @method sendReward(accounts: Rewards2) {

    // This method loops through 9 payouts and sends tham.
    // It needs to validate the index, the epoch and the signature

    // get the current epoch
    let currentEpoch = this.currentEpoch.get();
    this.currentEpoch.assertEquals(currentEpoch);

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

    for (let [_, value] of Object.entries(accounts)) {

      Circuit.log(currentIndex);

      // First thing we do is validate the signature.
      // This ensures that the data came from the oracle
      // TODO validate signature

      //const validSignature = signature.verify(oraclePublicKey, signedData);

      // Check that the signature is valid
      //validSignature.assertTrue();

      // Assert the index is the same as the current index
      value.index.assertEquals(currentIndex, "The index must match");

      // Assert the epoch is correct
      value.epoch.assertEquals(currentEpoch, "The epoch must match");

      // calculate the rewards
      let payout = value.rewards.mul(95).div(100).div(1000); // Temp make this smaller as easier to pay
      payout.assertLte(value.rewards);

      // If we made it this far we can send the 
      this.send({
        to: value.publicKey,
        amount: payout
      });

      // Increment the index
      currentIndex = currentIndex.add(1);
      Circuit.log(currentIndex);

    }

    this.currentIndex.set(currentIndex);
  }
}

(async function main() {

  await isReady;

  console.log('SnarkyJS loaded');

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const deployerAccount = Local.testAccounts[8].privateKey;

  // Use a prefunded account as we will send rewards from here
  const zkAppPrivateKey = Local.testAccounts[9].privateKey;
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  let { verificationKey } = await PoolPayout.compile();

  // Prime the cache as otherwise this falls over
  //await fetchAccount({publicKey: zkAppAddress});

  console.log("Deploying");
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey, verificationKey: verificationKey });
    zkAppInstance.requireSignature();
  });
  deploy_txn.sign([zkAppPrivateKey]);
  await deploy_txn.send();

  console.log("Deployed");

  // Add some test payouts
  let rewardFields: Rewards2 = [];
  for (let i = 0; i < 5; i++) {
    rewardFields.push({
      index: Field(i),
      publicKey: Local.testAccounts[i].privateKey.toPublicKey(),
      rewards: UInt64.from(1_000_000),
      epoch: Field(39),
      //signature: Signature.fromJSON(element.signature),
      confirmed: Bool(true),
    });
  }

  console.log(rewardFields);

  try {
    let transaction = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: 100_000_000 },
      () => {
        zkAppInstance.sendReward(rewardFields);
      }
    );

    console.log("Proving transaction");
    transaction.prove();

    console.log("Sending transaction");
    console.log(transaction.toPretty());

    await transaction.send();

  } catch (error: any) {
    console.log("There was an issue");
    console.log(error.message);
  }

  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();
