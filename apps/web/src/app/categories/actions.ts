"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  assignCategoryColor,
  categoryCreateInputSchema,
  categoryUpdateInputSchema,
  normalizeCategoryName,
  normalizeHexColor,
  type CategoryType,
} from "@poleursus/shared";

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: { key: string; params?: Record<string, string | number> };
};

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

export async function createCategory(input: {
  account_id: string;
  name: string;
  icon_id: string;
  type: CategoryType;
  color?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", input.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    // Validate input
    const validated = categoryCreateInputSchema.parse(input);

    let supportsColor = true;
    let existingCategories: Array<{ id: string; name: string; color?: string | null }> = [];
    let existingError: any = null;

    {
      const result = await supabase
        .from("categories")
        .select("id, name, color")
        .eq("account_id", validated.account_id);
      existingCategories = (result.data ?? []) as Array<{
        id: string;
        name: string;
        color?: string | null;
      }>;
      existingError = result.error;
    }

    if (isMissingCategoryColorError(existingError)) {
      supportsColor = false;
      const legacyResult = await supabase
        .from("categories")
        .select("id, name")
        .eq("account_id", validated.account_id);
      existingCategories = ((legacyResult.data ?? []) as Array<{ id: string; name: string }>).map(
        (category) => ({ ...category, color: null })
      );
      existingError = legacyResult.error;
    }

    if (existingError) {
      console.error("Error checking duplicate categories:", existingError);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    const normalizedName = validated.name.toLowerCase();
    const isDuplicate = (existingCategories ?? []).some(
      (category) =>
        normalizeCategoryName(category.name).toLowerCase() === normalizedName
    );

    if (isDuplicate) {
      return { success: false, error: { key: "categories.error.duplicateName" } };
    }

    const autoColor = supportsColor
      ? assignCategoryColor((existingCategories ?? []) as Array<{ color?: string | null }>)
      : null;
    const nextColor = normalizeHexColor(validated.color) ?? autoColor;
    const { color: _ignoredColor, ...validatedWithoutColor } = validated;

    const insertPayload = supportsColor
      ? { ...validatedWithoutColor, color: nextColor }
      : validatedWithoutColor;

    // Insert category
    let { data, error } = await supabase
      .from("categories")
      .insert([insertPayload])
      .select()
      .single();

    if (isMissingCategoryColorError(error)) {
      ({ data, error } = await supabase
        .from("categories")
        .insert([validatedWithoutColor])
        .select()
        .single());
    }

    if (error) {
      console.error("Error creating category:", error);
      if (error.code === "23505") {
        return {
          success: false,
          error: { key: "categories.error.duplicateName" },
        };
      }
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/account");
    revalidatePath("/settings/account");
    revalidatePath(`/account/${validated.account_id}/settings/categories`);
    revalidatePath("/transactions");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createCategory:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}

export async function updateCategory(
  categoryId: string,
  input: {
    name: string;
    icon_id: string;
    type: CategoryType;
    color?: string | null;
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Get the category to verify ownership
    const { data: category } = await supabase
      .from("categories")
      .select("account_id")
      .eq("id", categoryId)
      .single();

    if (!category) {
      return { success: false, error: { key: "errors.categoryNotFound" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", category.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    const validated = categoryUpdateInputSchema.parse(input);

    const { data: existingCategories, error: existingError } = await supabase
      .from("categories")
      .select("id, name")
      .eq("account_id", category.account_id);

    if (existingError) {
      console.error("Error checking duplicate categories:", existingError);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    const normalizedName = validated.name.toLowerCase();
    const isDuplicate = (existingCategories ?? []).some(
      (existing) =>
        existing.id !== categoryId &&
        normalizeCategoryName(existing.name).toLowerCase() === normalizedName
    );

    if (isDuplicate) {
      return { success: false, error: { key: "categories.error.duplicateName" } };
    }

    const updatePayload: {
      name: string;
      icon_id: string;
      type: CategoryType;
      color?: string | null;
    } = {
      name: validated.name,
      icon_id: validated.icon_id,
      type: validated.type,
    };

    if (validated.color !== undefined) {
      updatePayload.color = normalizeHexColor(validated.color);
    }

    // Update category
    let { data, error } = await supabase
      .from("categories")
      .update(updatePayload)
      .eq("id", categoryId)
      .select()
      .single();

    if (isMissingCategoryColorError(error)) {
      ({ data, error } = await supabase
        .from("categories")
        .update({
          name: validated.name,
          icon_id: validated.icon_id,
          type: validated.type,
        })
        .eq("id", categoryId)
        .select()
        .single());
    }

    if (error) {
      console.error("Error updating category:", error);
      if (error.code === "23505") {
        return {
          success: false,
          error: { key: "categories.error.duplicateName" },
        };
      }
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/account");
    revalidatePath("/settings/account");
    revalidatePath(`/account/${category.account_id}/settings/categories`);
    revalidatePath("/transactions");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in updateCategory:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}

export async function deleteCategory(
  categoryId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Get the category to verify ownership
    const { data: category } = await supabase
      .from("categories")
      .select("account_id")
      .eq("id", categoryId)
      .single();

    if (!category) {
      return { success: false, error: { key: "errors.categoryNotFound" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", category.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    // Delete category
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.error("Error deleting category:", error);
      if (error.code === "23503") {
        return { success: false, error: { key: "categories.error.inUse" } };
      }
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/account");
    revalidatePath("/settings/account");
    revalidatePath(`/account/${category.account_id}/settings/categories`);
    revalidatePath("/transactions");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteCategory:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}
