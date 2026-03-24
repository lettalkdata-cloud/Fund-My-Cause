#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Events, Ledger}, Address, Env, IntoVal, Val, Vec};
use crate::{CrowdfundContract, CrowdfundContractClient};

#[test]
fn test_cancel_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline = 1000;
    let goal = 10000;
    let min_contribution = 100;

    client.initialize(&creator, &token_id, &goal, &deadline, &min_contribution, &String::from_str(&env, "My Title"), &String::from_str(&env, "My Description"), &None, &None);

    // Some contributions
    let user1 = Address::generate(&env);
    token_admin_client.mint(&user1, &500);
    client.contribute(&user1, &500);

    assert_eq!(client.total_raised(), 500);

    // Cancel campaign
    client.cancel_campaign();

    // Verify event
    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "cancelled").into_val(&env);
    let _cancelled_event = events.iter().find(|e| e.1 == topics).expect("cancelled event not found");

    // Verify social_links are empty
    assert_eq!(client.social_links().len(), 0);

    // Verify withdrawing fails
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Verify contributing fails after cancel
    token_admin_client.mint(&user1, &100);
    let result = client.try_contribute(&user1, &100);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Refund should work now even before deadline
    env.ledger().set_timestamp(deadline - 10);
    client.refund_single(&user1);
    
    assert_eq!(token.balance(&user1), 500 + 100); // 500 returned + 100 new mint
    assert_eq!(client.contribution(&user1), 0);
}

#[test]
fn test_cancel_already_cancelled() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let mut links = Vec::new(&env);
    links.push_back(String::from_str(&env, "https://example.com"));
    
    client.initialize(&creator, &token_id, &1000, &1000, &10, &String::from_str(&env, "My Title"), &String::from_str(&env, "My Description"), &Some(links), &None);
    client.cancel_campaign();

    let result = client.try_cancel_campaign();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Verify social_links are populated
    let stored_links = client.social_links();
    assert_eq!(stored_links.len(), 1);
    assert_eq!(stored_links.get(0).unwrap(), String::from_str(&env, "https://example.com"));
}

#[test]
fn test_update_metadata() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&creator, &token_id, &1000, &1000, &10, &String::from_str(&env, "Old Title"), &String::from_str(&env, "Old Description"), &None, &None);

    let mut new_links = Vec::new(&env);
    new_links.push_back(String::from_str(&env, "https://new.com"));

    client.update_metadata(
        &Some(String::from_str(&env, "New Title")),
        &Some(String::from_str(&env, "New Description")),
        &Some(new_links),
    );

    // Verify event
    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "metadata_updated").into_val(&env);
    if !events.iter().any(|e| e.1 == topics) {
        panic!("metadata_updated event not found. Total events: {}", events.len());
    }

    assert_eq!(client.title(), String::from_str(&env, "New Title"));
    assert_eq!(client.description(), String::from_str(&env, "New Description"));
    
    let stored_links = client.social_links();
    assert_eq!(stored_links.len(), 1);
    assert_eq!(stored_links.get(0).unwrap(), String::from_str(&env, "https://new.com"));

    // Cancel and ensure update fails
    client.cancel_campaign();
    let result = client.try_update_metadata(&None, &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}

// ── Negative-path tests ───────────────────────────────────────────────────────

fn setup(env: &Env, deadline: u64, goal: i128, min: i128) -> (Address, Address, CrowdfundContractClient) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min,
        &String::from_str(env, "T"),
        &String::from_str(env, "D"),
        &None,
        &None,
    );
    (creator, token_id, client)
}

#[test]
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(&creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"), &None, &None);

    let result = client.try_initialize(&creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"), &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn test_contribute_after_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let (_, token_id, client) = setup(&env, deadline, 5000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_contribute(&user, &100);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignEnded)));
}

#[test]
fn test_contribute_below_minimum() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, token_id, client) = setup(&env, 9999, 5000, 100);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &50);

    let result = client.try_contribute(&user, &50);
    assert_eq!(result.err(), Some(Ok(ContractError::BelowMinimum)));
}

#[test]
fn test_withdraw_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 9999u64;
    let (_, token_id, client) = setup(&env, deadline, 100, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &200);
    client.contribute(&user, &200);

    env.ledger().set_timestamp(deadline - 1);
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn test_withdraw_goal_not_met() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let (_, token_id, client) = setup(&env, deadline, 10_000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    client.contribute(&user, &100);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::GoalNotReached)));
}

#[test]
fn test_refund_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 9999u64;
    let (_, token_id, client) = setup(&env, deadline, 10_000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    client.contribute(&user, &100);

    env.ledger().set_timestamp(deadline - 1);
    let result = client.try_refund_single(&user);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn test_refund_when_goal_met() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let goal = 500i128;
    let (_, token_id, client) = setup(&env, deadline, goal, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &goal);
    client.contribute(&user, &goal);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_refund_single(&user);
    assert_eq!(result.err(), Some(Ok(ContractError::GoalReached)));
}

#[test]
fn test_overflow_on_total_raised() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 9999u64;
    let (_, token_id, client) = setup(&env, deadline, i128::MAX, 1);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // First contribution fills total_raised to i128::MAX - 1
    let user1 = Address::generate(&env);
    token_admin_client.mint(&user1, &(i128::MAX - 1));
    client.contribute(&user1, &(i128::MAX - 1));

    // Second contribution of 2 would overflow
    let user2 = Address::generate(&env);
    token_admin_client.mint(&user2, &2);
    let result = client.try_contribute(&user2, &2);
    assert_eq!(result.err(), Some(Ok(ContractError::Overflow)));
}

#[test]
fn test_invalid_platform_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let bad_config = PlatformConfig {
        address: Address::generate(&env),
        fee_bps: 10_001,
    };
    let result = client.try_initialize(
        &creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &Some(bad_config),
    );
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidFee)));
}

#[test]
fn test_cancel_already_cancelled_negative() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, _, client) = setup(&env, 9999, 1000, 10);

    client.cancel_campaign();
    let result = client.try_cancel_campaign();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}
