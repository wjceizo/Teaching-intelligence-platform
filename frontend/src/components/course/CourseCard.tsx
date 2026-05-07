import { Link } from "react-router-dom";

import { Course } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

interface CourseCardProps {
  course: Course;
  primaryActionLabel: string;
  primaryActionPending?: boolean;
  onPrimaryAction?: (courseId: string) => void;
  canDelete?: boolean;
  deletePending?: boolean;
  onDelete?: (courseId: string) => void;
}

function progressColor(percent: number) {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 40) return "bg-blue-500";
  return "bg-amber-500";
}

export function CourseCard({
  course,
  primaryActionLabel,
  primaryActionPending = false,
  onPrimaryAction,
  canDelete = false,
  deletePending = false,
  onDelete,
}: CourseCardProps) {
  const fallbackInitial = course.title.trim().charAt(0) || "课";

  return (
    <Card className="group overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
      <Link to={`/courses/${course.id}`} className="block">
        {course.cover_image ? (
          <img
            src={course.cover_image}
            alt={course.title}
            className="h-36 w-full object-cover"
          />
        ) : (
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-cyan-200 via-sky-100 to-indigo-200 text-4xl font-semibold text-sky-700">
            {fallbackInitial}
          </div>
        )}
      </Link>

      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <Link to={`/courses/${course.id}`} className="line-clamp-2 text-lg font-semibold hover:text-primary">
            {course.title}
          </Link>
          <p className="text-sm text-foreground/70">讲师：{course.teacher.username}</p>
          <p className="text-sm text-foreground/70">章节：{course.chapters_count}</p>
        </div>

        {course.is_enrolled ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-foreground/70">
              <span>学习进度</span>
              <span>{course.progress_percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={cn("h-2 rounded-full transition-all", progressColor(course.progress_percent))}
                style={{ width: `${Math.max(0, Math.min(100, course.progress_percent))}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={primaryActionPending}
            onClick={() => onPrimaryAction?.(course.id)}
            className="flex-1 rounded-md border border-black bg-transparent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {primaryActionPending ? "处理中..." : primaryActionLabel}
          </button>

          {canDelete ? (
            <button
              type="button"
              disabled={deletePending}
              onClick={() => onDelete?.(course.id)}
              className="rounded-md border border-red-600 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {deletePending ? "删除中" : "删除"}
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
