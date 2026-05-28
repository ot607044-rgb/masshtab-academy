import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SupportProvider } from "./context/SupportContext";
import LoginPage from "./pages/LoginPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import DashboardLayout from "./components/DashboardLayout";
import EmployeesPage from "./pages/EmployeesPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import PositionsPage from "./pages/PositionsPage";
import KnowledgePage from "./pages/KnowledgePage";
import LessonsPage from "./pages/LessonsPage";
import LessonDetailPage from "./pages/LessonDetailPage";
import MyLessonsPage from "./pages/MyLessonsPage";
import TestsPage from "./pages/TestsPage";
import TestDetailPage from "./pages/TestDetailPage";
import TestTakePage from "./pages/TestTakePage";
import MyTestsPage from "./pages/MyTestsPage";
import SupportRequestsPage from "./pages/SupportRequestsPage";
import ProtectedRoute from "./components/ProtectedRoute";

const COMPANY_ROLES = ["company_admin", "hr", "department_head", "methodologist", "employee"] as const;

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="app-loading">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.role === "super_admin" ? "/super-admin" : "/dashboard/employees"}
      replace
    />
  );
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<RootRedirect />} />

    {/* Super Admin */}
    <Route
      path="/super-admin"
      element={
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      }
    />

    {/* Company users — layout with sidebar */}
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="employees" replace />} />
      <Route path="employees"        element={<EmployeesPage />} />
      <Route path="departments"      element={<DepartmentsPage />} />
      <Route path="positions"        element={<PositionsPage />} />
      <Route path="knowledge"        element={<KnowledgePage />} />
      <Route path="lessons"          element={<LessonsPage />} />
      <Route path="lessons/:id"      element={<LessonDetailPage />} />
      <Route path="tests"            element={<TestsPage />} />
      <Route path="tests/:id"        element={<TestDetailPage />} />
      <Route path="tests/:id/take"   element={<TestTakePage />} />
      <Route path="my-lessons"       element={<MyLessonsPage />} />
      <Route path="my-tests"         element={<MyTestsPage />} />
      <Route path="support-requests" element={<SupportRequestsPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <SupportProvider>
        <AppRoutes />
      </SupportProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
