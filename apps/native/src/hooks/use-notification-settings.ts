import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

export type NotificationField =
  | "buySignal"
  | "sellSignal"
  | "holdSignal"
  | "priceAlert"
  | "breakingNews"
  | "marketSummary";

const DEFAULTS: Record<NotificationField, boolean> = {
  buySignal: true,
  sellSignal: true,
  holdSignal: false,
  priceAlert: true,
  breakingNews: true,
  marketSummary: false,
};

/**
 * Loads the current user's notification settings (oRPC) and persists toggles.
 * A small local overlay gives instant switch feedback before the server
 * responds; on error it clears so values fall back to the server truth.
 */
export function useNotificationSettings() {
  const query = useQuery(orpc.notification.getSettings.queryOptions());
  const [pending, setPending] = useState<
    Partial<Record<NotificationField, boolean>>
  >({});

  const mutation = useMutation(
    orpc.notification.updateSettings.mutationOptions({
      onSuccess: () => query.refetch(),
      onError: () => setPending({}),
    })
  );

  const get = (field: NotificationField): boolean =>
    pending[field] ?? query.data?.[field] ?? DEFAULTS[field];

  const toggle = (field: NotificationField, value: boolean) => {
    setPending((p) => ({ ...p, [field]: value }));
    mutation.mutate({ [field]: value });
  };

  return { get, toggle, isLoading: query.isLoading };
}
