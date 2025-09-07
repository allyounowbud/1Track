// src/main.jsx
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Hub from "./routes/Hub.jsx";                 // Main hub (dashboard)
import Login from "./routes/Login.jsx";
import QuickAdd from "./routes/QuickAdd.jsx";       // Renamed from Dashboard.jsx
import Settings from "./routes/Settings.jsx";
import MarkSold from "./routes/MarkSold.jsx";
import Inventory from "./routes/Inventory.jsx";
import Stats from "./routes/Stats.jsx";
import OrderBook from "./routes/OrderBook.jsx";
import Automation from "./routes/Automation.jsx";
import Emails from "./routes/Emails.jsx";           // <-- NEW

const router = createBrowserRouter([
  { path: "/", element: <Hub /> },                 // Hub is now the root
  { path: "/login", element: <Login /> },
  { path: "/add", element: <QuickAdd /> },         // Quick Add lives at /add
  { path: "/orders", element: <OrderBook /> },
  { path: "/sold", element: <MarkSold /> },
  { path: "/inventory", element: <Inventory /> },
  { path: "/stats", element: <Stats /> },
  { path: "/settings", element: <Settings /> },
  { path: "/automation", element: <Automation /> },
  { path: "/emails", element: <Emails /> },        // <-- NEW ROUTE

  // Legacy + fallback routes
  { path: "/app", element: <Navigate to="/add" replace /> }, // old Quick Add path
  { path: "*", element: <Navigate to="/add" replace /> },
]);

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
