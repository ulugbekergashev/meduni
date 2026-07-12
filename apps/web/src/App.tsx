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
import { UsersPage } from "./pages/admin/users/UsersPage";
import { CoursesPage } from "./pages/admin/courses/CoursesPage";
import { CourseDetail } from "./pages/admin/courses/CourseDetail";
import { TeachShell } from "./pages/teach/TeachShell";
import { TeachDashboard } from "./pages/teach/TeachDashboard";
import { TeacherCourseShell } from "./pages/teach/course/TeacherCourseShell";
import { TopicsTab } from "./pages/teach/course/TopicsTab";
import { SessionsTab } from "./pages/teach/course/SessionsTab";
import { ProgressTab } from "./pages/teach/course/ProgressTab";
import { SettingsTab } from "./pages/teach/course/SettingsTab";
import { TopicConstructor } from "./pages/teach/topics/TopicConstructor";
import { ContentEditor } from "./pages/teach/content/ContentEditor";
import { StudentShell } from "./pages/student/StudentShell";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { CoursePath } from "./pages/student/CoursePath";
import { LessonPage } from "./pages/student/lesson/LessonPage";

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
        <Route path="users" element={<UsersPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetail />} />
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
        <Route path="courses/:id" element={<TeacherCourseShell />}>
          <Route index element={<Navigate to="topics" replace />} />
          <Route path="topics" element={<TopicsTab />} />
          <Route path="sessions" element={<SessionsTab />} />
          <Route path="progress" element={<ProgressTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>
        {/* Topic constructor — separate page, NOT inside the course shell */}
        <Route path="topics/:id" element={<TopicConstructor />} />
        <Route path="content/:id" element={<ContentEditor />} />
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
        <Route path="courses/:id" element={<CoursePath />} />
        <Route path="topics/:id" element={<LessonPage />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
