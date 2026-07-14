import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./components/RequireRole";
import { AccountSettings } from "./components/AccountSettings";
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
import { UserProfilePage } from "./pages/admin/users/UserProfilePage";
import { CoursesPage } from "./pages/admin/courses/CoursesPage";
import { CourseDetail } from "./pages/admin/courses/CourseDetail";
import { TemplatesPage } from "./pages/admin/templates/TemplatesPage";
import { AiMonitoringPage } from "./pages/admin/ai/AiMonitoringPage";
import { AuditPage } from "./pages/admin/audit/AuditPage";
import { AdminTasksPage } from "./pages/admin/tasks/AdminTasksPage";
import { TeachShell } from "./pages/teach/TeachShell";
import { TeachDashboard } from "./pages/teach/TeachDashboard";
import { TeachTasksPage } from "./pages/teach/TeachTasksPage";
import { TeachCoursesPage } from "./pages/teach/TeachCoursesPage";
import { TeachGroupsPage } from "./pages/teach/TeachGroupsPage";
import { StudentDetailPage } from "./pages/teach/StudentDetailPage";
import { TeacherCourseShell } from "./pages/teach/course/TeacherCourseShell";
import { TopicsTab } from "./pages/teach/course/TopicsTab";
import { CourseGroupsTab } from "./pages/teach/course/CourseGroupsTab";
import { SyllabusTab } from "./pages/teach/course/SyllabusTab";
import { GroupProfile } from "./pages/teach/group/GroupProfile";
import { ProgressTab } from "./pages/teach/course/ProgressTab";
import { SettingsTab } from "./pages/teach/course/SettingsTab";
import { TopicConstructor } from "./pages/teach/topics/TopicConstructor";
import { ContentEditor } from "./pages/teach/content/ContentEditor";
import { CaseReviewQueue } from "./pages/teach/CaseReviewQueue";
import { StudentShell } from "./pages/student/StudentShell";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentTasksPage } from "./pages/student/StudentTasksPage";
import { CoursePath } from "./pages/student/CoursePath";
import { LessonPage } from "./pages/student/lesson/LessonPage";
import { AttendancePage } from "./pages/student/AttendancePage";
import { ProfilePage } from "./pages/student/ProfilePage";

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
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="tasks" element={<AdminTasksPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="ai" element={<AiMonitoringPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<AccountSettings />} />
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
        <Route path="tasks" element={<TeachTasksPage />} />
        <Route path="courses" element={<TeachCoursesPage />} />
        <Route path="groups" element={<TeachGroupsPage />} />
        <Route path="groups/:id" element={<GroupProfile />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="courses/:id" element={<TeacherCourseShell />}>
          <Route index element={<Navigate to="topics" replace />} />
          <Route path="topics" element={<TopicsTab />} />
          <Route path="syllabus" element={<SyllabusTab />} />
          <Route path="groups" element={<CourseGroupsTab />} />
          {/* Attendance moved to the group profile; old links land on topics. */}
          <Route path="sessions" element={<Navigate to="../topics" replace />} />
          <Route path="progress" element={<ProgressTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>
        {/* Topic constructor — separate page, NOT inside the course shell */}
        <Route path="topics/:id" element={<TopicConstructor />} />
        <Route path="content/:id" element={<ContentEditor />} />
        <Route path="cases/review" element={<CaseReviewQueue />} />
        <Route path="settings" element={<AccountSettings />} />
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
        <Route path="tasks" element={<StudentTasksPage />} />
        <Route path="courses/:id" element={<CoursePath />} />
        <Route path="topics/:id" element={<LessonPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
