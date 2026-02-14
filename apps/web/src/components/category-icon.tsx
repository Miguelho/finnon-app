"use client";

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
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import {
  type CategoryIconKey,
  type CategoryIconProps,
  type CategoryIconTone,
  resolveCategoryIconKey,
} from "@poleursus/shared";

const toneColors: Record<CategoryIconTone, string> = {
  primary: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  positive: "hsl(var(--state-positive))",
  negative: "hsl(var(--state-negative))",
};

type PhosphorIconProps = {
  size?: number;
  weight?: IconWeight;
  color?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
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

type ExtendedCategoryIconProps = CategoryIconProps & {
  /** Alias for iconKey (for backwards compatibility) */
  iconId?: string | null;
  /** Optional direct color override */
  color?: string;
};

export function CategoryIcon({
  iconKey,
  iconId,
  color,
  size = 20,
  tone = "primary",
  weight = "regular",
  accessibilityLabel,
}: ExtendedCategoryIconProps) {
  const resolvedKey = resolveCategoryIconKey(iconKey ?? iconId);
  const IconComponent = iconComponents[resolvedKey] ?? Tag;

  const resolvedColor = color ?? toneColors[tone];

  return (
    <IconComponent
      size={size}
      weight={weight}
      color={resolvedColor}
      aria-label={accessibilityLabel}
      aria-hidden={!accessibilityLabel}
    />
  );
}
