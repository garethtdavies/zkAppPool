import { isReady, PrivateKey, Field, Signature } from "snarkyjs";
export const handler = async (event) => {
    // We need to wait for SnarkyJS to finish loading before we can do anything
    await isReady;
    // This is the key we use to sign our data
    const privateKey = PrivateKey.fromBase58("EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53");
    // We compute the public key associated with our private key
    const publicKey = privateKey.toPublicKey();
    // Mock some fields
    const height = Field(155);
    const blockHash = Field(555);
    const creator = Field(5656);
    const signature = Signature.create(privateKey, [height, blockHash, creator]);
    const data = {
        // Return the Data type that we created earlier
        data: { height, blockHash, creator },
        signature: signature,
        publicKey: publicKey,
    };
    const response = {
        statusCode: 200,
        body: JSON.stringify(data),
    };
    return response;
};
