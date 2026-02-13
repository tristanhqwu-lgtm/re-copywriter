import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Workbench from "./pages/Workbench";
import StyleLibrary from "./pages/StyleLibrary";
import ProductLibrary from "./pages/ProductLibrary";
import SceneLibrary from "./pages/SceneLibrary";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Workbench />} />
          <Route path="styles" element={<StyleLibrary />} />
          <Route path="products" element={<ProductLibrary />} />
          <Route path="scenes" element={<SceneLibrary />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
