import {
  isReady,
  shutdown,
  PublicKey,
  Field,
  Bool,
} from 'snarkyjs';

(async function main() {

  await isReady;

  let pk = PublicKey.from({
    x: Field("13117991216867267972578094433946611068215850158296483053051446309883779846074"),
    isOdd: Bool(false),
  });

  console.log(pk.toBase58());

  await shutdown();

})();
