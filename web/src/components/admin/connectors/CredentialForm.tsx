import React from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { CredentialBase } from "@/lib/types";
import { createCredential } from "@/lib/credential";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export async function submitCredential<T>(
  credential: CredentialBase<T>
): Promise<{ message: string; isSuccess: boolean }> {
  let isSuccess = false;
  try {
    const response = await createCredential(credential);
    if (response.ok) {
      isSuccess = true;
      return { message: "Success!", isSuccess: true };
    } else {
      const errorData = await response.json();
      return { message: `Error: ${errorData.detail}`, isSuccess: false };
    }
  } catch (error) {
    return { message: `Error: ${error}`, isSuccess: false };
  }
}

interface Props<YupObjectType extends Yup.AnyObject> {
  formBody: JSX.Element | null;
  validationSchema: Yup.ObjectSchema<YupObjectType>;
  initialValues: YupObjectType;
  onSubmit: (isSuccess: boolean) => void;
}

export function CredentialForm<T extends Yup.AnyObject>({
  formBody,
  validationSchema,
  initialValues,
  onSubmit,
}: Props<T>): JSX.Element {
  const { toast } = useToast();

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values, formikHelpers) => {
        formikHelpers.setSubmitting(true);
        submitCredential<T>({
          credential_json: values,
          admin_public: true,
        }).then(({ message, isSuccess }) => {
          toast({
            title: isSuccess ? "Success" : "Error",
            description: message,
            variant: isSuccess ? "success" : "destructive",
          });
          formikHelpers.setSubmitting(false);
          onSubmit(isSuccess);
        });
      }}
    >
      {({ isSubmitting }) => (
        <Form>
          {formBody}
          <div className="flex">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-64 mx-auto"
            >
              Update
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}
