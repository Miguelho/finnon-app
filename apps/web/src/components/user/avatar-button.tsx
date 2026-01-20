"use client";

import * as React from "react";
import type { AvatarColorToken } from "@poleursus/shared";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type AvatarButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  email: string;
  userId: string;
  avatarPath?: string | null;
  fallbackText?: string | null;
  fallbackBgToken?: AvatarColorToken | null;
  size?: number;
  ariaLabel: string;
  title: string;
};

export const AvatarButton = React.forwardRef<
  HTMLButtonElement,
  AvatarButtonProps
>(
  (
    {
      email,
      userId,
      avatarPath,
      fallbackText,
      fallbackBgToken,
      size = 30,
      ariaLabel,
      title,
      className,
      type,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={ariaLabel}
        title={title}
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
        {...props}
      >
        <UserAvatar
          email={email}
          userId={userId}
          avatarPath={avatarPath}
          fallbackText={fallbackText}
          fallbackBgToken={fallbackBgToken}
          size={size}
          label={title}
          className="shrink-0"
        />
      </button>
    );
  }
);

AvatarButton.displayName = "AvatarButton";
