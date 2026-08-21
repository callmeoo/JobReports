import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { isEmailAllowed } from "@/lib/allowed-emails";
import { db } from "@/lib/db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function ensureUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    const valid = await bcrypt.compare(password, existing.passwordHash);
    if (!valid) {
      return null;
    }
    return existing;
  }

  const configuredPassword = process.env.AUTH_PASSWORD;
  if (!configuredPassword || password !== configuredPassword) {
    return null;
  }

  const passwordHash = await bcrypt.hash(configuredPassword, 12);
  return db.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        if (!isEmailAllowed(email)) {
          return null;
        }

        const user = await ensureUser(email, parsed.data.password);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? email.split("@")[0],
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
