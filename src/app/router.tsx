import { createBrowserRouter } from "react-router";
import { AppShell } from "@/app/shell";
import { EditorPage } from "@/app/pages/editor";
import { PlaceholderPage } from "@/app/pages/placeholder";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <EditorPage /> },
      { path: "invoices", element: <PlaceholderPage title="invoices" note="Saved invoices with status, search and bulk actions." /> },
      { path: "templates", element: <PlaceholderPage title="templates" note="Reusable templates — save once, invoice in seconds." /> },
      { path: "clients", element: <PlaceholderPage title="clients" note="Saved clients for one-click billing." /> },
      { path: "settings", element: <PlaceholderPage title="settings" note="Business profile, defaults and numbering." /> },
      { path: "*", element: <PlaceholderPage title="404" note="This page doesn't exist." /> },
    ],
  },
]);
