import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      steamId?: string;
      name?: string;
      avatar?: string;
    };
  }

  interface User {
    steamId?: string;
    name?: string;
    avatar?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    steamId?: string;
    name?: string;
    avatar?: string;
  }
}
