/**
 * UK Spring Statement 2026 reform configuration.
 */

// Backend API URL - placeholder
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Reform metadata for UI display.
 * Includes both household-positive and household-negative reforms.
 */
export const REFORMS = [
  // Policies that benefit households
  {
    id: "policy_1",
    name: "Policy 1",
    description: "Policy 1 placeholder description",
    color: "#0D9488",  // Teal 600
    type: "positive",
  },
  {
    id: "policy_2",
    name: "Policy 2",
    description: "Policy 2 placeholder description",
    color: "#0F766E",  // Teal 700
    type: "positive",
  },
  {
    id: "policy_3",
    name: "Policy 3",
    description: "Policy 3 placeholder description",
    color: "#2DD4BF",  // Teal 400
    type: "positive",
  },
  // Policies that cost households (revenue raising)
  {
    id: "policy_4",
    name: "Policy 4",
    description: "Policy 4 placeholder description",
    color: "#78350F",  // Amber 900
    type: "negative",
  },
  {
    id: "policy_5",
    name: "Policy 5",
    description: "Policy 5 placeholder description",
    color: "#92400E",  // Amber 800
    type: "negative",
  },
  {
    id: "policy_6",
    name: "Policy 6",
    description: "Policy 6 placeholder description",
    color: "#B45309",  // Amber 700
    type: "negative",
  },
];
