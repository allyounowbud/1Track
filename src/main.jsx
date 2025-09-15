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
import Database from "./routes/Database.jsx";
import MarkSold from "./routes/MarkSold.jsx";
import Inventory from "./routes/Inventory.jsx";
import Stats from "./routes/Stats.jsx";
import OrderBook from "./routes/OrderBook.jsx";
import Emails from "./routes/Emails.jsx";           // <-- NEW
import Shipments from "./routes/Shipments.jsx";     // <-- NEW
import Profiles from "./routes/Profiles.jsx";       // <-- NEW
import Admin from "./routes/Admin.jsx";             // <-- NEW ADMIN ROUTE
import AuthGuard from "./routes/AuthGuard.jsx";     // <-- RENAMED
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ErrorElement from "./components/ErrorElement.jsx";

const router = createBrowserRouter([
  { 
    path: "/", 
    element: <Hub />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/login", 
    element: <Login />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/add", 
    element: <QuickAdd />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/orders", 
    element: <OrderBook />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/sold", 
    element: <MarkSold />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/inventory", 
    element: <Inventory />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/stats", 
    element: <Stats />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/database", 
    element: <Navigate to="/database/products" replace />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/database/products", 
    element: <Database />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/database/retailers", 
    element: <Database />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/database/marketplaces", 
    element: <Database />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/emails", 
    element: <Emails />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/shipments", 
    element: <Shipments />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/profiles", 
    element: <Profiles />,
    errorElement: <ErrorElement />
  },
  { 
    path: "/admin", 
    element: <Admin />,
    errorElement: <ErrorElement />
  },

  // Legacy + fallback routes
  { 
    path: "/app", 
    element: <Navigate to="/add" replace />,
    errorElement: <ErrorElement />
  },
  { 
    path: "*", 
    element: <Navigate to="/add" replace />,
    errorElement: <ErrorElement />
  },
]);

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
