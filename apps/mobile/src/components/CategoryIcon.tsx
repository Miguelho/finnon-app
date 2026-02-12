import * as React from "react";
import {
  House,
  ShoppingCart,
  ForkKnife,
  Car,
  Bus,
  Train,
  Airplane,
  Ticket,
  GasPump,
  CreditCard,
  Wallet,
  Receipt,
  PiggyBank,
  Bank,
  Heart,
  FirstAidKit,
  Pill,
  Stethoscope,
  GraduationCap,
  BookOpen,
  GameController,
  FilmSlate,
  MusicNotes,
  Basketball,
  Barbell,
  TShirt,
  Handbag,
  Tag,
  Gift,
  PawPrint,
  Leaf,
  Tree,
  Lightbulb,
  Plug,
  WifiHigh,
  Phone,
  Laptop,
  Monitor,
  Camera,
  Wrench,
  Gear,
  Hammer,
  Scissors,
  Broom,
  Bed,
  Couch,
  Storefront,
  Buildings,
  Briefcase,
  UsersThree,
  type IconWeight,
} from "phosphor-react-native";
import type { ComponentType } from "react";
import {
  type CategoryIconKey,
  type CategoryIconProps,
  type CategoryIconTone,
  resolveCategoryIconKey,
  themeTokens,
} from "@poleursus/shared";

const tokens = themeTokens.light;

const toneColors: Record<CategoryIconTone, string> = {
  primary: tokens.colors.text.primary,
  muted: tokens.colors.text.muted,
  positive: tokens.colors.state.positive,
  negative: tokens.colors.state.negative,
};

type PhosphorIconProps = {
  size?: number;
  weight?: IconWeight;
  color?: string;
  accessibilityLabel?: string;
};

const iconComponents: Record<CategoryIconKey, ComponentType<PhosphorIconProps>> = {
  House,
  ShoppingCart,
  ForkKnife,
  Car,
  Bus,
  Train,
  Airplane,
  Ticket,
  GasPump,
  CreditCard,
  Wallet,
  Receipt,
  PiggyBank,
  Bank,
  Heart,
  FirstAidKit,
  Pill,
  Stethoscope,
  GraduationCap,
  BookOpen,
  GameController,
  FilmSlate,
  MusicNotes,
  Basketball,
  Barbell,
  TShirt,
  Handbag,
  Tag,
  Gift,
  PawPrint,
  Leaf,
  Tree,
  Lightbulb,
  Plug,
  WifiHigh,
  Phone,
  Laptop,
  Monitor,
  Camera,
  Wrench,
  Gear,
  Hammer,
  Scissors,
  Broom,
  Bed,
  Couch,
  Storefront,
  Buildings,
  Briefcase,
  UsersThree,
};

export function CategoryIcon({
  iconKey,
  size = 20,
  tone = "primary",
  weight = "regular",
  accessibilityLabel,
}: CategoryIconProps) {
  const resolvedKey = resolveCategoryIconKey(iconKey);
  const IconComponent = iconComponents[resolvedKey] ?? Tag;
  const color = toneColors[tone];

  return (
    <IconComponent
      size={size}
      weight={weight}
      color={color}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
