import { FinnonMark } from "@/components/brand/finnon-mark";
import { PageContainer } from "@/components/layout/page-container";

function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/60 ${className}`} />;
}

export default function CreateTransactionLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 w-full border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <LoadingBlock className="h-8 w-28 rounded-md" />
          <div className="flex items-center gap-3">
            <LoadingBlock className="h-9 w-9 rounded-full" />
            <LoadingBlock className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="mx-auto max-w-2xl py-6">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-muted/40 shadow-sm">
              <span className="inline-flex animate-spin">
                <FinnonMark size="lg" mode="iconOnly" />
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Cargando...</p>
          </div>

          <LoadingBlock className="mb-6 h-8 w-56" />

          <div className="min-h-[60vh] rounded-2xl border border-border bg-background p-6">
            <div className="mb-6 flex items-center justify-between gap-4 border-b pb-4">
              <LoadingBlock className="h-6 w-40" />
              <LoadingBlock className="h-10 w-10 rounded-md" />
            </div>

            <div className="space-y-6 py-2">
              <LoadingBlock className="h-12 w-full rounded-full" />
              <LoadingBlock className="h-36 w-full" />
              <LoadingBlock className="h-28 w-full" />
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <LoadingBlock className="h-10 w-24 rounded-md" />
              <LoadingBlock className="h-10 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </PageContainer>

      <div className="h-16 sm:hidden" />
    </div>
  );
}
