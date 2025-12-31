"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { cn } from "@/lib/utils";

type AddActionProps = {
  canEdit: boolean;
};

const actions = [
  {
    label: "Añadir gasto",
    description: "Registra un pago del día a día.",
    href: "/transactions?new=1&type=expense",
  },
  {
    label: "Añadir ingreso",
    description: "Suma un ingreso a tu mes.",
    href: "/transactions?new=1&type=income",
  },
  {
    label: "Añadir obligación",
    description: "Programa un pago recurrente.",
    href: "/transactions?new=1&type=expense&kind=obligation",
  },
];

export function AddAction({ canEdit }: AddActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>+ Añadir</Button>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full px-5 py-6 shadow-lg"
      >
        + Añadir
      </Button>

      <SlidePanel open={isOpen} onOpenChange={setIsOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>Añadir</SlidePanelTitle>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                Ves esta cuenta como invitado.
              </p>
            )}
            <div className="space-y-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(action.href);
                  }}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left",
                    !canEdit && "cursor-not-allowed opacity-60",
                    canEdit
                      ? "border-border hover:bg-muted/40"
                      : "border-border"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {action.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </button>
              ))}
            </div>
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
