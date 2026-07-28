import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@meduni/ui";
import { App } from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import { queryClient } from "./lib/queryClient";
import "./lib/i18n";
import "./index.css";

// Apply the saved/OS theme before first paint (avoids a flash).
applyTheme(getTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
