import { User } from "@/lib/types";
import {
  AuthTypeMetadata,
  getAuthTypeMetadataSS,
  getCurrentUserSS,
} from "@/lib/userSS";
import { redirect } from "next/navigation";
import { SideBar } from "../SideBar";
import { WorkSpaceSidebar } from "@/app/chat/sessionSidebar/WorkSpaceSidebar";
import { DynamicSidebar } from "../DynamicSidebar";

export async function Layout({ children }: { children: React.ReactNode }) {
  const tasks = [getAuthTypeMetadataSS(), getCurrentUserSS()];

  // catch cases where the backend is completely unreachable here
  // without try / catch, will just raise an exception and the page
  // will not render
  let results: (User | AuthTypeMetadata | null)[] = [null, null];
  try {
    results = await Promise.all(tasks);
  } catch (e) {
    console.log(`Some fetch failed for the main search page - ${e}`);
  }

  const authTypeMetadata = results[0] as AuthTypeMetadata | null;
  const user = results[1] as User | null;

  const authDisabled = authTypeMetadata?.authType === "disabled";
  const requiresVerification = authTypeMetadata?.requiresVerification;
  if (!authDisabled) {
    if (!user) {
      return redirect("/auth/login");
    }
    if (user.role !== "admin") {
      return redirect("/");
    }
    if (!user.is_verified && requiresVerification) {
      return redirect("/auth/waiting-on-verification");
    }
  }

  return (
    <div className="h-screen overflow-y-hidden">
      <div className="flex h-full">
        <DynamicSidebar user={user}>
          <SideBar />
        </DynamicSidebar>
        {/* <div className="flex-1 h-full px-6 pt-8 pb-8 md:px-12 overflow-y-auto"> */}
        <div className="flex-1 h-full overflow-y-auto py-20 lg:py-14 px-6 lg:pl-24 lg:pr-14 xl:px-10 2xl:px-24">
          {children}
        </div>
      </div>
    </div>
  );
}
