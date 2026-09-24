"use client";

import { useEffect } from "react";
import { Client, type IStompSocket, type StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL } from "@/lib/api-client";
import { getToken } from "@/lib/auth-storage";
import { qk } from "@/lib/query-keys";
import type { AlertEvent, Indicator } from "@/lib/types";

function websocketUrl() {
  return API_BASE_URL.replace(/\/api\/?$/, "/ws");
}

/** Subscribes to the authenticated user's farm topics and keeps polling as a fallback. */
export function useFarmRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.farmId) return;
    const token = getToken();
    if (!token) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl()) as unknown as IStompSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5_000,
      onConnect: () => {
        const subscriptions: StompSubscription[] = [];
        const farmPrefix = `/topic/farms/${user.farmId}`;

        subscriptions.push(
          client.subscribe(`${farmPrefix}/alerts`, (message) => {
            let event: AlertEvent;
            try {
              event = JSON.parse(message.body) as AlertEvent;
            } catch {
              return;
            }

            queryClient.invalidateQueries({ queryKey: ["alerts", "farm"] });
            queryClient.invalidateQueries({ queryKey: qk.batches.all });
            queryClient.invalidateQueries({ queryKey: qk.batches.detail(event.batchId) });

            if (
              user.role === "MANAGER" &&
              (event.indicatorType === "HEALTH_DEATH" || event.indicatorType === "MORTALITY")
            ) {
              const count = event.deathCount ?? 0;
              const label = `${count} bird${count === 1 ? "" : "s"} died`;
              const description = [event.batchName, event.handlerName, event.cause]
                .filter(Boolean)
                .join(" · ");
              const notify = event.severity === "CRITICAL" ? toast.error : toast.warning;
              notify(description ? `${label} · ${description}` : label);
            }
          })
        );

        subscriptions.push(
          client.subscribe(`${farmPrefix}/indicators`, (message) => {
            let indicator: Indicator;
            try {
              indicator = JSON.parse(message.body) as Indicator;
            } catch {
              return;
            }
            queryClient.invalidateQueries({ queryKey: qk.batches.all });
            queryClient.invalidateQueries({ queryKey: qk.batches.detail(indicator.batchId) });
          })
        );

        client.onDisconnect = () => {
          subscriptions.forEach((subscription) => subscription.unsubscribe());
        };
      },
    });

    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [queryClient, user?.email, user?.farmId, user?.role]);
}
