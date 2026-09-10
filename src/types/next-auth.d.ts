import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "MASTER_RESEARCHER" | "INTERVIEWER";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: "MASTER_RESEARCHER" | "INTERVIEWER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: "MASTER_RESEARCHER" | "INTERVIEWER";
  }
}
