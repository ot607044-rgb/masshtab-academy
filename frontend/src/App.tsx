import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SupportProvider } from "./context/SupportContext";
import { useSupport } from "./context/SupportContext";
import GettingStartedPage from "./pages/GettingStartedPage";
import { guideKey, hasSeenGuide, workPath } from "./pages/gettingStartedContent";
import LoginPage from "./pages/LoginPage";
import InvitePage from "./pages/InvitePage";
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
import TestEditorPage from "./pages/TestEditorPage";
import TestTakePage from "./pages/TestTakePage";
import MyTestsPage from "./pages/MyTestsPage";
import SupportRequestsPage from "./pages/SupportRequestsPage";
import QualificationPage from "./pages/QualificationPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import CustomSectionPage from "./pages/CustomSectionPage";
import ProtectedRoute from "./components/ProtectedRoute";
import WorkspacePage from "./pages/WorkspacePage";
import RecruitmentPage from "./pages/RecruitmentPage";
import CalendarPage from "./pages/CalendarPage";
import PublicBookingPage from "./pages/PublicBookingPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import { LearningPage, MaterialsPage, OrganizationPage } from "./pages/AcademySections";

const HR_ROLES = ["company_admin", "hr", "super_admin"] as const;
const ADMIN_ROLES = ["company_admin", "super_admin"] as const;
const CONTENT_ROLES = [...HR_ROLES, "methodologist"] as const;
const HomeRedirect: React.FC = () => {
  const { user } = useAuth();
  const { session } = useSupport();
  const destination = user && hasSeenGuide(guideKey(user, session?.company_id)) ? workPath(user.role) : "start";
  return <Navigate to={`/dashboard/${destination}`} replace />;
};

const COMPANY_ROLES = ["company_admin", "hr", "department_head", "methodologist", "employee"] as const;

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="app-loading">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.role === "super_admin" ? "/super-admin" : "/dashboard"}
      replace
    />
  );
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/book/:token" element={<PublicBookingPage />} />
    <Route path="/invite/:token" element={<InvitePage />} />
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
        <ProtectedRoute allowedRoles={[...COMPANY_ROLES, "super_admin"]}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<HomeRedirect />} />
      <Route path="start" element={<GettingStartedPage />} />
      <Route path="workspace" element={<ProtectedRoute allowedRoles={[...HR_ROLES]}><WorkspacePage /></ProtectedRoute>} />
      <Route path="recruitment" element={<ProtectedRoute allowedRoles={[...HR_ROLES]}><RecruitmentPage /></ProtectedRoute>} />
      <Route path="calendar" element={<ProtectedRoute allowedRoles={[...HR_ROLES]}><CalendarPage /></ProtectedRoute>} />
      <Route path="employees/:id" element={<EmployeeDetailPage />} />
      <Route path="learning" element={<LearningPage />} />
      <Route path="materials" element={<ProtectedRoute allowedRoles={[...HR_ROLES, "methodologist"]}><MaterialsPage /></ProtectedRoute>} />
      <Route path="organization" element={<ProtectedRoute allowedRoles={[...HR_ROLES, "department_head"]}><OrganizationPage /></ProtectedRoute>} />
      <Route path="hr-dashboard" element={<ProtectedRoute allowedRoles={[...HR_ROLES]}><QualificationPage /></ProtectedRoute>} />
      <Route path="my-department"    element={<ProtectedRoute allowedRoles={["department_head"]}><ManagerDashboardPage /></ProtectedRoute>} />
      <Route path="employees"        element={<ProtectedRoute allowedRoles={[...HR_ROLES, "department_head"]}><EmployeesPage /></ProtectedRoute>} />
      <Route path="departments"      element={<ProtectedRoute allowedRoles={[...HR_ROLES, "department_head"]}><DepartmentsPage /></ProtectedRoute>} />
      <Route path="positions"        element={<ProtectedRoute allowedRoles={[...HR_ROLES, "department_head"]}><PositionsPage /></ProtectedRoute>} />
      <Route path="knowledge"        element={<ProtectedRoute allowedRoles={[...CONTENT_ROLES]}><KnowledgePage /></ProtectedRoute>} />
      <Route path="lessons"          element={<LessonsPage />} />
      <Route path="lessons/:id"      element={<LessonDetailPage />} />
      <Route path="tests"            element={<TestsPage />} />
      <Route path="tests/new"        element={<ProtectedRoute allowedRoles={[...HR_ROLES, "methodologist"]}><TestEditorPage /></ProtectedRoute>} />
      <Route path="tests/:id"        element={<TestEditorPage />} />
      <Route path="tests/:id/take"   element={<TestTakePage />} />
      <Route path="my-lessons"       element={<MyLessonsPage />} />
      <Route path="my-tests"         element={<MyTestsPage />} />
      <Route path="support-requests" element={<ProtectedRoute allowedRoles={["company_admin"]}><SupportRequestsPage /></ProtectedRoute>} />
      <Route path="settings"         element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES]}><SettingsPage /></ProtectedRoute>} />
      <Route path="sections/:slug"   element={<CustomSectionPage />} />
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
