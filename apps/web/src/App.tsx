import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./components/RequireRole";
import { RoleRedirect } from "./pages/RoleRedirect";
import { Login } from "./pages/Login";
import { AdminShell } from "./pages/admin/AdminShell";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StructureLayout } from "./pages/admin/structure/StructureLayout";
import { FacultiesTab } from "./pages/admin/structure/FacultiesTab";
import { DepartmentsTab } from "./pages/admin/structure/DepartmentsTab";
import { SubjectsTab } from "./pages/admin/structure/SubjectsTab";
import { GroupsTab } from "./pages/admin/structure/GroupsTab";
import { TeachShell } from "./pages/teach/TeachShell";
import { TeachDashboard } from "./pages/teach/TeachDashboard";
import { StudentShell } from "./pages/student/StudentShell";
import { StudentDashboard } from "./pages/student/StudentDashboard";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireRole roles={["admin"]}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="structure" element={<StructureLayout />}>
          <Route index element={<Navigate to="faculties" replace />} />
          <Route path="faculties" element={<FacultiesTab />} />
          <Route path="departments" element={<DepartmentsTab />} />
          <Route path="subjects" element={<SubjectsTab />} />
          <Route path="groups" element={<GroupsTab />} />
        </Route>
      </Route>

      <Route
        path="/teach"
        element={
          <RequireRole roles={["teacher"]}>
            <TeachShell />
          </RequireRole>
        }
      >
        <Route index element={<TeachDashboard />} />
      </Route>

      <Route
        path="/app"
        element={
          <RequireRole roles={["student"]}>
            <StudentShell />
          </RequireRole>
        }
      >
        <Route index element={<StudentDashboard />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
