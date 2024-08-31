"use client";

import { TextFormField } from "@/components/admin/connectors/Field";
import { usePopup } from "@/components/admin/connectors/Popup";
import { basicLogin, basicSignup } from "@/lib/user";
import { Form, Formik } from "formik";
import { useRouter } from "next/navigation";
import * as Yup from "yup";
import { requestEmailVerification } from "../lib";
import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

export function SignupForms({ shouldVerify }: { shouldVerify?: boolean }) {
  const router = useRouter();
  const { popup, setPopup } = usePopup();
  const [isWorking, setIsWorking] = useState(false);

  return (
    <>
      {isWorking && <Spinner />}
      {popup}
      <Formik
        initialValues={{
          full_name: "",
          company_name: "",
          email: "",
          password: "",
        }}
        validationSchema={Yup.object().shape({
          full_name: Yup.string().min(3).max(70).required(),
          company_name: Yup.string().required(),
          email: Yup.string().email().required(),
          password: Yup.string().required(),
        })}
        onSubmit={async (values) => {
          setIsWorking(true);
          const response = await basicSignup(
            values.full_name,
            values.company_name,
            values.email,
            values.password
          );
          if (!response.ok) {
            const errorDetail = (await response.json()).detail;

            let errorMsg = "Unknown error";
            if (errorDetail === "REGISTER_USER_ALREADY_EXISTS") {
              errorMsg =
                "An account already exwkists with the specified email.";
            }
            setPopup({
              type: "error",
              message: `Failed to sign up - ${errorMsg}`,
            });
            return;
          } else {
            if (shouldVerify) {
              await requestEmailVerification(values.email);
              router.push("/auth/waiting-on-verification");
            } else {
              router.push("/");
            }
          }
        }}
      >
        {({ isSubmitting, values }) => (
          <Form>
            <TextFormField name="full_name" label="Full name" type="text" />
            <TextFormField
              name="company_name"
              label="Company name"
              type="text"
            />
            <TextFormField
              name="email"
              label="Email"
              type="email"
              placeholder="email@yourcompany.com"
            />
            <TextFormField
              name="password"
              label="Password"
              type="password"
              placeholder="**************"
            />

            <div className="flex">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                Sign Up
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
}