import { z } from "zod";
import { NEWS_BODY_MAX, NEWS_TITLE_MAX } from "@/lib/news/image";

export const newsWriteSchema = z.object({
  title: z.string().trim().min(1).max(NEWS_TITLE_MAX),
  body: z.string().trim().min(1).max(NEWS_BODY_MAX),
  published: z.boolean().optional().default(true),
  pinned: z.boolean().optional().default(false),
  notify: z.boolean().optional().default(false),
  clearImage: z.boolean().optional().default(false),
  image: z
    .object({
      dataBase64: z.string().min(32).max(900_000),
      mime: z.string().max(64).optional(),
    })
    .nullable()
    .optional(),
});
