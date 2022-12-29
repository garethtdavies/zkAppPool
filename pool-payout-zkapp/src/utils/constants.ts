export type PoolPayoutConfig = {
    oraclePrivateKey?: string,
    oraclePublicKey: string,
    validatorPublicKey: string,
    deployEpoch: number,
    deployIndex: number,
    validatorFee: number,
    rewardsArrayLength: number,
}

export const TEST_CONFIG: PoolPayoutConfig = {
    oraclePrivateKey: 'EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53',
    oraclePublicKey: 'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1',
    validatorPublicKey: 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg',
    deployEpoch: 10,
    deployIndex: 0,
    validatorFee: 5,
    rewardsArrayLength: 2
}

export const BERKELEY_CONFIG: PoolPayoutConfig = {
    oraclePublicKey: 'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1',
    validatorPublicKey: 'B62qjhiEXP45KEk8Fch4FnYJQ7UMMfiR3hq9ZeMUZ8ia3MbfEteSYDg',
    deployEpoch: 39,
    deployIndex: 0,
    validatorFee: 5,
    rewardsArrayLength: 8
}