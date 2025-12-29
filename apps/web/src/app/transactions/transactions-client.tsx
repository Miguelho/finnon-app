"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TransactionType,
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  getIconById,
} from "@poleursus/shared";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "./actions";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string;
  currency: string;
  amount_base_minor: string;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  category?: Category | null;
};

type TransactionsClientProps = {
  accountId: string;
  baseCurrency: string;
  initialTransactions: Transaction[];
  categories: Category[];
};

export function TransactionsClient({
  accountId,
  baseCurrency,
  initialTransactions,
  categories,
}: TransactionsClientProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Month filter state (format: YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Form state
  const [formData, setFormData] = useState<{
    type: TransactionType;
    amount: string;
    currency: string;
    category_id: string | undefined;
    date: string;
    merchant: string;
    notes: string;
  }>({
    type: "expense" as TransactionType,
    amount: "",
    currency: baseCurrency,
    category_id: undefined,
    date: new Date().toISOString().slice(0, 10),
    merchant: "",
    notes: "",
  });

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    let income = 0n;
    let expense = 0n;

    filteredTransactions.forEach((t) => {
      const amount = BigInt(t.amount_base_minor);
      if (t.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    const balance = income - expense;

    return { income, expense, balance };
  }, [filteredTransactions]);

  // Get currency symbol
  const currencySymbol =
    CURRENCIES.find((c) => c.code === baseCurrency)?.symbol || baseCurrency;

  const handleCreate = async () => {
    if (!formData.amount.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createTransaction({
        account_id: accountId,
        type: formData.type,
        amount: formData.amount,
        currency: formData.currency,
        category_id: formData.category_id || null,
        date: formData.date,
        merchant: formData.merchant || null,
        notes: formData.notes || null,
      });

      if (result.success && result.data) {
        setTransactions([result.data, ...transactions]);
        setIsCreateOpen(false);
        setFormData({
          type: "expense",
          amount: "",
          currency: baseCurrency,
          category_id: undefined,
          date: new Date().toISOString().slice(0, 10),
          merchant: "",
          notes: "",
        });
        router.refresh();
      } else {
        alert(result.error || "Error creating transaction");
      }
    } catch (error) {
      alert("Error creating transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTransaction || !formData.amount.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await updateTransaction(selectedTransaction.id, {
        type: formData.type,
        amount: formData.amount,
        currency: formData.currency,
        category_id: formData.category_id || null,
        date: formData.date,
        merchant: formData.merchant || null,
        notes: formData.notes || null,
      });

      if (result.success && result.data) {
        setTransactions(
          transactions.map((t) =>
            t.id === selectedTransaction.id ? result.data! : t
          )
        );
        setIsEditOpen(false);
        setSelectedTransaction(null);
        setFormData({
          type: "expense",
          amount: "",
          currency: baseCurrency,
          category_id: undefined,
          date: new Date().toISOString().slice(0, 10),
          merchant: "",
          notes: "",
        });
        router.refresh();
      } else {
        alert(result.error || "Error updating transaction");
      }
    } catch (error) {
      alert("Error updating transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTransaction) return;

    setIsSubmitting(true);
    try {
      const result = await deleteTransaction(selectedTransaction.id);

      if (result.success) {
        setTransactions(
          transactions.filter((t) => t.id !== selectedTransaction.id)
        );
        setIsDeleteOpen(false);
        setSelectedTransaction(null);
        router.refresh();
      } else {
        alert(result.error || "Error deleting transaction");
      }
    } catch (error) {
      alert("Error deleting transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: formatMinorToMoney(
        BigInt(transaction.amount_minor),
        transaction.currency
      ),
      currency: transaction.currency,
      category_id: transaction.category_id || undefined,
      date: transaction.date,
      merchant: transaction.merchant || "",
      notes: transaction.notes || "",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteOpen(true);
  };

  // Get available categories based on transaction type
  const availableCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              Track your income and expenses
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Dashboard
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              New Transaction
            </Button>
          </div>
        </div>

        {/* Month Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filter by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="max-w-xs"
            />
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Income</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {formatMoneyWithSymbol(
                  monthlySummary.income,
                  baseCurrency,
                  currencySymbol
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expenses</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {formatMoneyWithSymbol(
                  monthlySummary.expense,
                  baseCurrency,
                  currencySymbol
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Balance</CardDescription>
              <CardTitle
                className={`text-3xl ${
                  monthlySummary.balance >= 0n
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatMoneyWithSymbol(
                  monthlySummary.balance >= 0n
                    ? monthlySummary.balance
                    : -monthlySummary.balance,
                  baseCurrency,
                  monthlySummary.balance >= 0n ? currencySymbol : `-${currencySymbol}`
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Transactions for {new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </CardTitle>
            <CardDescription>
              {filteredTransactions.length} transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transactions for this month. Create one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((transaction) => {
                  const category = transaction.category;
                  const icon = category ? getIconById(category.icon_id) : null;
                  const amount = formatMoneyWithSymbol(
                    BigInt(transaction.amount_base_minor),
                    baseCurrency,
                    currencySymbol
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {/* Icon */}
                        <div className="text-2xl">
                          {icon?.emoji || (transaction.type === "income" ? "💰" : "💸")}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              {transaction.merchant || category?.name || "Uncategorized"}
                            </span>
                            {transaction.merchant && category && (
                              <span className="text-sm text-muted-foreground">
                                • {category.name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString()}
                            {transaction.notes && (
                              <span className="ml-2">• {transaction.notes}</span>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div
                          className={`font-semibold text-lg ${
                            transaction.type === "income"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {amount}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(transaction)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(transaction)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
              <DialogDescription>
                Record a new income or expense transaction
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: TransactionType) => {
                      setFormData({ ...formData, type: value, category_id: "" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="text"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.code} - {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category (optional)</Label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value === "none" ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableCategories.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No {formData.type} categories yet
                      </SelectItem>
                    ) : (
                      availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {getIconById(cat.icon_id)?.emoji || "📦"} {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant (optional)</Label>
                <Input
                  id="merchant"
                  value={formData.merchant}
                  onChange={(e) =>
                    setFormData({ ...formData, merchant: e.target.value })
                  }
                  placeholder="e.g., Starbucks"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Add any additional notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Update the transaction details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: TransactionType) => {
                      setFormData({ ...formData, type: value, category_id: "" });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount</Label>
                  <Input
                    id="edit-amount"
                    type="text"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.code} - {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category (optional)</Label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value === "none" ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableCategories.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        No {formData.type} categories yet
                      </SelectItem>
                    ) : (
                      availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {getIconById(cat.icon_id)?.emoji || "📦"} {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-merchant">Merchant (optional)</Label>
                <Input
                  id="edit-merchant"
                  value={formData.merchant}
                  onChange={(e) =>
                    setFormData({ ...formData, merchant: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this transaction. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
