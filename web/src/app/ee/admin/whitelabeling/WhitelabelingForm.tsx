"use client";

import { useRouter } from "next/navigation";
import { Workspaces } from "@/app/admin/settings/interfaces";
import { useContext, useState } from "react";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { Form, Formik } from "formik";
import * as Yup from "yup";
import { SubLabel, TextFormField } from "@/components/admin/connectors/Field";
import { ImageUpload } from "./ImageUpload";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

export function WhitelabelingForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const settings = useContext(SettingsContext);
  if (!settings) {
    return null;
  }
  const workspaces = settings.workspaces;

  async function updateWorkspaces(newValues: Workspaces) {
    const response = await fetch("/api/admin/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(workspaces || {}),
        ...newValues,
      }),
    });
    if (response.ok) {
      router.refresh();
      toast({
        title: "Settings updated",
        description: "The workspace settings have been successfully updated.",
        variant: "success",
      });
    } else {
      const errorMsg = (await response.json()).detail;
      toast({
        title: "Failed to update settings.",
        description: errorMsg,
        variant: "destructive",
      });
    }
  }

  return (
    <div>
      <Formik
        initialValues={{
          workspace_name: workspaces?.workspace_name || null,
          workspace_description: workspaces?.workspace_description || null,
          use_custom_logo: workspaces?.use_custom_logo || false,
          custom_header_logo: workspaces?.custom_header_logo || "",
          custom_header_content: workspaces?.custom_header_content || "",
        }}
        validationSchema={Yup.object().shape({
          workspace_name: Yup.string().nullable(),
          workspace_description: Yup.string().nullable(),
          use_custom_logo: Yup.boolean().required(),
          custom_header_logo: Yup.string().nullable(),
          custom_header_content: Yup.string().nullable(),
        })}
        onSubmit={async (values, formikHelpers) => {
          formikHelpers.setSubmitting(true);

          if (selectedFile) {
            values.use_custom_logo = true;

            const formData = new FormData();
            formData.append("file", selectedFile);
            setSelectedFile(null);
            const response = await fetch("/api/admin/workspace/logo", {
              method: "PUT",
              body: formData,
            });
            if (!response.ok) {
              const errorMsg = (await response.json()).detail;
              toast({
                title: "Failed to upload logo",
                description: `Error: ${errorMsg}`,
                variant: "destructive",
              });
              formikHelpers.setSubmitting(false);
              return;
            }
          }
          formikHelpers.setValues(values);
          await updateWorkspaces(values);

          toast({
            title: "Logo uploaded",
            description: "The logo has been successfully uploaded.",
            variant: "success",
          });
        }}
      >
        {({ isSubmitting, values, setValues }) => (
          <Form>
            <TextFormField
              label="Workspace Name"
              name="workspace_name"
              subtext={`The custom name you are giving for your workspace. This will replace 'Vanguard AI' everywhere in the UI.`}
              placeholder="Custom name which will replace 'Vanguard AI'"
              disabled={isSubmitting}
            />

            <div className="pt-2" />

            <TextFormField
              label="Description"
              name="workspace_description"
              subtext={`The custom description metadata you are giving ${
                values.workspace_name || "Vanguard AI"
              } for your workspace.\
                This will be seen when sharing the link or searching through the browser.`}
              placeholder="Custom description for your Workspace"
              disabled={isSubmitting}
            />

            <div className="pt-2" />

            {values.use_custom_logo ? (
              <div className="pt-3 flex flex-col items-start gap-3">
                <div>
                  <h3>Custom Logo</h3>
                  <SubLabel>Current Custom Logo: </SubLabel>
                </div>
                <img
                  src={"/api/workspace/logo?u=" + Date.now()}
                  alt="Logo"
                  style={{ objectFit: "contain" }}
                  className="w-32 h-32"
                />

                <Button
                  variant="destructive"
                  type="button"
                  onClick={async () => {
                    const valuesWithoutLogo = {
                      ...values,
                      use_custom_logo: false,
                    };
                    await updateWorkspaces(valuesWithoutLogo);
                    setValues(valuesWithoutLogo);
                  }}
                >
                  Delete
                </Button>

                <p className="text-sm text-subtle pt-4 pb-2">
                  Override the current custom logo by uploading a new image
                  below and clicking the Update button.
                </p>
              </div>
            ) : (
              <p className="pb-3 text-sm text-subtle">
                Specify your own logo to replace the standard Vanguard AI logo.
              </p>
            )}

            <ImageUpload
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
            />

            <div className="pt-2" />

            <div className="pt-8">
              <TextFormField
                label="Custom Popup Header"
                name="custom_popup_header"
                subtext={`The title for the popup that will be displayed for each user on their initial visit 
              to the application. If left blank AND Custom Popup Content is specified, will use "Welcome to ${
                values.workspace_name || "Vanguard AI"
              }!".`}
                placeholder="Initial Popup Header"
                disabled={isSubmitting}
              />
            </div>

            <div className="pt-2" />

            <div>
              <TextFormField
                label="Custom Popup Content"
                name="custom_header_content"
                subtext={`Custom Markdown content that will be displayed as a popup on initial visit to the application.`}
                placeholder="Your popup content..."
                isTextArea
                disabled={isSubmitting}
              />
            </div>

            <div className="pt-2" />

            <Button type="submit">Update</Button>
          </Form>
        )}
      </Formik>
    </div>
  );
}
