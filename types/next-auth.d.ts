import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string | null;
      preferredLang?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }

  interface User {
    id: string;
    username?: string | null;
    preferredLang?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username?: string | null;
    preferredLang?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}