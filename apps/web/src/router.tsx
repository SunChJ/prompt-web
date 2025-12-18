import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ExplorePage } from "./views/ExplorePage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/explore" replace /> },
  { path: "/explore", element: <ExplorePage /> }
]);


