import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signupSchema = credentialsSchema.extend({
  displayName: z.string().min(1, "Enter a display name.").max(80).optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
