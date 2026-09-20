/** Copyright 2026 getmcpads. SPDX-License-Identifier: Apache-2.0 */
type Row = Record<string, any>;

/** Cross-field rules not expressed by Pinterest's generated OpenAPI validators. */
export function validatePinterestSettings(kind: 'campaign' | 'adgroup' | 'ad', value: Row, complete = false) {
  for (const field of ['daily_spend_cap', 'lifetime_spend_cap', 'budget_in_micro_currency', 'bid_in_micro_currency']) {
    const n = value[field];
    if (n != null && (!Number.isSafeInteger(n) || n < 0)) throw new Error(`${field} must be a non-negative integer in micro currency units.`);
  }
  for (const field of ['start_time', 'end_time']) {
    const n = value[field];
    if (n != null && (!Number.isSafeInteger(n) || n <= 0 || n >= 100_000_000_000)) throw new Error(`${field} must be a Unix timestamp in seconds, not milliseconds.`);
  }
  if (value.start_time != null && value.end_time != null && value.end_time <= value.start_time) throw new Error('end_time must be after start_time.');
  if (kind === 'campaign') {
    if (value.is_performance_plus === true) {
      if (value.is_automated_campaign === true) throw new Error('Performance+ cannot be combined with is_automated_campaign.');
      if (complete && !value.start_time) throw new Error('Performance+ requires an explicit start_time.');
      if (complete && value.daily_spend_cap > 0 && value.is_flexible_daily_budgets !== true) throw new Error('Performance+ daily budgets require is_flexible_daily_budgets:true.');
    }
    if (value.daily_spend_cap > 0 && value.lifetime_spend_cap > 0) throw new Error('Choose a daily or lifetime campaign allocation, not both.');
    if (complete && value.is_campaign_budget_optimization === true && !(value.daily_spend_cap > 0 || value.lifetime_spend_cap > 0)) throw new Error('CBO requires a positive campaign budget.');
    if (value.is_campaign_budget_optimization === false && (value.daily_spend_cap > 0 || value.lifetime_spend_cap > 0)) throw new Error('Non-CBO campaigns use ad group budgets.');
  }
  if (complete && (value.lifetime_spend_cap > 0 || value.budget_type === 'LIFETIME') && !value.end_time) throw new Error('A lifetime allocation requires an explicit end_time.');
  const t = value.targeting_spec;
  if (t) {
    const hasMin = t.MINIMUM_AGE != null, hasMax = t.MAXIMUM_AGE != null;
    if (hasMin !== hasMax) throw new Error('MINIMUM_AGE and MAXIMUM_AGE must be supplied together.');
    if (t.AGE_BUCKET?.length && hasMin) throw new Error('AGE_BUCKET cannot be combined with MINIMUM_AGE/MAXIMUM_AGE.');
    if (hasMin && (!/^(1[89]|[2-5]\d|6[0-5])$/.test(t.MINIMUM_AGE) || !/^(1[89]|[2-5]\d|6[0-5]|65\+)$/.test(t.MAXIMUM_AGE) || Number(t.MINIMUM_AGE) > parseInt(t.MAXIMUM_AGE))) throw new Error('Pinterest ages must be ordered between 18 and 65 (65+ allowed only for the maximum).');
    if (t.LOCALE?.some((v: string) => !/^[a-z]{2}$/.test(v))) throw new Error('LOCALE uses two-letter language codes such as fr.');
    for (const [include, exclude] of [['AUDIENCE_INCLUDE', 'AUDIENCE_EXCLUDE'], ['LOCATION', 'LOCATION_EXCLUDE'], ['GEO', 'GEO_EXCLUDE']]) {
      if (t[include]?.some((v: string) => t[exclude]?.includes(v))) throw new Error(`The same value cannot appear in ${include} and ${exclude}.`);
    }
  }
  if (kind === 'ad' && value.carousel_destination_urls != null && (!Array.isArray(value.carousel_destination_urls) || value.carousel_destination_urls.length < 2 || value.carousel_destination_urls.length > 5)) throw new Error('Carousel destinations must contain 2 to 5 URLs in card order.');
}

export function validatePinterestGroupBudget(value: Row, parent: Row, creating: boolean) {
  if (creating) validatePinterestPerformanceSettings('adgroup', value, parent);
  if (parent.is_campaign_budget_optimization === true && (value.budget_in_micro_currency != null && value.budget_in_micro_currency > 0 || value.budget_type && value.budget_type !== 'CBO_ADGROUP')) throw new Error('Campaign Budget Optimization owns this budget. Update the campaign budget instead.');
  if (creating && parent.is_campaign_budget_optimization === false && !(value.budget_in_micro_currency > 0)) throw new Error('A non-CBO ad group requires a positive budget.');
  if (parent.is_campaign_budget_optimization === false && value.budget_type === 'CBO_ADGROUP') throw new Error('CBO_ADGROUP requires a CBO campaign.');
  if (parent.is_campaign_budget_optimization === true) for (const field of ['start_time', 'end_time']) {
    if (value[field] != null && parent[field] != null && value[field] !== parent[field]) throw new Error(`CBO campaign ${field} overrides the group schedule. Use the same dates or update the campaign.`);
  }
}

/** Validate the requested fields, never provider-populated defaults from a read. */
export function validatePinterestPerformanceSettings(kind: 'adgroup' | 'ad' | 'collection', value: Row, parent: Row, creating = true) {
  if (parent.is_performance_plus !== true) return;
  if (kind === 'collection') throw new Error('Performance+ does not support explicit image/video collection heroes. Use a manual collection campaign; do not substitute a catalog-only ad.');
  if (kind === 'adgroup') {
    if (creating) {
      for (const key of ['budget_in_micro_currency', 'bid_in_micro_currency', 'scrollup_goal_metadata', 'budget_type', 'start_time', 'end_time', 'placement_group', 'pacing_delivery_type', 'targeting_template_ids', 'auto_targeting_enabled']) {
        if (value[key] !== undefined) throw new Error(`Performance+ ad groups must omit ${key}; budget and dates belong to the campaign.`);
      }
      if (value.bid_strategy_type !== 'AUTOMATIC_BID') throw new Error('Performance+ requires AUTOMATIC_BID.');
    }
    const t = value.targeting_spec;
    if (creating && !t?.LOCATION?.length && !t?.GEO?.length) throw new Error('Performance+ requires LOCATION or GEO.');
    if (t) {
      for (const key of Object.keys(t)) if (!['LOCATION', 'GEO', 'AGE_BUCKET', 'AUDIENCE_INCLUDE', 'AUDIENCE_EXCLUDE'].includes(key)) throw new Error(`Performance+ does not support targeting_spec.${key}. Ask for an explicit targeting change instead of dropping it.`);
      const adults = ['18-24', '25-34', '35-44', '45-49', '50-54', '55-64', '65+'];
      if (t.AGE_BUCKET?.length && (t.AGE_BUCKET.length !== adults.length || adults.some(v => !t.AGE_BUCKET.includes(v)))) throw new Error('Performance+ age targeting must be omitted for all ages or include all seven adult AGE_BUCKET values.');
    }
  } else {
    if (['SHOPPING', 'QUIZ', 'SHOWCASE', 'COLLECTION', 'REGULAR_COLLECTION', 'DYNAMIC_COLLECTION'].includes(value.creative_type)) throw new Error('This creative_type is not supported by Performance+ standard ads.');
    for (const key of ['is_pin_deleted', 'lead_form_id', 'grid_click_type', 'quiz_pin_data']) if (value[key] !== undefined) throw new Error(`Performance+ ads must omit ${key}.`);
  }
}

/** CBO dates are stored on the campaign; Pinterest returns null dates on its groups. */
export function pinterestEffectiveGroup(group: Row, campaign: Row): Row {
  if (group.budget_type !== 'CBO_ADGROUP' || campaign.is_campaign_budget_optimization !== true || String(campaign.id) !== String(group.campaign_id)) return group;
  return { ...group, start_time: campaign.start_time ?? group.start_time, end_time: campaign.end_time ?? group.end_time };
}
