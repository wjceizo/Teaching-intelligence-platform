import { ChangeEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CourseCard } from "../components/course/CourseCard";
import { Course, useCourses, useCreateCourse, useDeleteCourse, useEnroll } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("图片读取失败"));
      }
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function CourseListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCoverImage, setNewCoverImage] = useState<string | undefined>(undefined);
  const [newCoverName, setNewCoverName] = useState<string>("");
  const pageSize = 20;

  const coursesQuery = useCourses(page, pageSize);
  const enrollMutation = useEnroll();
  const createCourseMutation = useCreateCourse();
  const deleteCourseMutation = useDeleteCourse();

  const filteredCourses = useMemo(() => {
    const courses = coursesQuery.data?.data ?? [];
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return courses;
    }
    return courses.filter((course) => {
      return (
        course.title.toLowerCase().includes(keyword) ||
        course.teacher.username.toLowerCase().includes(keyword)
      );
    });
  }, [coursesQuery.data, searchText]);

  const canCreateCourse = user?.role === "teacher" || user?.role === "admin";

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setNewCoverImage(dataUrl);
    setNewCoverName(file.name);
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) {
      window.alert("请先输入课程名称");
      return;
    }

    try {
      const created = await createCourseMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim(),
        cover_image: newCoverImage,
      });

      setShowCreateForm(false);
      setNewTitle("");
      setNewDescription("");
      setNewCoverImage(undefined);
      setNewCoverName("");
      navigate(`/courses/${created.id}/edit`);
    } catch (error) {
      if (error instanceof Error) {
        window.alert(error.message);
      }
    }
  };

  const getCardAction = (course: Course): { label: string; onClick: () => void; canDelete: boolean } => {
    const isOwner = user?.id === course.teacher_id;
    const isTeacher = user?.role === "teacher";
    const isAdmin = user?.role === "admin";
    const isStudent = user?.role === "student";

    if (isAdmin) {
      return {
        label: "编辑课程",
        onClick: () => navigate(`/courses/${course.id}/edit`),
        canDelete: true,
      };
    }

    if (isTeacher) {
      if (isOwner) {
        return {
          label: "编辑课程",
          onClick: () => navigate(`/courses/${course.id}/edit`),
          canDelete: true,
        };
      }
      return {
        label: "查看课程",
        onClick: () => navigate(`/courses/${course.id}`),
        canDelete: false,
      };
    }

    if (isStudent) {
      if (course.is_enrolled) {
        return {
          label: "继续学习",
          onClick: () => navigate(`/courses/${course.id}`),
          canDelete: false,
        };
      }
      return {
        label: "加入课程",
        onClick: () => enrollMutation.mutate(course.id),
        canDelete: false,
      };
    }

    return {
      label: "查看课程",
      onClick: () => navigate(`/courses/${course.id}`),
      canDelete: false,
    };
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">课程中心</h1>
        {canCreateCourse ? (
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="rounded-md border border-black bg-transparent px-4 py-2 text-sm font-medium text-black"
          >
            {showCreateForm ? "收起创建面板" : "创建课程"}
          </button>
        ) : null}
      </div>

      {showCreateForm ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="课程名称，例如：计算方法"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <textarea
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="课程简介（可选）"
            className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                选择课程封面
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <span className="text-sm text-foreground/70">
                {newCoverName || "未选择文件"}
              </span>
            </div>
            {newCoverImage ? (
              <img src={newCoverImage} alt="课程封面预览" className="h-24 w-40 rounded object-cover" />
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleCreateCourse()}
            disabled={createCourseMutation.isPending}
            className="rounded-md border border-black bg-transparent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {createCourseMutation.isPending ? "创建中..." : "确认创建"}
          </button>
        </div>
      ) : null}

      <input
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="搜索课程标题或教师名"
        className="w-full rounded-md border border-border bg-background px-3 py-2"
      />

      {coursesQuery.isLoading ? <p className="text-sm text-foreground/70">课程加载中...</p> : null}
      {coursesQuery.isError ? (
        <p className="text-sm text-red-600">课程加载失败：{coursesQuery.error.message}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCourses.map((course) => {
          const action = getCardAction(course);
          return (
            <CourseCard
              key={course.id}
              course={course}
              primaryActionLabel={action.label}
              primaryActionPending={enrollMutation.isPending || deleteCourseMutation.isPending}
              onPrimaryAction={() => action.onClick()}
              canDelete={action.canDelete}
              deletePending={deleteCourseMutation.isPending}
              onDelete={() => {
                const ok = window.confirm("确认删除该课程？删除后不可恢复。");
                if (!ok) {
                  return;
                }
                deleteCourseMutation.mutate(course.id);
              }}
            />
          );
        })}
      </div>

      {coursesQuery.data ? (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-foreground/70">第 {page} 页</span>
          <button
            type="button"
            disabled={page * pageSize >= coursesQuery.data.meta.total}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      ) : null}
    </section>
  );
}
