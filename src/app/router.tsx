import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/app/shell";
import { EditorPage } from "@/app/pages/editor";
import { PlaceholderPage } from "@/app/pages/placeholder";
import { RequireAuth } from "@/features/auth/require-auth";

// Secondary pages load on demand; the editor (landing page) ships in the main bundle.
const InvoicesPage = lazy(() => import("@/features/invoices/invoices-page").then((m) => ({ default: m.InvoicesPage })));
const TemplatesPage = lazy(() => import("@/features/templates/templates-page").then((m) => ({ default: m.TemplatesPage })));
const ClientsPage = lazy(() => import("@/features/clients/clients-page").then((m) => ({ default: m.ClientsPage })));
const SettingsPage = lazy(() => import("@/features/settings/settings-page").then((m) => ({ default: m.SettingsPage })));

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <EditorPage /> },
      {
        path: "invoices",
        element: (
          <RequireAuth title="invoices" reason="save and manage your invoices">
            <InvoicesPage />
          </RequireAuth>
        ),
      },
      {
        path: "invoices/:id",
        element: (
          <RequireAuth title="invoices" reason="open saved invoices">
            <EditorPage />
          </RequireAuth>
        ),
      },
      {
        path: "templates",
        element: (
          <RequireAuth title="templates" reason="save templates and make quick invoices">
            <TemplatesPage />
          </RequireAuth>
        ),
      },
      {
        path: "clients",
        element: (
          <RequireAuth title="clients" reason="keep a list of saved clients">
            <ClientsPage />
          </RequireAuth>
        ),
      },
      {
        path: "settings",
        element: (
          <RequireAuth title="settings" reason="set your business profile and defaults">
            <SettingsPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <PlaceholderPage title="404" note="This page doesn't exist." /> },
    ],
  },
]);
