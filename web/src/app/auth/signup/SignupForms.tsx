"use client";

import { TextFormField } from "@/components/admin/connectors/Field";
import { basicLogin, basicSignup } from "@/lib/user";
import { Form, Formik } from "formik";
import { useRouter } from "next/navigation";
import * as Yup from "yup";
import { requestEmailVerification } from "../lib";
import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function SignupForms({ shouldVerify }: { shouldVerify?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <>
      {isLoading && <Spinner />}
      <Formik
        initialValues={{
          full_name: "",
          company_name: "",
          email: "",
          password: "",
          confirm_password: "",
        }}
        validationSchema={Yup.object().shape({
          full_name: Yup.string().min(3).max(70).required(),
          company_name: Yup.string().required(),
          email: Yup.string().email().required("Email is required"),
          password: Yup.string().required("Password is required").min(8),
          confirm_password: Yup.string()
            .required("Confirm password is required")
            .oneOf([Yup.ref("password")], "Passwords must match"),
        })}
        onSubmit={async (values) => {
          setIsLoading(true);
          const response = await basicSignup(
            values.full_name,
            values.company_name,
            values.email,
            values.password
          );
          if (!response.ok) {
            setIsLoading(false);
            const errorDetail = (await response.json()).detail;

            let errorMsg = "Unknown error";
            if (errorDetail === "REGISTER_USER_ALREADY_EXISTS") {
              errorMsg = "An account already exists with the specified email.";
            }
            toast({
              title: "Error",
              description: `Failed to sign up - ${errorMsg}`,
              variant: "destructive",
            });
            return;
          }
        }}
      >
        {({ isSubmitting, values }) => (
          <Form>
            <TextFormField
              name="full_name"
              label="Full name"
              type="text"
              placeholder="Enter your full name"
            />
            <TextFormField
              name="company_name"
              label="Company Name"
              type="text"
              placeholder="Enter your company name"
            />
            <TextFormField
              name="email"
              label="Email"
              type="email"
              placeholder="Enter your email"
            />
            <TextFormField
              name="password"
              label="Password"
              type="password"
              placeholder="Enter your password"
            />
            <TextFormField
              name="confirm_password"
              label="Confirm Password"
              type="password"
              placeholder="Enter your password"
            />

            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label className="p-0" htmlFor="remember">
                Remember me
              </Label>
            </div>

            <div className="flex pt-8">
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
