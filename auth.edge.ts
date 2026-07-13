import NextAuth from "next-auth";

export const { auth } = NextAuth({
  providers: [],
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
      }
      return session;
    }
  }
});
