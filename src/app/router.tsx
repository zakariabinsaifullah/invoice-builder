import { createBrowserRouter } from "react-router";
import { AppShell } from "@/app/shell";
import { EditorPage } from "@/app/pages/editor";
import { PlaceholderPage } from "@/app/pages/placeholder";
import { RequireAuth } from "@/features/auth/require-auth";
import { InvoicesPage } from "@/features/invoices/invoices-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TemplatesPage } from "@/features/templates/templates-page";

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
            <PlaceholderPage title="clients" note="Saved clients for one-click billing." />
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
