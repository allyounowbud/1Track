// src/main.jsx
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./routes/App.jsx";
import Login from "./routes/Login.jsx";
import Dashboard from "./routes/Dashboard.jsx";
import Settings from "./routes/Settings.jsx";
import MarkSold from "./routes/MarkSold.jsx"; // <-- NEW

const router = createBrowserRouter([
  { path: "/", element: <App /> },           // your auth gate/landing
  { path: "/login", element: <Login /> },
  { path: "/app", element: <Dashboard /> },  // Quick Add
  { path: "/sold", element: <MarkSold /> },  // <-- NEW route
  { path: "/settings", element: <Settings /> },
  { path: "*", element: <Navigate to="/app" replace /> }, // fallback
]);

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);