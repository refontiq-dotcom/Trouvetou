"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "trouvetou:traffic:";
const ENDPOINT = "/api/traffic";

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export function TrafficTracker() {
  useEffect(() => {
    const day = utcDay();
    const key = `${STORAGE_PREFIX}${day}`;
    const alreadyCountedUnique = window.localStorage.getItem(key) === "1";

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visits: 1,
        unique_visitors: alreadyCountedUnique ? 0 : 1,
      }),
      keepalive: true,
    })
      .then(() => {
        if (!alreadyCountedUnique) {
          window.localStorage.setItem(key, "1");
        }
      })
      .catch(() => {
        // Le suivi ne doit jamais bloquer ni modifier l'expérience utilisateur.
      });
  }, []);

  return null;
}
