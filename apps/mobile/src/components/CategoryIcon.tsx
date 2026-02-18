import * as React from "react";
import {
  House,
  ShoppingCart,
  UtensilsCrossed,
  Car,
  Bus,
  TrainFront,
  Plane,
  Ticket,
  Fuel,
  CreditCard,
  Wallet,
  Receipt,
  PiggyBank,
  Landmark,
  Heart,
  BriefcaseMedical,
  Pill,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Gamepad2,
  Clapperboard,
  Music,
  Circle,
  Dumbbell,
  Shirt,
  ShoppingBag,
  Tag,
  Gift,
  PawPrint,
  Leaf,
  TreePine,
  Lightbulb,
  Plug,
  Wifi,
  Smartphone,
  Laptop,
  Monitor,
  Camera,
  Wrench,
  Settings,
  Hammer,
  Scissors,
  Brush,
  BedDouble,
  Sofa,
  Store,
  Building2,
  Briefcase,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import {
  type CategoryIconKey,
  type CategoryIconProps,
  type CategoryIconTone,
  resolveCategoryIconKey,
  themeTokens,
} from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const iconComponents: Record<CategoryIconKey, LucideIcon> = {
  House,
  ShoppingCart,
  ForkKnife: UtensilsCrossed,
  Car,
  Bus,
  Train: TrainFront,
  Airplane: Plane,
  Ticket,
  GasPump: Fuel,
  CreditCard,
  Wallet,
  Receipt,
  PiggyBank,
  Bank: Landmark,
  Heart,
  FirstAidKit: BriefcaseMedical,
  Pill,
  Stethoscope,
  GraduationCap,
  BookOpen,
  GameController: Gamepad2,
  FilmSlate: Clapperboard,
  MusicNotes: Music,
  Basketball: Circle,
  Barbell: Dumbbell,
  TShirt: Shirt,
  Handbag: ShoppingBag,
  Tag,
  Gift,
  PawPrint,
  Leaf,
  Tree: TreePine,
  Lightbulb,
  Plug,
  WifiHigh: Wifi,
  Phone: Smartphone,
  Laptop,
  Monitor,
  Camera,
  Wrench,
  Gear: Settings,
  Hammer,
  Scissors,
  Broom: Brush,
  Bed: BedDouble,
  Couch: Sofa,
  Storefront: Store,
  Buildings: Building2,
  Briefcase,
  UsersThree: Users,
};

const fallbackIcon: LucideIcon = Tag;

export function CategoryIcon({
  iconKey,
  size = 20,
  tone = "primary",
  weight = "regular",
  accessibilityLabel,
}: CategoryIconProps) {
  const { tokens: userTokens, resolvedMode } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const resolvedKey = resolveCategoryIconKey(iconKey);
  const IconComponent = iconComponents[resolvedKey] ?? fallbackIcon;
  const toneColors: Record<CategoryIconTone, string> = {
    primary: userTokens.textPrimary,
    muted: userTokens.textSecondary,
    positive: modeColors.state.positive,
    negative: modeColors.state.negative,
  };
  const color = toneColors[tone];
  const isFilled = weight === "fill";

  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={isFilled ? 0 : 1.5}
      fill={isFilled ? color : "none"}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
