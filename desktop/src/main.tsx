import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { ConfirmationProvider } from "./app/components/ui/Confirmation";
import "@fontsource-variable/urbanist/wght.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "./app/styles/index.css";
import "./app/styles/tokens.css";
import "./app/styles/controls.css";
import "./app/styles/shell.css";
import "./app/styles/updates.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmationProvider><App /></ConfirmationProvider>
  </React.StrictMode>
);
