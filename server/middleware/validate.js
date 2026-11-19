import { z } from "zod";

// Validated bodies replace the original request body. Unknown keys are removed
// before any database operation, preventing mass-assignment of IDs and roles.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0]?.message || "Invalid request" });
  }
  req.body = result.data;
  next();
};

const email = z.email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(72);

export const registerInput = z.object({
  username: z.string().trim().min(2).max(60),
  email,
  password,
});

export const loginInput = z.object({
  email,
  password: z.string().min(1).max(1024),
});

export const forgotPasswordInput = z.object({ email });

export const resetPasswordInput = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid reset link"),
  password,
});

export const accountInput = z.object({ username: z.string().trim().min(2).max(60) });
export const spaceInput = z.object({ name: z.string().trim().min(2).max(60) });
export const joinSpaceInput = z.object({ inviteCode: z.string().trim().min(1).max(40) });
