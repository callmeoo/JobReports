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

function getConfiguredPassword(): string | null {
  const value = process.env.AUTH_PASSWORD?.trim();
  return value || null;
}

async function ensureUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const configuredPassword = getConfiguredPassword();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    const valid = await bcrypt.compare(password, existing.passwordHash);
    if (valid) {
      return existing;
    }

    // Vercel 更新 AUTH_PASSWORD 后，允许用环境变量密码重新同步
    if (configuredPassword && password === configuredPassword) {
      const passwordHash = await bcrypt.hash(configuredPassword, 12);
      return db.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    }

    return null;
  }

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
        if (!process.env.AUTH_SECRET?.trim()) {
          console.error("[auth] AUTH_SECRET is not configured");
          return null;
        }

        if (!getConfiguredPassword()) {
          console.error("[auth] AUTH_PASSWORD is not configured");
          return null;
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        if (!isEmailAllowed(email)) {
          return null;
        }

        try {
          const user = await ensureUser(email, parsed.data.password);
          if (!user) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? email.split("@")[0],
          };
        } catch (error) {
          console.error("[auth] database error during login", error);
          return null;
        }
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
