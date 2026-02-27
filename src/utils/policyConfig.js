/**
 * Policy configuration for UK Spring Statement dashboard.
 *
 * Color scheme follows autumn budget pattern:
 * - Teal/green spectrum: policies that are GOOD for households (costs to treasury)
 * - Amber/orange spectrum: policies that are BAD for households (revenue raisers)
 */

// Policy colors by display name
// Teal = costs to government (good for households)
// Amber = revenue raisers (bad for households)
export const POLICY_COLORS = {
  // COSTS to treasury (good for households - teal/green spectrum)
  "Policy 1": "#0D9488",   // Teal 600
  "Policy 2": "#0F766E",   // Teal 700
  "Policy 3": "#2DD4BF",   // Teal 400

  // REVENUE raisers (bad for households - amber/orange spectrum)
  "Policy 4": "#78350F",   // Amber 900 (darkest)
  "Policy 5": "#92400E",   // Amber 800
  "Policy 6": "#B45309",   // Amber 700
};

export const POLICY_IDS = {
  policy_1: "policy_1",
  policy_2: "policy_2",
  policy_3: "policy_3",
  policy_4: "policy_4",
  policy_5: "policy_5",
  policy_6: "policy_6",
};

export const POLICY_NAMES = {
  policy_1: "Policy 1",
  policy_2: "Policy 2",
  policy_3: "Policy 3",
  policy_4: "Policy 4",
  policy_5: "Policy 5",
  policy_6: "Policy 6",
};

// Order for stacked charts: largest to smallest within each category
// This puts biggest bars at the base (closest to zero), smaller bars stack outward
export const ALL_POLICY_IDS = [
  // Costs to treasury (negative, teal) - largest to smallest (largest at base near zero)
  "policy_1",
  "policy_2",
  "policy_3",
  // Revenue raisers (positive, amber) - largest to smallest (largest at base near zero)
  "policy_4",
  "policy_5",
  "policy_6",
];

export const ALL_POLICY_NAMES = [
  "Policy 1",
  "Policy 2",
  "Policy 3",
  "Policy 4",
  "Policy 5",
  "Policy 6",
];

// Policies that are costs to treasury (negative values, good for households)
export const COST_POLICIES = [
  "policy_1",
  "policy_2",
  "policy_3",
];

// Policies that are revenue raisers (positive values, bad for households)
export const REVENUE_POLICIES = [
  "policy_4",
  "policy_5",
  "policy_6",
];
