import { Routes, Route, Navigate } from "react-router-dom";
import { RequireRole } from "./components/RequireRole";
import { AccountSettings } from "./components/AccountSettings";
import { RoleRedirect } from "./pages/RoleRedirect";
import { Login } from "./pages/Login";
import { AdminShell } from "./pages/admin/AdminShell";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StructurePage } from "./pages/admin/structure/StructurePage";
import { FacultyPage } from "./pages/admin/structure/FacultyPage";
import { DepartmentPage } from "./pages/admin/structure/DepartmentPage";
import { AdminGroupProfile } from "./pages/admin/groups/AdminGroupProfile";
import { StudentsPage } from "./pages/admin/students/StudentsPage";
import { UserProfilePage } from "./pages/admin/users/UserProfilePage";
import { CoursesPage } from "./pages/admin/courses/CoursesPage";
import { CourseDetail } from "./pages/admin/courses/CourseDetail";
import { AiMonitoringPage } from "./pages/admin/ai/AiMonitoringPage";
import { AuditPage } from "./pages/admin/audit/AuditPage";
import { AdminTasksPage } from "./pages/admin/tasks/AdminTasksPage";
import { TeachShell } from "./pages/teach/TeachShell";
import { TeachDashboard } from "./pages/teach/TeachDashboard";
import { TeachCoursesPage } from "./pages/teach/TeachCoursesPage";
import { TeachGroupsPage } from "./pages/teach/TeachGroupsPage";
import { StudentDetailPage } from "./pages/teach/StudentDetailPage";
import { TeacherCourseShell } from "./pages/teach/course/TeacherCourseShell";
import { TopicsTab } from "./pages/teach/course/TopicsTab";
import { CourseGroupsTab } from "./pages/teach/course/CourseGroupsTab";
import { SyllabusTab } from "./pages/teach/course/SyllabusTab";
import { GroupProfile } from "./pages/teach/group/GroupProfile";
import { ProgressTab } from "./pages/teach/course/ProgressTab";
import { MistakesTab } from "./pages/teach/course/MistakesTab";
import { SettingsTab } from "./pages/teach/course/SettingsTab";
import { TopicConstructor } from "./pages/teach/topics/TopicConstructor";
import { ContentEditor } from "./pages/teach/content/ContentEditor";
import { CaseReviewQueue } from "./pages/teach/CaseReviewQueue";

import { StudentShell } from "./pages/student/StudentShell";
import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentTasksPage } from "./pages/student/StudentTasksPage";
import { StudentCoursesPage } from "./pages/student/StudentCoursesPage";
import { GradesPage } from "./pages/student/GradesPage";
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
          <RequireRole roles={["superadmin", "faculty_admin", "dept_admin"]}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="staff" element={<StructurePage />} />
        <Route path="staff/f/:id" element={<FacultyPage />} />
        <Route path="staff/d/:id" element={<DepartmentPage />} />
        <Route path="groups/:id" element={<AdminGroupProfile />} />
        {/* Legacy URLs → the new modules */}
        <Route path="structure" element={<Navigate to="/admin/staff" replace />} />
        <Route path="structure/*" element={<Navigate to="/admin/staff" replace />} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="users" element={<Navigate to="/admin/students" replace />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="tasks" element={<AdminTasksPage />} />
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
        {/* Bosh sahifa — BITTA sahifa (2026-08-03, buyurtmachi: "vazifalar va
            darslarimni ham bugun ichida bo'lsin va bu tablarni yo'qot").
            Darslar va vazifalar endi shu sahifaning bloklari.
            ⚠️ Eski manzillar SAQLANADI: backend vazifalari (tasks/service.ts)
            aynan `/teach/tasks` va `/teach/schedule` deep-linklarini beradi —
            ular kerakli blokni ochib beradi. */}
        <Route index element={<TeachDashboard />} />
        <Route path="tasks" element={<Navigate to="/teach?focus=tasks" replace />} />
        <Route path="schedule" element={<Navigate to="/teach?focus=lessons" replace />} />

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
          <Route path="mistakes" element={<MistakesTab />} />
          {/* Guruh chati olib tashlandi (2026-07-23) — eski link topics'ga. */}
          <Route path="chat" element={<Navigate to="../topics" replace />} />
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
        {/* Guruh chati olib tashlandi (2026-07-23). */}
        <Route path="chat" element={<Navigate to="/app" replace />} />
        <Route path="grades" element={<GradesPage />} />
        {/* Jadval endi Davomat sahifasining ichida (tab) — eski link redirect qiladi. */}
        <Route path="schedule" element={<Navigate to="/app/attendance?sub=jadval" replace />} />
        <Route path="courses" element={<StudentCoursesPage />} />
        <Route path="courses/:id" element={<CoursePath />} />
        <Route path="topics/:id" element={<LessonPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
