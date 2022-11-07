// This script will read events for the zkApp publickey via the MinaExplorer GraphQL API
// npm run build && node ./build/src/output.js

import {
  isReady,
  shutdown,
  PublicKey,
  Field,
  Bool,
} from 'snarkyjs';
import { request, gql } from 'graphql-request';

// The zkApp public key is B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM so we'll just hardcode this
// We are checking that the tx didn't fail and is canonical too.
const query = gql`
query getEvents {
  zkapps(query: {zkappCommand: {accountUpdates: {body: {publicKey: "B62qmLWZfcbqrQPMky44w6K6Myj9aydbHKE5fG2N6wrXxFbkfEUWdRM"}}}, canonical: true, failureReason_exists: false, blockHeight_gte: 12969}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {
    hash
    blockHeight
    zkappCommand {
      accountUpdates {
        body {
          events
          publicKey
        }
      }
    }
  }
}
`;

(async function main() {

  await isReady;

  // Set some headers for the output
  console.log("Epoch", "ProducerKey", "DelegatingKey", "TransactionHash");

  // This returns an array that includes the zkApp hash and the stored events
  const eventData = await request('https://berkeley.graphql.minaexplorer.com', query).then((data) => {
    return data.zkapps;
  });


  for (var event of eventData) {
    let blockHeight = event.blockHeight;
    let txhash = event.hash;
    let events = event.zkappCommand.accountUpdates[0].body.events;

    // Skip if empty events
    if (events.length !== 0) {
      // We now have an array of strings storing the epoch, delegating key and producer key which we need to parse
      // [
      // '[0 38]',
      // '[1 26868873380297534395872666428719823424609886695519542262601133629691829058479 1]',
      // '[2 17516588400988562918237937706413251051507497045801139504256946332900036501674 1]'
      // ]

      // Hacky, but need to convert the data to an array
      let epoch = JSON.parse(events[0].split(/[ ,]+/).join(','));
      let producerKey = JSON.parse(events[1].split(/[ ,]+/).join(','));
      let delegatingKey = JSON.parse(events[2].split(/[ ,]+/).join(','));

      // Convert the keys
      let producerKeyDecoded = PublicKey.from({
        x: Field(BigInt(producerKey[1])),
        isOdd: Bool(Boolean(producerKey[2])),
      });

      let delegatingKeyDecoded = PublicKey.from({
        x: Field(BigInt(delegatingKey[1])),
        isOdd: Bool(Boolean(delegatingKey[2])),
      });

      // if you are in this list you are good...
      console.log(epoch[1], producerKeyDecoded.toBase58(), delegatingKeyDecoded.toBase58(), txhash);
    }
  }

  await shutdown();

})();