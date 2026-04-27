import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { AccentProvider } from "./contexts/AccentContext";
import { queryClient } from "./lib/queryClient";
import Router from "./Router";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AccentProvider>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </AccentProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
