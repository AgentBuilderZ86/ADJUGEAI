import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: { id: string; tenantId: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    tenantId: string;
    role: Role;
  }
}

const identifiants = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { email: {}, motDePasse: {} },
      async authorize(brut) {
        const parse = identifiants.safeParse(brut);
        if (!parse.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parse.data.email.toLowerCase() } });
        if (!user || !(await bcrypt.compare(parse.data.motDePasse, user.motDePasse))) return null;
        await prisma.user.update({ where: { id: user.id }, data: { derniereConn: new Date() } });
        return { id: user.id, email: user.email, name: user.nom, tenantId: user.tenantId, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
