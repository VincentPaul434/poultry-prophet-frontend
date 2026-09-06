"use client";

import { useEffect } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api-client";
import { getToken } from "@/lib/auth-storage";

function sockJsUrl() {
  const url = new URL(API_BASE_URL);
  url.pathname = `${url.pathname.replace(/\/api\/?$/, "")}/ws`;
  return url.toString();
}

export function useInterventionRealtime(farmId: number | null | undefined, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || farmId == null || typeof window === "undefined") return;
    const token = getToken();
    if (!token || typeof WebSocket === "undefined") return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(sockJsUrl()),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/farms/${farmId}/interventions`, invalidate);
      },
    });

    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [enabled, farmId, queryClient]);
}
