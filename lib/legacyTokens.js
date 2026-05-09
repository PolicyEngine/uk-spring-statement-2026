/**
 * Local extension of @policyengine/ui-kit/legacy tokens.
 *
 * ui-kit/legacy 0.8.0 dropped the `blue` palette that the original
 * @policyengine/design-system shipped. Until it is restored upstream, this
 * module re-exports a `colors` object that adds it back. Values match
 * design-system 0.3.0.
 */
import { colors as legacyColors } from "@policyengine/ui-kit/legacy/tokens/colors";

const BLUE_PALETTE = {
  50: "#F0F9FF",
  100: "#E0F2FE",
  200: "#BAE6FD",
  300: "#7DD3FC",
  400: "#38BDF8",
  500: "#0EA5E9",
  600: "#0284C7",
  700: "#026AA2",
  800: "#075985",
  900: "#0C4A6E",
};

export const colors = {
  ...legacyColors,
  blue: BLUE_PALETTE,
  success: "#22C55E",
};
