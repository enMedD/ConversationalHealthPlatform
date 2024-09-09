"use client";

import { AdminPageTitle } from "@/components/admin/Title";
import { DatabaseIcon } from "@/components/icons/icons";
import { QueryHistoryTable } from "./QueryHistoryTable";

export default function QueryHistoryPage() {
  return (
    <main className="py-24 md:py-32 lg:pt-16">
      <AdminPageTitle title="Query History" icon={<DatabaseIcon size={32} />} />

      <QueryHistoryTable />
    </main>
  );
}
