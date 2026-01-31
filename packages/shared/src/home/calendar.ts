import { themeTokens } from "../theme/tokens";
import { withAlpha } from "../utils/color";
import type { CalendarEvent } from "./home.compute";

export type CalendarMarkerShape = "square" | "ring" | "dot";

export type CalendarMarkerStyle = {
  color: string;
  shape: CalendarMarkerShape;
};

type CalendarMarkerOptions = {
  isPending?: boolean;
  colors?: typeof themeTokens.light.colors;
  pendingAlpha?: number;
};

export const getCalendarMarkerStyle = (
  type: CalendarEvent["type"],
  options: CalendarMarkerOptions = {}
): CalendarMarkerStyle => {
  const {
    isPending = false,
    colors = themeTokens.light.colors,
    pendingAlpha = 0.5,
  } = options;

  let color = colors.state.negative;
  let shape: CalendarMarkerShape = "dot";

  switch (type) {
    case "obligation_paid":
      color = colors.action.primary;
      shape = "square";
      break;
    case "obligation_pending":
      color = colors.state.warning;
      shape = "square";
      break;
    case "recurring_income":
      color = colors.state.positive;
      shape = "ring";
      break;
    case "recurring_expense":
      color = colors.state.negative;
      shape = "ring";
      break;
    case "one_off_income":
      color = colors.state.positive;
      shape = "dot";
      break;
    case "one_off_expense":
    default:
      color = colors.state.negative;
      shape = "dot";
      break;
  }

  return {
    color: isPending ? withAlpha(color, pendingAlpha) : color,
    shape,
  };
};
