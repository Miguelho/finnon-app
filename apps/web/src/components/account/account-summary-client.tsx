"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info, PlusCircle } from "lucide-react";
import {
  buildAccountViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  themeTokens,
  withAlpha,
  type AccountSummaryData,
  type AccountParticipantVM,
  type UserRole,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import { AccountSwitcher } from "@/components/home/account-switcher";
import { UserAvatar } from "@/components/user-avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { cn } from "@/lib/utils";

const tokens = themeTokens.light;
const colors = tokens.colors;

type AccountSummaryClientProps = {
  summaryData: AccountSummaryData;
  currentUserId: string;
  role: UserRole;
  accounts: {
    id: string;
    name: string;
    base_currency: string;
    memberCount?: number;
  }[];
  activeAccountId: string;
};

type SummaryValueWithPendingChipProps = {
  value: string;
  pendingMinor: bigint;
  pendingText: string;
  triggerLabel: string;
  valueClassName?: string;
  pendingToneColor?: string;
};

function SummaryValueWithPendingChip({
  value,
  pendingMinor,
  pendingText,
  triggerLabel,
  valueClassName,
  pendingToneColor,
}: SummaryValueWithPendingChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hasPending = pendingMinor > 0n;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const pendingTextColor = pendingToneColor
    ? withAlpha(pendingToneColor, 0.65)
    : colors.text.secondary;

  return (
    <div className="relative inline-flex items-center gap-2">
      <p className={cn("text-lg md:text-2xl font-bold", valueClassName)}>
        {value}
      </p>
      {hasPending ? (
        <>
          <button
            type="button"
            ref={triggerRef}
            aria-label={triggerLabel}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
          {open ? (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-full border bg-background px-3 py-1 text-xs shadow-sm animate-in fade-in-0 zoom-in-95"
              style={{
                borderColor: colors.state.neutral,
                color: pendingTextColor,
              }}
            >
              {pendingText}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function AccountSummaryClient({
  summaryData,
  currentUserId,
  role,
  accounts,
  activeAccountId,
}: AccountSummaryClientProps) {
  const t = useTranslations();

  // Build a minimal dictionary for the viewmodel
  const dictionary = useMemo(() => {
    return {
      account: {
        title: t("account.title"),
        participantsLabel: t("account.participantsLabel", { count: summaryData.participants.length }),
        participantsEmpty: t("account.participantsEmpty"),
        youLabel: t("account.youLabel"),
        summary: {
          balanceLabel: t("account.summary.balanceLabel"),
          incomeLabel: t("account.summary.incomeLabel"),
          expenseLabel: t("account.summary.expenseLabel"),
          categoriesTitle: t("account.summary.categoriesTitle"),
          categoriesViewAll: t("account.summary.categoriesViewAll"),
          categoriesCount: t("account.summary.categoriesCount", { count: summaryData.categories_count }),
          categoryBreakdownTitle: t("account.summary.categoryBreakdownTitle"),
          emptyCategories: t("account.summary.emptyCategories"),
          switchAccount: t("account.summary.switchAccount"),
          createAccount: t("account.summary.createAccount"),
          baseCurrencySubtitle: t("account.summary.baseCurrencySubtitle"),
        },
      },
    };
  }, [t, summaryData.participants.length, summaryData.categories_count]);

  const currencySymbol = useMemo(() => {
    const currency = summaryData.account.base_currency;
    return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  }, [summaryData.account.base_currency]);

  const viewModel = useMemo(() => {
    return buildAccountViewModel({
      data: summaryData,
      dictionary: dictionary as any,
      currentUserId,
      role,
    });
  }, [summaryData, dictionary, currentUserId, role]);

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const accountIdShort = summaryData.account.id.slice(0, 6);
  const participants = viewModel.participants;
  const pendingIncomeText = t("transactions.pendingChipLabel", {
    amount: formatMoneyWithSymbol(
      viewModel.totals.incomePendingMinor,
      viewModel.account.baseCurrency,
      currencySymbol
    ),
  });
  const pendingExpenseText = t("transactions.pendingChipLabel", {
    amount: formatMoneyWithSymbol(
      viewModel.totals.expensePendingMinor,
      viewModel.account.baseCurrency,
      currencySymbol
    ),
  });

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
  const [isMembersPanelOpen, setIsMembersPanelOpen] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoPopoverRef = useRef<HTMLDivElement | null>(null);

  const activeMember = useMemo(
    () => participants.find((participant) => participant.userId === activeMemberId) ?? null,
    [participants, activeMemberId]
  );

  useEffect(() => {
    if (!isInfoOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        infoPopoverRef.current?.contains(target) ||
        infoButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsInfoOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isInfoOpen]);

  return (
    <div className="space-y-6">
      {/* Account Hero */}
      <div className="space-y-3">
        <div className="flex justify-center">
          <div className="relative inline-flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-center">
              {viewModel.account.name}
            </h2>
            <button
              type="button"
              ref={infoButtonRef}
              onClick={() => setIsInfoOpen((prev) => !prev)}
              aria-label={t("account.infoButtonLabel")}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
            >
              <Info className="h-4 w-4" />
            </button>
            {isInfoOpen ? (
              <div
                ref={infoPopoverRef}
                className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-background p-3 shadow-sm animate-in fade-in-0 zoom-in-95"
              >
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("account.yourRoleLabel")}
                    </span>
                    <span className="font-medium text-foreground">{roleLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("account.summary.baseCurrencySubtitle")}
                    </span>
                    <span className="font-medium text-foreground">
                      {viewModel.account.baseCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("account.idLabel")}
                    </span>
                    <span className="font-mono text-xs text-foreground">
                      {accountIdShort}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <MemberAvatarsRow
          participants={participants}
          currentUserId={currentUserId}
          youLabel={viewModel.copy.youLabel}
          emptyLabel={viewModel.copy.participantsEmpty}
          onOpenMember={(memberId) => {
            setActiveMemberId(memberId);
            setIsMembersPanelOpen(false);
            setIsMemberPanelOpen(true);
          }}
          onOpenAllMembers={() => setIsMembersPanelOpen(true)}
          maxVisible={5}
        />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.balanceLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <p className="text-lg md:text-2xl font-bold">
              {formatMoneyWithSymbol(
                viewModel.totals.balanceMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.incomeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <SummaryValueWithPendingChip
              value={formatMoneyWithSymbol(
                viewModel.totals.incomeMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
              pendingMinor={viewModel.totals.incomePendingMinor}
              pendingText={pendingIncomeText}
              triggerLabel={t("transactions.pendingTriggerLabel")}
              valueClassName="text-state-positive"
              pendingToneColor={colors.state.positive}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.expenseLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <SummaryValueWithPendingChip
              value={formatMoneyWithSymbol(
                viewModel.totals.expenseMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
              pendingMinor={viewModel.totals.expensePendingMinor}
              pendingText={pendingExpenseText}
              triggerLabel={t("transactions.pendingTriggerLabel")}
              valueClassName="text-state-negative"
              pendingToneColor={colors.state.negative}
            />
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{viewModel.copy.categoriesTitle}</CardTitle>
            <CardDescription>{viewModel.copy.categoriesCount}</CardDescription>
          </div>
          <Link
            href="/settings/account"
            className="text-sm text-primary hover:underline"
          >
            {viewModel.copy.categoriesViewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {viewModel.categories.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {viewModel.copy.emptyCategories}
            </p>
          ) : (
            <div className="space-y-2">
              {viewModel.categories.breakdown.map((category) => {
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        iconKey={category.iconId}
                        size={20}
                        tone={category.type === "income" ? "positive" : "negative"}
                        accessibilityLabel={category.name}
                      />
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        category.type === "income"
                          ? "text-state-positive"
                          : "text-state-negative"
                      )}
                    >
                      {formatMoneyWithSymbol(
                        category.totalMinor,
                        viewModel.account.baseCurrency,
                        currencySymbol
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-6 right-6 z-20">
        <AccountSwitcher
          accounts={accounts}
          initialActiveAccountId={activeAccountId}
        />
      </div>

      <SlidePanel open={isMemberPanelOpen} onOpenChange={setIsMemberPanelOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>
              {activeMember
                ? resolveParticipantName(activeMember, currentUserId, viewModel.copy.youLabel)
                : viewModel.copy.participantsLabel}
            </SlidePanelTitle>
            {activeMember?.email ? (
              <SlidePanelDescription>{activeMember.email}</SlidePanelDescription>
            ) : null}
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-6">
            {activeMember ? (
              <>
                <div className="flex items-center gap-4">
                  <UserAvatar
                    email={activeMember.email}
                    userId={activeMember.userId}
                    avatarPath={activeMember.avatarPath}
                    fallbackText={activeMember.avatarFallbackText}
                    fallbackBgToken={activeMember.avatarFallbackBgToken as any}
                    size={56}
                    className="border border-border"
                  />
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {resolveParticipantName(
                        activeMember,
                        currentUserId,
                        viewModel.copy.youLabel
                      )}
                    </p>
                    {activeMember.email ? (
                      <p className="text-sm text-muted-foreground">
                        {activeMember.email}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("account.roleLabel")}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold uppercase text-foreground">
                    {activeMember.role}
                  </span>
                </div>
              </>
            ) : null}
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>

      <SlidePanel open={isMembersPanelOpen} onOpenChange={setIsMembersPanelOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{viewModel.copy.participantsLabel}</SlidePanelTitle>
            <SlidePanelDescription>{viewModel.account.name}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {viewModel.copy.participantsEmpty}
              </p>
            ) : (
              participants.map((participant) => {
                const displayName = resolveParticipantName(
                  participant,
                  currentUserId,
                  viewModel.copy.youLabel
                );
                return (
                  <button
                    key={participant.userId}
                    type="button"
                    onClick={() => {
                      setActiveMemberId(participant.userId);
                      setIsMembersPanelOpen(false);
                      setIsMemberPanelOpen(true);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        email={participant.email}
                        userId={participant.userId}
                        avatarPath={participant.avatarPath}
                        fallbackText={participant.avatarFallbackText}
                        fallbackBgToken={participant.avatarFallbackBgToken as any}
                        size={32}
                        className="border border-border"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {displayName}
                        </p>
                        {participant.email && participant.userId !== currentUserId ? (
                          <p className="text-xs text-muted-foreground">
                            {participant.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold uppercase text-foreground">
                      {participant.role}
                    </span>
                  </button>
                );
              })
            )}
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  );
}

function MemberAvatarsRow({
  participants,
  currentUserId,
  youLabel,
  emptyLabel,
  onOpenMember,
  onOpenAllMembers,
  maxVisible,
}: {
  participants: AccountParticipantVM[];
  currentUserId: string;
  youLabel: string;
  emptyLabel: string;
  onOpenMember: (memberId: string) => void;
  onOpenAllMembers: () => void;
  maxVisible: number;
}) {
  const { visibleMembers, overflowCount } = useMemo(() => {
    if (participants.length <= maxVisible) {
      return { visibleMembers: participants, overflowCount: 0 };
    }
    const visibleCount = Math.max(maxVisible - 1, 0);
    return {
      visibleMembers: participants.slice(0, visibleCount),
      overflowCount: participants.length - visibleCount,
    };
  }, [participants, maxVisible]);

  if (participants.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {visibleMembers.map((participant) => {
        const displayName = resolveParticipantName(
          participant,
          currentUserId,
          youLabel
        );
        return (
          <button
            key={participant.userId}
            type="button"
            onClick={() => onOpenMember(participant.userId)}
            className="rounded-full border border-transparent transition hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={displayName}
          >
            <UserAvatar
              email={participant.email}
              userId={participant.userId}
              avatarPath={participant.avatarPath}
              fallbackText={participant.avatarFallbackText}
              fallbackBgToken={participant.avatarFallbackBgToken as any}
              size={32}
            />
          </button>
        );
      })}
      {overflowCount > 0 ? (
        <button
          type="button"
          onClick={onOpenAllMembers}
          className="flex h-9 min-w-[36px] items-center justify-center rounded-full border border-border bg-muted px-2 text-xs font-semibold text-foreground"
          aria-label={`+${overflowCount}`}
        >
          +{overflowCount}
        </button>
      ) : null}
    </div>
  );
}

function resolveParticipantName(
  participant: AccountParticipantVM,
  currentUserId: string,
  youLabel: string
) {
  if (participant.userId === currentUserId) return youLabel;
  return (
    participant.displayName ||
    participant.email ||
    `User ${participant.userId.slice(0, 6)}`
  );
}
