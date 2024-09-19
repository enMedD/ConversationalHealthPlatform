"use client";

import { useState, useEffect } from "react";
import { ApiKeyForm } from "./ApiKeyForm";
import { WellKnownLLMProviderDescriptor } from "@/app/admin/models/llm/interfaces";
import { checkLlmProvider } from "../initialSetup/welcome/lib";
import { User } from "@/lib/types";
import { useRouter } from "next/navigation";
import { CustomModal } from "../CustomModal";

export const ApiKeyModal = ({ user }: { user: User | null }) => {
  const router = useRouter();

  const [forceHidden, setForceHidden] = useState<boolean>(false);
  const [validProviderExists, setValidProviderExists] = useState<boolean>(true);
  const [providerOptions, setProviderOptions] = useState<
    WellKnownLLMProviderDescriptor[]
  >([]);

  useEffect(() => {
    async function fetchProviderInfo() {
      const { providers, options, defaultCheckSuccessful } =
        await checkLlmProvider(user);
      setValidProviderExists(providers.length > 0 && defaultCheckSuccessful);
      setProviderOptions(options);
    }

    fetchProviderInfo();
  }, []);

  // don't show if
  //  (1) a valid provider has been setup or
  //  (2) there are no provider options (e.g. user isn't an admin)
  //  (3) user explicitly hides the modal
  if (validProviderExists || !providerOptions.length || forceHidden) {
    return null;
  }

  return (
    <CustomModal
      open={!forceHidden}
      onClose={() => setForceHidden(true)}
      trigger={null}
      title="LLM Key Setup"
    >
      <div>
        <div className="mb-5 text-sm">
          Please setup an LLM below in order to start using Search or Chat.
          Don&apos;t worry, you can always change this later in the Admin Panel.
          <br />
          <br />
          Or if you&apos;d rather look around first,{" "}
          <strong
            onClick={() => setForceHidden(true)}
            className="text-link cursor-pointer"
          >
            skip this step
          </strong>
          .
        </div>

        <ApiKeyForm
          onSuccess={() => {
            router.refresh();
            setForceHidden(true);
          }}
          providerOptions={providerOptions}
        />
      </div>
    </CustomModal>
  );
};
