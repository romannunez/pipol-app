import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";

// Add comprehensive error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the default browser behavior which would print to console
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  event.preventDefault();
});

// Add AbortController signal handling
window.addEventListener('beforeunload', () => {
  // Clean up any pending requests or connections
  if ((window as any).simpleChatService) {
    (window as any).simpleChatService.disconnect();
  }
});

// Create root and render app
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error("Root element not found");
}
