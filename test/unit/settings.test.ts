import { expect, it } from 'vitest';
import { validatePinterestSettings, validatePinterestGroupBudget, validatePinterestPerformanceSettings, pinterestEffectiveGroup } from '../../src/platforms/pinterest/settings';

it('rejects contradictory budgets, millisecond timestamps and inverted dates', () => {
  for (const value of [{daily_spend_cap:10,lifetime_spend_cap:20},{start_time:1700000000000},{start_time:1700000000,end_time:1600000000}]) {
    expect(() => validatePinterestSettings('campaign', value, true)).toThrow();
  }
  expect(() => validatePinterestGroupBudget({budget_in_micro_currency:10},{is_campaign_budget_optimization:true},true)).toThrow('owns this budget');
});
it('rejects incompatible Performance+ targeting without silently dropping it', () => {
  expect(() => validatePinterestPerformanceSettings('adgroup',{bid_strategy_type:'AUTOMATIC_BID',targeting_spec:{LOCATION:['US'],GENDER:['female']}},{is_performance_plus:true})).toThrow('GENDER');
  expect(() => validatePinterestPerformanceSettings('collection',{}, {is_performance_plus:true})).toThrow('does not support');
});
it('uses campaign dates only when both CBO ownership and campaign identity match', () => {
  const group={budget_type:'CBO_ADGROUP',campaign_id:'10',start_time:null};
  expect(pinterestEffectiveGroup(group,{id:'10',is_campaign_budget_optimization:true,start_time:1700000000}).start_time).toBe(1700000000);
  expect(pinterestEffectiveGroup(group,{id:'11',is_campaign_budget_optimization:true,start_time:1700000000}).start_time).toBeNull();
});
