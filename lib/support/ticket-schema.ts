import { z } from "zod";

export const ticketCategories = [
  "deposit",
  "withdrawal",
  "trading",
  "referrals",
  "account",
  "other",
] as const;

export const ticketSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  wallet: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional()
    .or(z.literal("")),
  category: z.enum(ticketCategories),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
});

export type SupportTicketInput = z.infer<typeof ticketSchema>;

export const ticketStatuses = ["open", "pending", "resolved", "closed"] as const;

export type SupportTicketStatus = (typeof ticketStatuses)[number];

export interface SupportTicket extends SupportTicketInput {
  id: string;
  createdAt: number;
  status: SupportTicketStatus;
}
