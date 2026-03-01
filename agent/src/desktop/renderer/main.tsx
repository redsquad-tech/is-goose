import React from "react";
import { createRoot } from "react-dom/client";
import { DesktopApp } from "./ui/desktopApp.js";
import "./ui/styles/main.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root container");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <DesktopApp desktopApi={window.desktopApi} />
  </React.StrictMode>,
);
