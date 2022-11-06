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
    x: Field("17516588400988562918237937706413251051507497045801139504256946332900036501674"),
    isOdd: Bool(true),
  });

  console.log(pk.toBase58());

  await shutdown();

})();