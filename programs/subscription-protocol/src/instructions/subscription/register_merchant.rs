use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::{MerchantPlan, MerchantPlanRegistered, ErrorCode};

#[derive(Accounts)]
#[instruction(plan_id: String)]
pub struct RegisterMerchant<'info> {
    #[account(
        init,
        payer = merchant,
        space = 8 + MerchantPlan::INIT_SPACE,
        seeds = [
            b"merchant_plan",
            merchant.key().as_ref(),
            mint.key().as_ref(),
            plan_id.as_bytes()
        ],
        bump
    )]
    pub merchant_plan: Account<'info, MerchantPlan>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterMerchant>,
    plan_id: String,
    plan_name: String,
    fee_amount: u64,
    payment_interval_seconds: i64,
) -> Result<()> {
    require!(plan_id.len() <= 32, ErrorCode::PlanIdTooLong);
    require!(plan_name.len() <= 64, ErrorCode::PlanNameTooLong);
    require!(fee_amount > 0, ErrorCode::InvalidFeeAmount);
    require!(payment_interval_seconds > 0, ErrorCode::InvalidInterval);

    let merchant_plan = &mut ctx.accounts.merchant_plan;
    
    merchant_plan.merchant = ctx.accounts.merchant.key();
    merchant_plan.mint = ctx.accounts.mint.key();
    merchant_plan.plan_id = plan_id;
    merchant_plan.plan_name = plan_name;
    merchant_plan.fee_amount = fee_amount;
    merchant_plan.payment_interval = payment_interval_seconds;
    merchant_plan.is_active = true;
    merchant_plan.total_subscribers = 0;
    merchant_plan.bump = ctx.bumps.merchant_plan;

    emit!(MerchantPlanRegistered {
        plan_pda: merchant_plan.key()
    });

    Ok(())
}