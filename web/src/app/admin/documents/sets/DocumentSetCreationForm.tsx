"use client";

import { ArrayHelpers, FieldArray, Form, Formik } from "formik";
import * as Yup from "yup";
import { createDocumentSet, updateDocumentSet } from "./lib";
import { ConnectorIndexingStatus, DocumentSet, Teamspace } from "@/lib/types";
import {
  BooleanFormField,
  TextFormField,
} from "@/components/admin/connectors/Field";
import { ConnectorTitle } from "@/components/admin/connectors/ConnectorTitle";
import { Divider, Text } from "@tremor/react";
import { FiUsers } from "react-icons/fi";
import { usePaidEnterpriseFeaturesEnabled } from "@/components/settings/usePaidEnterpriseFeaturesEnabled";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SetCreationPopupProps {
  ccPairs: ConnectorIndexingStatus<any, any>[];
  teamspaces: Teamspace[] | undefined;
  onClose: () => void;
  existingDocumentSet?: DocumentSet;
}

export const DocumentSetCreationForm = ({
  ccPairs,
  teamspaces,
  onClose,
  existingDocumentSet,
}: SetCreationPopupProps) => {
  const { toast } = useToast();

  const isPaidEnterpriseFeaturesEnabled = usePaidEnterpriseFeaturesEnabled();

  const isUpdate = existingDocumentSet !== undefined;

  return (
    <div>
      <Formik
        initialValues={{
          name: existingDocumentSet ? existingDocumentSet.name : "",
          description: existingDocumentSet
            ? existingDocumentSet.description
            : "",
          cc_pair_ids: existingDocumentSet
            ? existingDocumentSet.cc_pair_descriptors.map(
                (ccPairDescriptor) => {
                  return ccPairDescriptor.id;
                }
              )
            : ([] as number[]),
          is_public: existingDocumentSet ? existingDocumentSet.is_public : true,
          users: existingDocumentSet ? existingDocumentSet.users : [],
          groups: existingDocumentSet ? existingDocumentSet.groups : [],
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().required("Please enter a name for the set"),
          description: Yup.string().required(
            "Please enter a description for the set"
          ),
          cc_pair_ids: Yup.array()
            .of(Yup.number().required())
            .required("Please select at least one connector"),
        })}
        onSubmit={async (values, formikHelpers) => {
          formikHelpers.setSubmitting(true);
          // If the document set is public, then we don't want to send any groups
          const processedValues = {
            ...values,
            groups: values.is_public ? [] : values.groups,
          };

          let response;
          if (isUpdate) {
            response = await updateDocumentSet({
              id: existingDocumentSet.id,
              ...processedValues,
            });
          } else {
            response = await createDocumentSet(processedValues);
          }
          formikHelpers.setSubmitting(false);
          if (response.ok) {
            toast({
              title: isUpdate ? "Update Successful" : "Creation Successful",
              description: isUpdate
                ? "Successfully updated document set!"
                : "Successfully created document set!",
              variant: "success",
            });
            onClose();
          } else {
            const errorMsg = await response.text();
            toast({
              title: "Error",
              description: isUpdate
                ? `Error updating document set - ${errorMsg}`
                : `Error creating document set - ${errorMsg}`,
              variant: "destructive",
            });
          }
        }}
      >
        {({ isSubmitting, values }) => (
          <Form>
            <TextFormField
              name="name"
              label="Name:"
              placeholder="A name for the document set"
              disabled={isUpdate}
              autoCompleteDisabled={true}
            />
            <TextFormField
              name="description"
              label="Description:"
              placeholder="Describe what the document set represents"
              autoCompleteDisabled={true}
            />

            <h2 className="pt-6 pb-1 font-medium">Pick your connectors:</h2>
            <p className="pb-3 text-xs text-subtle">
              All documents indexed by the selected connectors will be a part of
              this document set.
            </p>
            <FieldArray
              name="cc_pair_ids"
              render={(arrayHelpers: ArrayHelpers) => (
                <div className="mb-3 flex gap-2 flex-wrap">
                  {ccPairs.map((ccPair) => {
                    const ind = values.cc_pair_ids.indexOf(ccPair.cc_pair_id);
                    let isSelected = ind !== -1;
                    return (
                      <Badge
                        key={`${ccPair.connector.id}-${ccPair.credential.id}`}
                        onClick={() => {
                          if (isSelected) {
                            arrayHelpers.remove(ind);
                          } else {
                            arrayHelpers.push(ccPair.cc_pair_id);
                          }
                        }}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer py-1.5 hover:opacity-80 ${
                          isSelected ? "text-white" : ""
                        }`}
                      >
                        <div className="my-auto">
                          <ConnectorTitle
                            connector={ccPair.connector}
                            ccPairId={ccPair.cc_pair_id}
                            ccPairName={ccPair.name}
                            isLink={false}
                            showMetadata={false}
                          />
                        </div>
                      </Badge>
                    );
                  })}
                </div>
              )}
            />

            {isPaidEnterpriseFeaturesEnabled &&
              teamspaces &&
              teamspaces.length > 0 && (
                <div>
                  <Divider />

                  <BooleanFormField
                    name="is_public"
                    label="Is Public?"
                    subtext={
                      <>
                        If the document set is public, then it will be visible
                        to <b>all users</b>. If it is not public, then only
                        users in the specified teams will be able to see it.
                      </>
                    }
                  />

                  <Divider />
                  <h2 className="mb-1 font-medium text-base">
                    Teams with Access
                  </h2>
                  {!values.is_public ? (
                    <>
                      <Text className="mb-3">
                        If any teams are specified, then this Document Set will
                        only be visible to the specified groups. If no groups
                        are specified, then the Document Set will be visible to
                        all users.
                      </Text>
                      <FieldArray
                        name="teams"
                        render={(arrayHelpers: ArrayHelpers) => (
                          <div className="flex gap-2 flex-wrap">
                            {teamspaces.map((teamspace) => {
                              const ind = values.groups.indexOf(teamspace.id);
                              let isSelected = ind !== -1;
                              return (
                                <div
                                  key={teamspace.id}
                                  className={
                                    `
                              px-3 
                              py-1
                              rounded-regular 
                              border
                              border-border 
                              w-fit 
                              flex 
                              cursor-pointer ` +
                                    (isSelected
                                      ? " bg-background-strong"
                                      : " hover:bg-hover")
                                  }
                                  onClick={() => {
                                    if (isSelected) {
                                      arrayHelpers.remove(ind);
                                    } else {
                                      arrayHelpers.push(teamspace.id);
                                    }
                                  }}
                                >
                                  <div className="my-auto flex">
                                    <FiUsers className="my-auto mr-2" />{" "}
                                    {teamspace.name}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      />
                    </>
                  ) : (
                    <Text>
                      This Document Set is public, so this does not apply. If
                      you want to control which teamspaces see this Document
                      Set, mark it as non-public!
                    </Text>
                  )}
                </div>
              )}
            <div className="flex mt-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-64 mx-auto"
              >
                {isUpdate ? "Update" : "Create"}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};
