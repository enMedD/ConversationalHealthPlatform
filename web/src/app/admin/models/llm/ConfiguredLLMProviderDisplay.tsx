import { PopupSpec, usePopup } from "@/components/admin/connectors/Popup";
import { FullLLMProvider, WellKnownLLMProviderDescriptor } from "./interfaces";
import { Modal } from "@/components/Modal";
import { LLMProviderUpdateForm } from "./LLMProviderUpdateForm";
import { CustomLLMProviderUpdateForm } from "./CustomLLMProviderUpdateForm";
import { useState } from "react";
import { LLM_PROVIDERS_ADMIN_URL } from "./constants";
import { mutate } from "swr";
import isEqual from "lodash/isEqual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomModal } from "@/components/CustomModal";

function LLMProviderUpdateModal({
  llmProviderDescriptor,
  onClose,
  existingLlmProvider,
  shouldMarkAsDefault,
  setPopup,
}: {
  llmProviderDescriptor: WellKnownLLMProviderDescriptor | null | undefined;
  onClose: () => void;
  existingLlmProvider?: FullLLMProvider;
  shouldMarkAsDefault?: boolean;
  setPopup?: (popup: PopupSpec) => void;
}) {
  const providerName = existingLlmProvider?.name
    ? `"${existingLlmProvider.name}"`
    : null ||
      llmProviderDescriptor?.display_name ||
      llmProviderDescriptor?.name ||
      "Custom LLM Provider";
  return (
    <div className="px-4">
      <h2 className="text-2xl font-semibold pb-6">{`${
        llmProviderDescriptor ? "Configure" : "Setup"
      } ${providerName}`}</h2>
      {llmProviderDescriptor ? (
        <LLMProviderUpdateForm
          llmProviderDescriptor={llmProviderDescriptor}
          onClose={onClose}
          existingLlmProvider={existingLlmProvider}
          shouldMarkAsDefault={shouldMarkAsDefault}
          setPopup={setPopup}
        />
      ) : (
        <CustomLLMProviderUpdateForm
          onClose={onClose}
          existingLlmProvider={existingLlmProvider}
          shouldMarkAsDefault={shouldMarkAsDefault}
          setPopup={setPopup}
        />
      )}
    </div>
  );
}

function LLMProviderDisplay({
  llmProviderDescriptor,
  existingLlmProvider,
  shouldMarkAsDefault,
}: {
  llmProviderDescriptor: WellKnownLLMProviderDescriptor | null | undefined;
  existingLlmProvider: FullLLMProvider;
  shouldMarkAsDefault?: boolean;
}) {
  const [formIsVisible, setFormIsVisible] = useState(false);
  const { popup, setPopup } = usePopup();

  const providerName =
    existingLlmProvider?.name ||
    llmProviderDescriptor?.display_name ||
    llmProviderDescriptor?.name;

  const handleClose = () => {
    setFormIsVisible(false);
  };

  return (
    <div>
      {popup}
      <div className="flex p-3 border rounded shadow-sm border-border md:w-96">
        <div className="my-auto">
          <div className="font-bold">{providerName} </div>
          <div className="text-xs italic">({existingLlmProvider.provider})</div>
          {!existingLlmProvider.is_default_provider && (
            <div
              className="pt-1 text-xs cursor-pointer text-link"
              onClick={async () => {
                const response = await fetch(
                  `${LLM_PROVIDERS_ADMIN_URL}/${existingLlmProvider.id}/default`,
                  {
                    method: "POST",
                  }
                );
                if (!response.ok) {
                  const errorMsg = (await response.json()).detail;
                  setPopup({
                    type: "error",
                    message: `Failed to set provider as default: ${errorMsg}`,
                  });
                  return;
                }

                mutate(LLM_PROVIDERS_ADMIN_URL);
                setPopup({
                  type: "success",
                  message: "Provider set as default successfully!",
                });
              }}
            >
              Set as default
            </div>
          )}
        </div>

        {existingLlmProvider && (
          <div className="my-auto ml-3">
            {existingLlmProvider.is_default_provider ? (
              <Badge variant="outline">Default</Badge>
            ) : (
              <Badge variant="success">Enabled</Badge>
            )}
          </div>
        )}

        <div className="ml-auto">
          <CustomModal
            trigger={
              <Button
                variant={existingLlmProvider ? "outline" : "default"}
                onClick={() => setFormIsVisible(true)}
              >
                {existingLlmProvider ? "Edit" : "Set up"}
              </Button>
            }
            onClose={handleClose}
            open={formIsVisible}
          >
            <LLMProviderUpdateModal
              llmProviderDescriptor={llmProviderDescriptor}
              onClose={handleClose}
              existingLlmProvider={existingLlmProvider}
              shouldMarkAsDefault={shouldMarkAsDefault}
              setPopup={setPopup}
            />
          </CustomModal>
        </div>
      </div>
      {/*   {formIsVisible && (
        <LLMProviderUpdateModal
          llmProviderDescriptor={llmProviderDescriptor}
          onClose={() => setFormIsVisible(false)}
          existingLlmProvider={existingLlmProvider}
          shouldMarkAsDefault={shouldMarkAsDefault}
          setPopup={setPopup}
        />
      )} */}
    </div>
  );
}

export function ConfiguredLLMProviderDisplay({
  existingLlmProviders,
  llmProviderDescriptors,
}: {
  existingLlmProviders: FullLLMProvider[];
  llmProviderDescriptors: WellKnownLLMProviderDescriptor[];
}) {
  existingLlmProviders = existingLlmProviders.sort((a, b) => {
    if (a.is_default_provider && !b.is_default_provider) {
      return -1;
    }
    if (!a.is_default_provider && b.is_default_provider) {
      return 1;
    }
    return a.provider > b.provider ? 1 : -1;
  });

  return (
    <div className="flex flex-col gap-y-4 pb-10">
      {existingLlmProviders.map((provider) => {
        const defaultProviderDesciptor = llmProviderDescriptors.find(
          (llmProviderDescriptors) =>
            llmProviderDescriptors.name === provider.provider
        );

        return (
          <LLMProviderDisplay
            key={provider.id}
            // if the user has specified custom model names,
            // then the provider is custom - don't use the default
            // provider descriptor
            llmProviderDescriptor={
              isEqual(provider.model_names, defaultProviderDesciptor?.llm_names)
                ? defaultProviderDesciptor
                : null
            }
            existingLlmProvider={provider}
          />
        );
      })}
    </div>
  );
}
