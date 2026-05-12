import { createClient } from "@/lib/supabase/server";
import PostFabClient from "./post-fab-client";

export default async function PostFab() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <PostFabClient isLogged={!!user} />;
}
