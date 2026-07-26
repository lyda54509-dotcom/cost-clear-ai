import { z } from "zod";

export const businessNameSchema = z
  .string()
  .trim()
  .min(2, "Business name must be at least 2 characters")
  .max(80, "Business name must be under 80 characters")
  .regex(/^[\p{L}\p{N}\s'&.,()\-]+$/u, "Business name has invalid characters");

export const saleRowSchema = z.object({
  item_name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(60, "Item name must be under 60 characters"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .positive("Quantity must be greater than 0")
    .max(100000, "Quantity looks too large"),
  buying_price: z
    .number({ invalid_type_error: "Cost must be a number" })
    .min(0, "Cost cannot be negative")
    .max(10000000, "Cost looks too large"),
  selling_price: z
    .number({ invalid_type_error: "Sell price must be a number" })
    .min(0, "Sell price cannot be negative")
    .max(10000000, "Sell price looks too large"),
});

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pick a category"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(100000000, "Amount looks too large"),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  notes: z.string().trim().max(500, "Notes must be under 500 characters").optional(),
});

export const reportInputSchema = z
  .object({
    periodType: z.enum(["daily", "monthly", "annual"]),
    referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid reference date"),
  })
  .refine(
    (v) => {
      const d = new Date(v.referenceDate + "T00:00:00Z").getTime();
      const now = Date.now();
      return !Number.isNaN(d) && d <= now + 24 * 3600 * 1000;
    },
    { message: "Reference date cannot be in the future", path: ["referenceDate"] },
  );

/** Convert a ZodError into a single readable string for toast feedback. */
export function firstZodMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? "Invalid input";
  }
  return err instanceof Error ? err.message : "Invalid input";
}
