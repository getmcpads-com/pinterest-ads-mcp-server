/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
// ============================================
// PINTEREST ADS METRIC CATALOG
// Complete catalog of 90+ Pinterest Ads metrics
// Based on Pinterest API v5 ReportingColumnAsync enum
// ============================================

import { PinterestMetricDefinition, MetricCategory } from "./types.js";
import {
  PINTEREST_REPORTING_COLUMN_SET,
  PINTEREST_SYNC_REPORTING_COLUMN_SET,
} from "./api-v5.generated.js";

// ============================================
// CORE PERFORMANCE METRICS
// ============================================

const CORE_METRICS: PinterestMetricDefinition[] = [
  // Spend Metrics
  {
    key: "spend",
    name: "Spend",
    description: "Total amount spent on ads in dollars",
    category: "core",
    format: "currency",
    apiField: "SPEND_IN_DOLLAR",
    type: "api",
  },
  {
    key: "spendMicro",
    name: "Spend (Micro)",
    description: "Total amount spent in micro-currency (1/1,000,000 of currency unit)",
    category: "core",
    format: "number",
    apiField: "SPEND_IN_MICRO_DOLLAR",
    type: "api",
  },

  // Impression Metrics
  {
    key: "impressions",
    name: "Impressions",
    description: "Total number of times ads were shown (paid + earned)",
    category: "core",
    format: "number",
    apiField: "IMPRESSION_1",
    type: "api",
  },
  {
    key: "paidImpressions",
    name: "Paid Impressions",
    description: "Number of paid impressions",
    category: "core",
    format: "number",
    apiField: "PAID_IMPRESSION",
    type: "api",
  },
  {
    key: "earnedImpressions",
    name: "Earned Impressions",
    description: "Number of earned (organic) impressions from promoted content",
    category: "core",
    format: "number",
    apiField: "IMPRESSION_2",
    type: "api",
  },
  {
    key: "totalImpressions",
    name: "Total Impressions",
    description: "Total impressions including paid and earned",
    category: "core",
    format: "number",
    apiField: "TOTAL_IMPRESSION",
    type: "api",
  },

  // Click Metrics
  {
    key: "clicks",
    name: "Clicks",
    description: "Number of clicks on ads (paid)",
    category: "core",
    format: "number",
    apiField: "CLICKTHROUGH_1",
    type: "api",
  },
  {
    key: "earnedClicks",
    name: "Earned Clicks",
    description: "Number of earned clicks from promoted content",
    category: "core",
    format: "number",
    apiField: "CLICKTHROUGH_2",
    type: "api",
  },
  {
    key: "totalClicks",
    name: "Total Clicks",
    description: "Total clicks including paid and earned",
    category: "core",
    format: "number",
    apiField: "TOTAL_CLICKTHROUGH",
    type: "api",
  },

  // Rate Metrics
  {
    key: "ctr",
    name: "CTR",
    description: "Click-through rate (clicks / impressions)",
    category: "core",
    format: "percentage",
    apiField: "CTR",
    type: "api",
  },
  {
    key: "ectr",
    name: "Effective CTR",
    description: "Effective click-through rate",
    category: "core",
    format: "percentage",
    apiField: "ECTR",
    type: "api",
  },

  // Cost Metrics
  {
    key: "cpm",
    name: "CPM",
    description: "Cost per 1,000 impressions",
    category: "core",
    format: "currency",
    apiField: "CPM_IN_DOLLAR",
    type: "api",
  },
  {
    key: "cpmMicro",
    name: "CPM (Micro)",
    description: "Cost per 1,000 impressions in micro-currency",
    category: "core",
    format: "number",
    apiField: "CPM_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "ecpm",
    name: "Effective CPM",
    description: "Effective cost per 1,000 impressions",
    category: "core",
    format: "currency",
    apiField: "ECPM_IN_DOLLAR",
    type: "api",
  },
  {
    key: "ecpmMicro",
    name: "Effective CPM (Micro)",
    description: "Effective cost per 1,000 impressions in micro-currency",
    category: "core",
    format: "number",
    apiField: "ECPM_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "cpc",
    name: "CPC",
    description: "Cost per click",
    category: "core",
    format: "currency",
    apiField: "CPC_IN_DOLLAR",
    type: "api",
  },
  {
    key: "cpcMicro",
    name: "CPC (Micro)",
    description: "Cost per click in micro-currency",
    category: "core",
    format: "number",
    apiField: "CPC_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "ecpc",
    name: "Effective CPC",
    description: "Effective cost per click",
    category: "core",
    format: "currency",
    apiField: "ECPC_IN_DOLLAR",
    type: "api",
  },
  {
    key: "ecpcMicro",
    name: "Effective CPC (Micro)",
    description: "Effective cost per click in micro-currency",
    category: "core",
    format: "number",
    apiField: "ECPC_IN_MICRO_DOLLAR",
    type: "api",
  },

  // Reach & Frequency
  {
    key: "reach",
    name: "Reach",
    description: "Number of unique users who saw your ad",
    category: "core",
    format: "number",
    // v5.23 names this column TOTAL_IMPRESSION_USER. "TOTAL_REACH" does not
    // exist in PINTEREST_REPORTING_COLUMNS, so the metric was being filtered
    // out of PINTEREST_METRIC_CATALOG by isPinterestMetricSupported and any
    // query using it failed with "Unknown metric: reach".
    // See lib/pinterest/pinterestApiV523.generated.ts:86 and :743 (sync set).
    apiField: "TOTAL_IMPRESSION_USER",
    type: "api",
  },
  {
    key: "frequency",
    name: "Frequency",
    description: "Average number of times each user saw your ad",
    category: "core",
    format: "ratio",
    // Same fix as `reach`: v5.23 exposes TOTAL_IMPRESSION_FREQUENCY, not
    // "FREQUENCY" (pinterestApiV523.generated.ts:87 and :742).
    apiField: "TOTAL_IMPRESSION_FREQUENCY",
    type: "api",
  },
];

// ============================================
// ENGAGEMENT METRICS
// ============================================

const ENGAGEMENT_METRICS: PinterestMetricDefinition[] = [
  // Total Engagement
  {
    key: "engagement",
    name: "Engagements",
    description: "Total engagements (saves + pin clicks + outbound clicks)",
    category: "engagement",
    format: "number",
    apiField: "ENGAGEMENT_1",
    type: "api",
  },
  {
    key: "earnedEngagement",
    name: "Earned Engagements",
    description: "Earned engagements from promoted content",
    category: "engagement",
    format: "number",
    apiField: "ENGAGEMENT_2",
    type: "api",
  },
  {
    key: "totalEngagement",
    name: "Total Engagements",
    description: "Total engagements including paid and earned",
    category: "engagement",
    format: "number",
    apiField: "TOTAL_ENGAGEMENT",
    type: "api",
  },
  {
    key: "engagementRate",
    name: "Engagement Rate",
    description: "Engagement rate (engagements / impressions)",
    category: "engagement",
    format: "percentage",
    apiField: "ENGAGEMENT_RATE",
    type: "api",
  },
  {
    key: "eEngagementRate",
    name: "Effective Engagement Rate",
    description: "Effective engagement rate",
    category: "engagement",
    format: "percentage",
    apiField: "EENGAGEMENT_RATE",
    type: "api",
  },

  // Pin Clicks
  {
    key: "pinClick",
    name: "Pin Clicks",
    description: "Number of clicks on pins (paid)",
    category: "engagement",
    format: "number",
    apiField: "PIN_CLICK_1",
    type: "api",
  },
  {
    key: "earnedPinClick",
    name: "Earned Pin Clicks",
    description: "Earned pin clicks from promoted content",
    category: "engagement",
    format: "number",
    apiField: "PIN_CLICK_2",
    type: "api",
  },
  {
    key: "totalPinClick",
    name: "Total Pin Clicks",
    description: "Total pin clicks including paid and earned",
    category: "engagement",
    format: "number",
    apiField: "TOTAL_PIN_CLICK",
    type: "api",
  },
  {
    key: "pinClickRate",
    name: "Pin Click Rate",
    description: "Pin clicks divided by impressions",
    category: "engagement",
    format: "percentage",
    apiField: "PIN_CLICK_RATE",
    type: "api",
  },

  // Outbound Clicks
  {
    key: "outboundClick",
    name: "Outbound Clicks",
    description: "Clicks that lead to destinations off Pinterest (paid)",
    category: "engagement",
    format: "number",
    apiField: "OUTBOUND_CLICK_1",
    type: "api",
  },
  {
    key: "earnedOutboundClick",
    name: "Earned Outbound Clicks",
    description: "Earned outbound clicks from promoted content",
    category: "engagement",
    format: "number",
    apiField: "OUTBOUND_CLICK_2",
    type: "api",
  },
  {
    key: "totalOutboundClick",
    name: "Total Outbound Clicks",
    description: "Total outbound clicks including paid and earned",
    category: "engagement",
    format: "number",
    apiField: "TOTAL_OUTBOUND_CLICK",
    type: "api",
  },
  {
    key: "outboundClickRate",
    name: "Outbound Click Rate",
    description: "Outbound clicks divided by impressions",
    category: "engagement",
    format: "percentage",
    apiField: "OUTBOUND_CLICK_RATE",
    type: "api",
  },
  {
    key: "outboundCtr",
    name: "Outbound CTR",
    description: "Outbound click-through rate",
    category: "engagement",
    format: "percentage",
    apiField: "OUTBOUND_CTR",
    type: "api",
  },
  {
    key: "costPerOutboundClick",
    name: "Cost per Outbound Click",
    description: "Average cost per outbound click",
    category: "engagement",
    format: "currency",
    apiField: "COST_PER_OUTBOUND_CLICK_IN_DOLLAR",
    type: "api",
  },

  // Saves (Repins)
  {
    key: "save",
    name: "Saves",
    description: "Number of times pins were saved (paid)",
    category: "engagement",
    format: "number",
    apiField: "REPIN_1",
    type: "api",
  },
  {
    key: "earnedSave",
    name: "Earned Saves",
    description: "Earned saves from promoted content",
    category: "engagement",
    format: "number",
    apiField: "REPIN_2",
    type: "api",
  },
  {
    key: "totalSave",
    name: "Total Saves",
    description: "Total saves including paid and earned",
    category: "engagement",
    format: "number",
    apiField: "TOTAL_SAVE",
    type: "api",
  },
  {
    key: "saveRate",
    name: "Save Rate",
    description: "Saves divided by impressions",
    category: "engagement",
    format: "percentage",
    apiField: "REPIN_RATE",
    type: "api",
  },
  {
    key: "repinRate",
    name: "Repin Rate",
    description: "Repin rate (legacy term for save rate)",
    category: "engagement",
    format: "percentage",
    apiField: "REPIN_RATE",
    type: "api",
  },
  {
    key: "totalRepinRate",
    name: "Total Repin Rate",
    description: "Total repin rate including earned",
    category: "engagement",
    format: "percentage",
    apiField: "TOTAL_REPIN_RATE",
    type: "api",
  },

  // Closeup Views
  {
    key: "closeup",
    name: "Closeups",
    description: "Number of close-up views on pins (paid)",
    category: "engagement",
    format: "number",
    apiField: "CLOSEUP_1",
    type: "api",
  },
  {
    key: "earnedCloseup",
    name: "Earned Closeups",
    description: "Earned closeup views from promoted content",
    category: "engagement",
    format: "number",
    apiField: "CLOSEUP_2",
    type: "api",
  },
  {
    key: "totalCloseup",
    name: "Total Closeups",
    description: "Total closeup views including paid and earned",
    category: "engagement",
    format: "number",
    apiField: "TOTAL_CLOSEUP",
    type: "api",
  },
  {
    key: "closeupRate",
    name: "Closeup Rate",
    description: "Closeup views divided by impressions",
    category: "engagement",
    format: "percentage",
    apiField: "CLOSEUP_RATE",
    type: "api",
  },

  // Carousel Metrics
  {
    key: "carouselTapForward",
    name: "Carousel Tap Forward",
    description: "Number of taps to go forward in carousel",
    category: "engagement",
    format: "number",
    apiField: "CAROUSEL_TAP_FORWARD",
    type: "api",
  },
  {
    key: "carouselTapBackward",
    name: "Carousel Tap Backward",
    description: "Number of taps to go backward in carousel",
    category: "engagement",
    format: "number",
    apiField: "CAROUSEL_TAP_BACKWARD",
    type: "api",
  },
];

// ============================================
// VIDEO METRICS
// ============================================

const VIDEO_METRICS: PinterestMetricDefinition[] = [
  // Video Views
  {
    key: "videoStart",
    name: "Video Starts",
    description: "Number of times video started playing",
    category: "video",
    format: "number",
    apiField: "VIDEO_START",
    type: "api",
  },
  {
    key: "videoMrcView",
    name: "Video MRC Views",
    description: "MRC standard video views (50% in view for 2+ seconds)",
    category: "video",
    format: "number",
    apiField: "VIDEO_MRC_VIEW",
    type: "api",
  },
  {
    key: "video3secViews",
    name: "3-Second Video Views",
    description: "Number of video views for 3+ seconds",
    category: "video",
    format: "number",
    apiField: "VIDEO_3SEC_VIEWS",
    type: "api",
  },
  {
    key: "videoV50WatchTime",
    name: "Video V50 Watch Time",
    description: "Total watch time at 50% viewability",
    category: "video",
    format: "duration",
    apiField: "VIDEO_V50_WATCH_TIME",
    type: "api",
  },

  // Video Completion Quartiles
  {
    key: "videoP25",
    name: "Video 25% Watched",
    description: "Number of times video was watched to 25%",
    category: "video",
    format: "number",
    apiField: "VIDEO_P25_WATCHED_OPERATIONS",
    type: "api",
  },
  {
    key: "videoP50",
    name: "Video 50% Watched",
    description: "Number of times video was watched to 50%",
    category: "video",
    format: "number",
    apiField: "VIDEO_P50_WATCHED_OPERATIONS",
    type: "api",
  },
  {
    key: "videoP75",
    name: "Video 75% Watched",
    description: "Number of times video was watched to 75%",
    category: "video",
    format: "number",
    apiField: "VIDEO_P75_WATCHED_OPERATIONS",
    type: "api",
  },
  {
    key: "videoP95",
    name: "Video 95% Watched",
    description: "Number of times video was watched to 95%",
    category: "video",
    format: "number",
    apiField: "VIDEO_P95_WATCHED_OPERATIONS",
    type: "api",
  },
  {
    key: "videoP100",
    name: "Video 100% Watched",
    description: "Number of times video was watched to completion",
    category: "video",
    format: "number",
    apiField: "VIDEO_P100_WATCHED_OPERATIONS",
    type: "api",
  },
  {
    key: "videoP100Complete",
    name: "Video Completions",
    description: "Number of video completions",
    category: "video",
    format: "number",
    apiField: "VIDEO_P100_COMPLETE",
    type: "api",
  },

  // Combined Video Quartiles (paid + earned)
  {
    key: "videoP25Combined",
    name: "Video 25% (Combined)",
    description: "Combined paid + earned 25% video views",
    category: "video",
    format: "number",
    apiField: "VIDEO_P25_COMBINED",
    type: "api",
  },
  {
    key: "videoP50Combined",
    name: "Video 50% (Combined)",
    description: "Combined paid + earned 50% video views",
    category: "video",
    format: "number",
    apiField: "VIDEO_P50_COMBINED",
    type: "api",
  },
  {
    key: "videoP75Combined",
    name: "Video 75% (Combined)",
    description: "Combined paid + earned 75% video views",
    category: "video",
    format: "number",
    apiField: "VIDEO_P75_COMBINED",
    type: "api",
  },
  {
    key: "videoP95Combined",
    name: "Video 95% (Combined)",
    description: "Combined paid + earned 95% video views",
    category: "video",
    format: "number",
    apiField: "VIDEO_P95_COMBINED",
    type: "api",
  },
  {
    key: "videoP100Combined",
    name: "Video 100% (Combined)",
    description: "Combined paid + earned video completions",
    category: "video",
    format: "number",
    apiField: "VIDEO_P100_COMBINED",
    type: "api",
  },

  // Watch Time Metrics
  {
    key: "videoAvgWatchTime",
    name: "Average Video Watch Time",
    description: "Average time spent watching video in seconds",
    category: "video",
    format: "duration",
    apiField: "VIDEO_AVG_WATCH_TIME_IN_SECOND",
    type: "api",
  },
  {
    key: "totalVideoAvgWatchTime",
    name: "Total Avg Video Watch Time",
    description: "Total average video watch time including earned",
    category: "video",
    format: "duration",
    apiField: "TOTAL_VIDEO_AVG_WATCHTIME_IN_SECOND",
    type: "api",
  },
  {
    key: "videoTotalWatchTime",
    name: "Total Video Watch Time",
    description: "Total time spent watching videos in seconds",
    category: "video",
    format: "duration",
    apiField: "VIDEO_TOTAL_WATCH_TIME",
    type: "api",
  },

  // Video Cost Metrics
  {
    key: "cpv",
    name: "CPV",
    description: "Cost per video view",
    category: "video",
    format: "currency",
    apiField: "CPV_IN_DOLLAR",
    type: "api",
  },
  {
    key: "cpvMicro",
    name: "CPV (Micro)",
    description: "Cost per video view in micro-currency",
    category: "video",
    format: "number",
    apiField: "CPV_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "ecpv",
    name: "Effective CPV",
    description: "Effective cost per video view",
    category: "video",
    format: "currency",
    apiField: "ECPV_IN_DOLLAR",
    type: "api",
  },
  {
    key: "ecpvMicro",
    name: "Effective CPV (Micro)",
    description: "Effective cost per video view in micro-currency",
    category: "video",
    format: "number",
    apiField: "ECPV_IN_MICRO_DOLLAR",
    type: "api",
  },

  // Earned Video Metrics
  {
    key: "earnedVideoStart",
    name: "Earned Video Starts",
    description: "Earned video starts from promoted content",
    category: "video",
    format: "number",
    apiField: "VIDEO_START_2",
    type: "api",
  },
  {
    key: "earnedVideoMrcView",
    name: "Earned Video MRC Views",
    description: "Earned MRC video views from promoted content",
    category: "video",
    format: "number",
    apiField: "VIDEO_MRC_VIEW_2",
    type: "api",
  },
];

// ============================================
// CONVERSION METRICS
// ============================================

const CONVERSION_METRICS: PinterestMetricDefinition[] = [
  // Total Conversions
  {
    key: "totalConversions",
    name: "Total Conversions",
    description: "Total number of all conversion events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_CONVERSIONS",
    type: "api",
  },
  {
    key: "totalConversionsQuantity",
    name: "Total Conversions Quantity",
    description: "Total quantity of conversion events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_CONVERSIONS_QUANTITY",
    type: "api",
  },
  {
    key: "totalConversionsValue",
    name: "Total Conversions Value",
    description: "Total value of all conversions",
    category: "conversion",
    format: "currency",
    apiField: "TOTAL_CONVERSIONS_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },

  // CPA & ROAS
  {
    key: "cpa",
    name: "Cost per Action",
    description: "Average cost per conversion",
    category: "conversion",
    format: "currency",
    apiField: "CPA_IN_DOLLAR",
    type: "api",
  },
  {
    key: "cpaMicro",
    name: "CPA (Micro)",
    description: "Average cost per conversion in micro-currency",
    category: "conversion",
    format: "number",
    apiField: "CPA_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "roas",
    name: "ROAS",
    description: "Return on ad spend for all conversions",
    category: "conversion",
    format: "ratio",
    apiField: "ROAS",
    type: "api",
  },
  {
    key: "totalRoas",
    name: "Total ROAS",
    description: "Total return on ad spend",
    category: "conversion",
    format: "ratio",
    apiField: "TOTAL_ROAS",
    type: "api",
  },

  // Offline Conversions
  {
    key: "offlineConversions",
    name: "Offline Conversions",
    description: "Number of offline conversion events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_OFFLINE_CONVERSIONS",
    type: "api",
  },
];

// ============================================
// CHECKOUT METRICS
// ============================================

const CHECKOUT_METRICS: PinterestMetricDefinition[] = [
  {
    key: "checkout",
    name: "Checkouts",
    description: "Total number of checkout events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_CHECKOUT",
    type: "api",
  },
  {
    key: "checkoutQuantity",
    name: "Checkout Quantity",
    description: "Total quantity of items in checkouts",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_CHECKOUT_QUANTITY",
    type: "api",
  },
  {
    key: "checkoutValue",
    name: "Checkout Value",
    description: "Total value of checkout events",
    category: "conversion",
    format: "currency",
    apiField: "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "checkoutRoas",
    name: "Checkout ROAS",
    description: "Return on ad spend for checkout events",
    category: "conversion",
    format: "ratio",
    apiField: "CHECKOUT_ROAS",
    type: "api",
  },
  {
    key: "costPerCheckout",
    name: "Cost per Checkout",
    description: "Average cost per checkout",
    category: "conversion",
    format: "currency",
    apiField: "COST_PER_CHECKOUT",
    type: "api",
  },

  // Web Checkout
  {
    key: "webCheckout",
    name: "Web Checkouts",
    description: "Number of web checkout events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_WEB_CHECKOUT",
    type: "api",
  },
  {
    key: "webCheckoutValue",
    name: "Web Checkout Value",
    description: "Total value of web checkout events",
    category: "conversion",
    format: "currency",
    apiField: "TOTAL_WEB_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "webCheckoutRoas",
    name: "Web Checkout ROAS",
    description: "ROAS for web checkout events",
    category: "conversion",
    format: "ratio",
    apiField: "WEB_CHECKOUT_ROAS",
    type: "api",
  },

  // In-App Checkout
  {
    key: "inAppCheckout",
    name: "In-App Checkouts",
    description: "Number of in-app checkout events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_INAPP_CHECKOUT",
    type: "api",
  },
  {
    key: "inAppCheckoutValue",
    name: "In-App Checkout Value",
    description: "Total value of in-app checkout events",
    category: "conversion",
    format: "currency",
    apiField: "TOTAL_INAPP_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },

  // Offline Checkout
  {
    key: "offlineCheckout",
    name: "Offline Checkouts",
    description: "Number of offline checkout events",
    category: "conversion",
    format: "number",
    apiField: "TOTAL_OFFLINE_CHECKOUT",
    type: "api",
  },
  {
    key: "offlineCheckoutValue",
    name: "Offline Checkout Value",
    description: "Total value of offline checkout events",
    category: "conversion",
    format: "currency",
    apiField: "TOTAL_OFFLINE_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
];

// ============================================
// WEB EVENT METRICS
// ============================================

const WEB_METRICS: PinterestMetricDefinition[] = [
  // Page Visits
  {
    key: "pageVisit",
    name: "Page Visits",
    description: "Total number of page visit events",
    category: "web",
    format: "number",
    apiField: "TOTAL_PAGE_VISIT",
    type: "api",
  },
  {
    key: "webPageVisit",
    name: "Web Page Visits",
    description: "Number of web page visit events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_PAGE_VISIT",
    type: "api",
  },
  {
    key: "webSessions",
    name: "Web Sessions",
    description: "Number of web sessions",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_SESSIONS",
    type: "api",
  },

  // Signups
  {
    key: "signup",
    name: "Sign Ups",
    description: "Total number of sign up events",
    category: "web",
    format: "number",
    apiField: "TOTAL_SIGNUP",
    type: "api",
  },
  {
    key: "signupValue",
    name: "Sign Up Value",
    description: "Total value of sign up events",
    category: "web",
    format: "currency",
    apiField: "TOTAL_SIGNUP_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "webSignup",
    name: "Web Sign Ups",
    description: "Number of web sign up events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_SIGNUP",
    type: "api",
  },

  // Leads
  {
    key: "lead",
    name: "Leads",
    description: "Total number of lead events",
    category: "web",
    format: "number",
    apiField: "TOTAL_LEAD",
    type: "api",
  },
  {
    key: "leadValue",
    name: "Lead Value",
    description: "Total value of lead events",
    category: "web",
    format: "currency",
    apiField: "TOTAL_LEAD_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "webLead",
    name: "Web Leads",
    description: "Number of web lead events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_LEAD",
    type: "api",
  },

  // Add to Cart
  {
    key: "addToCart",
    name: "Add to Cart",
    description: "Total number of add to cart events",
    category: "web",
    format: "number",
    apiField: "TOTAL_ADD_TO_CART",
    type: "api",
  },
  {
    key: "addToCartValue",
    name: "Add to Cart Value",
    description: "Total value of add to cart events",
    category: "web",
    format: "currency",
    apiField: "TOTAL_ADD_TO_CART_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },
  {
    key: "webAddToCart",
    name: "Web Add to Cart",
    description: "Number of web add to cart events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_ADD_TO_CART",
    type: "api",
  },
  {
    key: "webAddToCartValue",
    name: "Web Add to Cart Value",
    description: "Value of web add to cart events",
    category: "web",
    format: "currency",
    apiField: "TOTAL_WEB_ADD_TO_CART_VALUE_IN_MICRO_DOLLAR",
    type: "api",
  },

  // Search
  {
    key: "search",
    name: "Searches",
    description: "Total number of search events",
    category: "web",
    format: "number",
    apiField: "TOTAL_SEARCH",
    type: "api",
  },
  {
    key: "webSearch",
    name: "Web Searches",
    description: "Number of web search events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_SEARCH",
    type: "api",
  },

  // View Category
  {
    key: "viewCategory",
    name: "View Category",
    description: "Total number of view category events",
    category: "web",
    format: "number",
    apiField: "TOTAL_VIEW_CATEGORY",
    type: "api",
  },
  {
    key: "webViewCategory",
    name: "Web View Category",
    description: "Number of web view category events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_VIEW_CATEGORY",
    type: "api",
  },

  // Watch Video (as conversion event)
  {
    key: "watchVideoConv",
    name: "Watch Video (Conversion)",
    description: "Number of watch video conversion events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WATCH_VIDEO",
    type: "api",
  },
  {
    key: "webWatchVideo",
    name: "Web Watch Video",
    description: "Number of web watch video events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_WATCH_VIDEO",
    type: "api",
  },

  // Custom Conversions
  {
    key: "customConversions",
    name: "Custom Conversions",
    description: "Number of custom conversion events",
    category: "web",
    format: "number",
    apiField: "TOTAL_CUSTOM",
    type: "api",
  },
  {
    key: "webCustom",
    name: "Web Custom Events",
    description: "Number of web custom events",
    category: "web",
    format: "number",
    apiField: "TOTAL_WEB_CUSTOM",
    type: "api",
  },
  {
    key: "addToWishlist",
    name: "Add to Wishlist",
    description: "Total number of add to wishlist events",
    category: "web",
    format: "number",
    apiField: "TOTAL_ADD_TO_WISHLIST",
    type: "api",
  },
  {
    key: "subscribe",
    name: "Subscribes",
    description: "Total number of subscribe events",
    category: "web",
    format: "number",
    apiField: "TOTAL_SUBSCRIBE",
    type: "api",
  },

  // Web ROAS
  {
    key: "webRoas",
    name: "Web ROAS",
    description: "Return on ad spend for web conversions",
    category: "web",
    format: "ratio",
    apiField: "WEB_ROAS",
    type: "api",
  },
];

// ============================================
// APP METRICS
// ============================================

const APP_METRICS: PinterestMetricDefinition[] = [
  {
    key: "appInstall",
    name: "App Installs",
    description: "Number of app install events",
    category: "app",
    format: "number",
    apiField: "TOTAL_APP_INSTALL",
    type: "api",
  },
  {
    key: "appOpen",
    name: "App Opens",
    description: "Number of app open events",
    category: "app",
    format: "number",
    apiField: "INAPP_OPEN",
    type: "api",
  },
  {
    key: "inAppSignup",
    name: "In-App Signups",
    description: "Number of in-app signup events",
    category: "app",
    format: "number",
    apiField: "TOTAL_INAPP_SIGNUP",
    type: "api",
  },
  {
    key: "inAppAddToCart",
    name: "In-App Add to Cart",
    description: "Number of in-app add to cart events",
    category: "app",
    format: "number",
    apiField: "TOTAL_INAPP_ADD_TO_CART",
    type: "api",
  },
  {
    key: "inAppSearch",
    name: "In-App Searches",
    description: "Number of in-app search events",
    category: "app",
    format: "number",
    apiField: "TOTAL_INAPP_SEARCH",
    type: "api",
  },
  {
    key: "inAppCustom",
    name: "In-App Custom Events",
    description: "Number of in-app custom events",
    category: "app",
    format: "number",
    apiField: "TOTAL_INAPP_CUSTOM",
    type: "api",
  },
  {
    key: "inAppRoas",
    name: "In-App ROAS",
    description: "Return on ad spend for in-app conversions",
    category: "app",
    format: "ratio",
    apiField: "INAPP_ROAS",
    type: "api",
  },
];

// ============================================
// AWARENESS METRICS
// ============================================

const AWARENESS_METRICS: PinterestMetricDefinition[] = [
  {
    key: "adRecallLift",
    name: "Ad Recall Lift",
    description: "Estimated increase in ad recall",
    category: "awareness",
    format: "number",
    apiField: "AD_RECALL_LIFT",
    type: "api",
  },
  {
    key: "awarenessLift",
    name: "Awareness Lift",
    description: "Estimated increase in brand awareness",
    category: "awareness",
    format: "number",
    apiField: "AWARENESS_LIFT",
    type: "api",
  },
];

// ============================================
// CALCULATED METRICS (Benly Custom)
// ============================================

const CALCULATED_METRICS: PinterestMetricDefinition[] = [
  {
    key: "hookRate",
    name: "Hook Rate",
    description: "(25% video views / video starts) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_VIDEO_P25_COMBINED / TOTAL_VIDEO_P0_COMBINED) * 100",
    dependencies: ["TOTAL_VIDEO_P25_COMBINED", "TOTAL_VIDEO_P0_COMBINED"],
  },
  {
    key: "holdRate",
    name: "Hold Rate",
    description: "(50% views / 25% views) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_VIDEO_P50_COMBINED / TOTAL_VIDEO_P25_COMBINED) * 100",
    dependencies: ["TOTAL_VIDEO_P50_COMBINED", "TOTAL_VIDEO_P25_COMBINED"],
  },
  {
    key: "videoCompletionRate",
    name: "Video Completion Rate",
    description: "(100% views / Video starts) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_VIDEO_P100_COMPLETE / TOTAL_VIDEO_P0_COMBINED) * 100",
    dependencies: ["TOTAL_VIDEO_P100_COMPLETE", "TOTAL_VIDEO_P0_COMBINED"],
  },
  {
    key: "throughRate",
    name: "Through Rate",
    description: "(100% views / 25% views) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_VIDEO_P100_COMPLETE / TOTAL_VIDEO_P25_COMBINED) * 100",
    dependencies: ["TOTAL_VIDEO_P100_COMPLETE", "TOTAL_VIDEO_P25_COMBINED"],
  },
  {
    key: "aov",
    name: "Average Order Value",
    description: "Checkout value / Checkouts",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR / TOTAL_CHECKOUT / 1000000",
    dependencies: ["TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR", "TOTAL_CHECKOUT"],
  },
  {
    key: "costPerEngagement",
    name: "Cost per Engagement",
    description: "Spend / Total engagements",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "SPEND_IN_MICRO_DOLLAR / TOTAL_ENGAGEMENT / 1000000",
    dependencies: ["SPEND_IN_MICRO_DOLLAR", "TOTAL_ENGAGEMENT"],
  },
  {
    key: "costPerSave",
    name: "Cost per Save",
    description: "Spend / Saves",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "SPEND_IN_MICRO_DOLLAR / REPIN_1 / 1000000",
    dependencies: ["SPEND_IN_MICRO_DOLLAR", "REPIN_1"],
  },
  {
    key: "costPerPinClick",
    name: "Cost per Pin Click",
    description: "Spend / Pin clicks",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "SPEND_IN_MICRO_DOLLAR / CLICKTHROUGH_1 / 1000000",
    dependencies: ["SPEND_IN_MICRO_DOLLAR", "CLICKTHROUGH_1"],
  },
  {
    key: "engagementRateCalc",
    name: "Engagement Rate (Calc)",
    description: "(Total engagement / Impressions) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_ENGAGEMENT / IMPRESSION_1) * 100",
    dependencies: ["TOTAL_ENGAGEMENT", "IMPRESSION_1"],
  },
  {
    key: "saveRateCalc",
    name: "Save Rate (Calc)",
    description: "(Saves / Impressions) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(REPIN_1 / IMPRESSION_1) * 100",
    dependencies: ["REPIN_1", "IMPRESSION_1"],
  },
  {
    key: "conversionRate",
    name: "Conversion Rate",
    description: "(Conversions / Clicks) * 100",
    category: "calculated",
    format: "percentage",
    apiField: "",
    type: "calculated",
    formula: "(TOTAL_CONVERSIONS / TOTAL_CLICKTHROUGH) * 100",
    dependencies: ["TOTAL_CONVERSIONS", "TOTAL_CLICKTHROUGH"],
  },
  {
    key: "costPerConversion",
    name: "Cost per Conversion",
    description: "Spend / Total conversions",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "SPEND_IN_MICRO_DOLLAR / TOTAL_CONVERSIONS / 1000000",
    dependencies: ["SPEND_IN_MICRO_DOLLAR", "TOTAL_CONVERSIONS"],
  },
  {
    key: "earnedMediaValue",
    name: "Earned Media Value",
    description: "Value of earned impressions (earned impressions * CPM / 1000)",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "(IMPRESSION_2 * (SPEND_IN_MICRO_DOLLAR / PAID_IMPRESSION * 1000)) / 1000000",
    dependencies: ["IMPRESSION_2", "SPEND_IN_MICRO_DOLLAR", "PAID_IMPRESSION"],
  },
  {
    key: "totalMediaValue",
    name: "Total Media Value",
    description: "Spend + Earned Media Value",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "SPEND_IN_MICRO_DOLLAR / 1000000 + (IMPRESSION_2 * (SPEND_IN_MICRO_DOLLAR / PAID_IMPRESSION * 1000)) / 1000000",
    dependencies: ["SPEND_IN_MICRO_DOLLAR", "IMPRESSION_2", "PAID_IMPRESSION"],
  },
];

// ============================================
// COMBINE ALL METRICS
// ============================================

export const PINTEREST_RAW_METRIC_CATALOG: PinterestMetricDefinition[] = [
  ...CORE_METRICS,
  ...ENGAGEMENT_METRICS,
  ...VIDEO_METRICS,
  ...CONVERSION_METRICS,
  ...CHECKOUT_METRICS,
  ...WEB_METRICS,
  ...APP_METRICS,
  ...AWARENESS_METRICS,
  ...CALCULATED_METRICS,
];

export function isPinterestMetricSupported(metric: PinterestMetricDefinition): boolean {
  if (metric.type === "api") {
    return Boolean(metric.apiField && PINTEREST_REPORTING_COLUMN_SET.has(metric.apiField));
  }

  return (metric.dependencies || []).every((dependency) =>
    PINTEREST_REPORTING_COLUMN_SET.has(dependency)
  );
}

export function isPinterestMetricSyncSupported(metric: PinterestMetricDefinition): boolean {
  if (metric.type === "api") {
    return Boolean(metric.apiField && PINTEREST_SYNC_REPORTING_COLUMN_SET.has(metric.apiField));
  }

  return (metric.dependencies || []).every((dependency) =>
    PINTEREST_SYNC_REPORTING_COLUMN_SET.has(dependency)
  );
}

export const PINTEREST_UNSUPPORTED_METRIC_CATALOG: PinterestMetricDefinition[] =
  PINTEREST_RAW_METRIC_CATALOG.filter((metric) => !isPinterestMetricSupported(metric));

export const PINTEREST_METRIC_CATALOG: PinterestMetricDefinition[] =
  PINTEREST_RAW_METRIC_CATALOG.filter(isPinterestMetricSupported);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all Pinterest metrics
 */
export function getPinterestMetrics(): PinterestMetricDefinition[] {
  return PINTEREST_METRIC_CATALOG;
}

/**
 * Get metric definition by key
 */
export function getPinterestMetricByKey(key: string): PinterestMetricDefinition | undefined {
  return PINTEREST_METRIC_CATALOG.find((m) => m.key === key);
}

/**
 * Get metrics by category
 */
export function getPinterestMetricsByCategory(category: MetricCategory): PinterestMetricDefinition[] {
  return PINTEREST_METRIC_CATALOG.filter((m) => m.category === category);
}

/**
 * Get all API metrics (not calculated)
 */
export function getPinterestApiMetrics(): PinterestMetricDefinition[] {
  return PINTEREST_METRIC_CATALOG.filter((m) => m.type === "api");
}

/**
 * Get all calculated metrics
 */
export function getPinterestCalculatedMetrics(): PinterestMetricDefinition[] {
  return PINTEREST_METRIC_CATALOG.filter((m) => m.type === "calculated");
}

/**
 * Get metric definition by API field
 */
export function getPinterestMetricByApiField(apiField: string): PinterestMetricDefinition | undefined {
  return PINTEREST_METRIC_CATALOG.find((m) => m.apiField === apiField);
}

/**
 * Get all metric categories
 */
export function getPinterestMetricCategories(): MetricCategory[] {
  return [...new Set(PINTEREST_METRIC_CATALOG.map((m) => m.category))];
}

/**
 * Convert metric keys to API fields
 */
export function pinterestMetricKeysToApiFields(keys: string[]): string[] {
  return keys
    .map((key) => {
      const metric = getPinterestMetricByKey(key);
      return metric?.type === "api" ? metric.apiField : null;
    })
    .filter((field): field is string => field !== null && field !== "");
}

/**
 * Get dependencies for calculated metrics
 */
export function getPinterestMetricDependencies(keys: string[]): string[] {
  const dependencies = new Set<string>();

  for (const key of keys) {
    const metric = getPinterestMetricByKey(key);
    if (metric?.type === "calculated" && metric.dependencies) {
      for (const dep of metric.dependencies) {
        dependencies.add(dep);
      }
    }
  }

  return Array.from(dependencies);
}

/**
 * Get count of metrics by category
 */
export function getPinterestMetricCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const metric of PINTEREST_METRIC_CATALOG) {
    counts[metric.category] = (counts[metric.category] || 0) + 1;
  }
  return counts;
}

export default PINTEREST_METRIC_CATALOG;
