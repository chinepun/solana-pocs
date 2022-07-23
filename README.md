# solana-pocs
Having fun writing pocs for solana programs

#How to Test
Open one terminal and run your validator code(rm -rf test-ledger/ && clear && solana-test-validator)
Open another terminal and deploy the necessary programs and run test script(solana program deploy level/level0.so && solana program deploy target/deploy/level0exploit.so && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/level0.ts )
