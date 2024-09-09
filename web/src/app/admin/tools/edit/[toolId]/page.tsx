import { ErrorCallout } from "@/components/ErrorCallout";
import { Text, Title } from "@tremor/react";
import { ToolEditor } from "@/app/admin/tools/ToolEditor";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";

export default async function Page({ params }: { params: { toolId: string } }) {
  const tool = await fetchToolByIdSS(params.toolId);

  let body;
  if (!tool) {
    body = (
      <div>
        <ErrorCallout
          errorTitle="Something went wrong :("
          errorMsg="Tool not found"
        />
      </div>
    );
  } else {
    body = (
      <div className="w-full my-8">
        <div>
          <div>
            <Card>
              <CardContent>
                <ToolEditor tool={tool} />
              </CardContent>
            </Card>

            <Title className="mt-12">Delete Tool</Title>
            <Text>Click the button below to permanently delete this tool.</Text>
            <div className="flex mt-6">
              <DeleteToolButton toolId={tool.id} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-24 md:py-32 lg:pt-16">
      <BackButton />

      <AdminPageTitle
        title="Edit Tool"
        icon={<FiTool size={32} className="my-auto" />}
      />

      {body}
    </div>
  );
}
