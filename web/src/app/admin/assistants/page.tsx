import { AssistantsTable } from "./AssistantTable";
import { FiPlusSquare } from "react-icons/fi";
import Link from "next/link";
import { Divider, Text, Title } from "@tremor/react";
import { fetchSS } from "@/lib/utilsSS";
import { ErrorCallout } from "@/components/ErrorCallout";
import { Assistant } from "./interfaces";
import { LinkIcon, RobotIcon } from "@/components/icons/icons";
import { AdminPageTitle } from "@/components/admin/Title";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const assistantResponse = await fetchSS("/admin/assistant");

  if (!assistantResponse.ok) {
    return (
      <ErrorCallout
        errorTitle="Something went wrong :("
        errorMsg={`Failed to fetch assistants - ${await assistantResponse.text()}`}
      />
    );
  }

  const assistants = (await assistantResponse.json()) as Assistant[];

  return (
    <div className="mx-auto container">
      <AdminPageTitle icon={<RobotIcon size={32} />} title="Assistants" />

      <Text className="mb-2">
        Assistants are a way to build custom search/question-answering
        experiences for different use cases.
      </Text>
      <Text className="mt-2">They allow you to customize:</Text>
      <div className="text-sm">
        <ul className="list-disc mt-2 ml-4">
          <li>
            The prompt used by your LLM of choice to respond to the user query
          </li>
          <li>The documents that are used as context</li>
        </ul>
      </div>

      <div>
        <Divider />

        <Title>Create an Assistant</Title>
        <Link href="/admin/assistants/new" className="flex items-center">
          <Button className="mt-2">
            <FiPlusSquare className="my-auto mr-2" />
            New Assistant
          </Button>
        </Link>

        <Divider />

        <Title>Existing Assistants</Title>
        <AssistantsTable assistants={assistants} />
      </div>
    </div>
  );
}
