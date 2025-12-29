"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createCategorySchema, type CategoryType } from "@poleursus/shared";

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function createCategory(input: {
  account_id: string;
  name: string;
  icon_id: string;
  type: CategoryType;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", input.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: "Not a member of this account" };
    }

    // Validate input
    const validated = createCategorySchema.parse(input);

    // Insert category
    const { data, error } = await supabase
      .from("categories")
      .insert([validated])
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/categories");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createCategory:", error);
    return {
      success: false,
      error: error.message || "Failed to create category",
    };
  }
}

export async function updateCategory(
  categoryId: string,
  input: {
    name: string;
    icon_id: string;
    type: CategoryType;
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get the category to verify ownership
    const { data: category } = await supabase
      .from("categories")
      .select("account_id")
      .eq("id", categoryId)
      .single();

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", category.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: "Not a member of this account" };
    }

    // Update category
    const { data, error } = await supabase
      .from("categories")
      .update({
        name: input.name,
        icon_id: input.icon_id,
        type: input.type,
      })
      .eq("id", categoryId)
      .select()
      .single();

    if (error) {
      console.error("Error updating category:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/categories");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in updateCategory:", error);
    return {
      success: false,
      error: error.message || "Failed to update category",
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
      return { success: false, error: "Unauthorized" };
    }

    // Get the category to verify ownership
    const { data: category } = await supabase
      .from("categories")
      .select("account_id")
      .eq("id", categoryId)
      .single();

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", category.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: "Not a member of this account" };
    }

    // Delete category
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      console.error("Error deleting category:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/categories");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteCategory:", error);
    return {
      success: false,
      error: error.message || "Failed to delete category",
    };
  }
}
