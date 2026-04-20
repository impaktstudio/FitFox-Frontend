export type AuthMode = "test" | "supabase";

export type AuthContext = {
  userId: string;
  mode: AuthMode;
  source: "test_header" | "test_env" | "supabase";
};
