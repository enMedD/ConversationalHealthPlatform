"use client";

import { DeleteButton } from "@/components/DeleteButton";
import { deleteTokenRateLimit, updateTokenRateLimit } from "./lib";
import { ThreeDotsLoader } from "@/components/Loading";
import { TokenRateLimitDisplay } from "./types";
import { errorHandlingFetcher } from "@/lib/fetcher";
import useSWR, { mutate } from "swr";
import { CustomCheckbox } from "@/components/CustomCheckbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TokenRateLimitTableArgs = {
  tokenRateLimits: TokenRateLimitDisplay[];
  title?: string;
  description?: string;
  fetchUrl: string;
  hideHeading?: boolean;
};

export const TokenRateLimitTable = ({
  tokenRateLimits,
  title,
  description,
  fetchUrl,
  hideHeading,
}: TokenRateLimitTableArgs) => {
  const shouldRenderGroupName = () =>
    tokenRateLimits.length > 0 && tokenRateLimits[0].group_name !== undefined;

  const handleEnabledChange = (id: number) => {
    const tokenRateLimit = tokenRateLimits.find(
      (tokenRateLimit) => tokenRateLimit.token_id === id
    );

    if (!tokenRateLimit) {
      return;
    }

    updateTokenRateLimit(id, {
      token_budget: tokenRateLimit.token_budget,
      period_hours: tokenRateLimit.period_hours,
      enabled: !tokenRateLimit.enabled,
    }).then(() => {
      mutate(fetchUrl);
    });
  };

  const handleDelete = (id: number) =>
    deleteTokenRateLimit(id).then(() => {
      mutate(fetchUrl);
    });

  if (tokenRateLimits.length === 0) {
    return (
      <div>
        {!hideHeading && title && <h3>{title}</h3>}
        {!hideHeading && description && <p className="my-2">{description}</p>}
        <p className={`${!hideHeading && "my-8"}`}>No token rate limits set!</p>
      </div>
    );
  }

  return (
    <div>
      {!hideHeading && title && <h3>{title}</h3>}
      {!hideHeading && description && <p className="my-2">{description}</p>}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enabled</TableHead>
                {shouldRenderGroupName() && <TableHead>Group Name</TableHead>}
                <TableHead>Time Window (Hours)</TableHead>
                <TableHead>Token Budget (Thousands)</TableHead>
                <TableHead>Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokenRateLimits.map((tokenRateLimit) => {
                return (
                  <TableRow key={tokenRateLimit.token_id}>
                    <TableCell>
                      <Button
                        onClick={() =>
                          handleEnabledChange(tokenRateLimit.token_id)
                        }
                        variant="ghost"
                        className="w-[120px]"
                      >
                        <CustomCheckbox checked={tokenRateLimit.enabled} />
                        <p className="ml-2">
                          {tokenRateLimit.enabled ? "Enabled" : "Disabled"}
                        </p>
                      </Button>
                    </TableCell>
                    {shouldRenderGroupName() && (
                      <TableCell className="font-bold ">
                        {tokenRateLimit.group_name}
                      </TableCell>
                    )}
                    <TableCell>{tokenRateLimit.period_hours}</TableCell>
                    <TableCell>{tokenRateLimit.token_budget}</TableCell>
                    <TableCell>
                      <DeleteButton
                        onClick={() => handleDelete(tokenRateLimit.token_id)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export const GenericTokenRateLimitTable = ({
  fetchUrl,
  title,
  description,
  hideHeading,
  responseMapper,
}: {
  fetchUrl: string;
  title?: string;
  description?: string;
  hideHeading?: boolean;
  responseMapper?: (data: any) => TokenRateLimitDisplay[];
}) => {
  const { data, isLoading, error } = useSWR(fetchUrl, errorHandlingFetcher);

  if (isLoading) {
    return <ThreeDotsLoader />;
  }

  if (!isLoading && error) {
    return <p>Failed to load token rate limits</p>;
  }

  let processedData = data;
  if (responseMapper) {
    processedData = responseMapper(data);
  }

  return (
    <TokenRateLimitTable
      tokenRateLimits={processedData}
      fetchUrl={fetchUrl}
      title={title}
      description={description}
      hideHeading={hideHeading}
    />
  );
};
