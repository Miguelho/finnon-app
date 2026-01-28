"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SlidePanel = DialogPrimitive.Root;
const SlidePanelTrigger = DialogPrimitive.Trigger;
const SlidePanelClose = DialogPrimitive.Close;

// NO overlay component - continuity visual priority
const SlidePanelPortal = DialogPrimitive.Portal;

const SlidePanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const t = useTranslations("common");

  return (
    <SlidePanelPortal>
      {/* NO DialogOverlay - sin fondo oscuro/translúcido */}
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Base - always applied
          "fixed z-50 flex flex-col",
          // Finnon Color Tokens (color-guide.md)
          "bg-[#FFFFFF] text-[#1C1E21] border-[#DADCE0]",
          "border shadow-xl",
          // Mobile (default): bottom sheet
          "bottom-0 left-0 right-0 h-[90vh] w-full",
          "border-t rounded-t-xl",
          // Desktop (md+): right panel - override mobile
          "md:top-0 md:right-0 md:left-auto md:bottom-auto",
          "md:h-screen md:w-[480px]",
          "md:border-t-0 md:border-l md:rounded-none",
          // Animations - Mobile (from bottom)
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:fade-out-0",
          // Animations - Desktop (from right) - override
          "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
          "duration-300 data-[state=closed]:duration-200",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">{t("close")}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SlidePanelPortal>
  );
});
SlidePanelContent.displayName = DialogPrimitive.Content.displayName;

const SlidePanelHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 px-6 py-4 border-b",
      className
    )}
    {...props}
  />
);
SlidePanelHeader.displayName = "SlidePanelHeader";

const SlidePanelBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex-1 min-h-0 overflow-y-auto px-6 py-6",
      className
    )}
    {...props}
  />
);
SlidePanelBody.displayName = "SlidePanelBody";

const SlidePanelFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 px-6 py-4 border-t sm:flex-row sm:justify-end sm:gap-2",
      className
    )}
    {...props}
  />
);
SlidePanelFooter.displayName = "SlidePanelFooter";

const SlidePanelTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
SlidePanelTitle.displayName = DialogPrimitive.Title.displayName;

const SlidePanelDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SlidePanelDescription.displayName = DialogPrimitive.Description.displayName;

export {
  SlidePanel,
  SlidePanelPortal,
  SlidePanelClose,
  SlidePanelTrigger,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelBody,
  SlidePanelFooter,
  SlidePanelTitle,
  SlidePanelDescription,
};
