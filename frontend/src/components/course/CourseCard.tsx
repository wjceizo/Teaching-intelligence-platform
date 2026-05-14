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
  if (percent >= 80) return "bg-success";
  if (percent >= 40) return "bg-info";
  return "bg-warning";
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
          <div className="flex h-36 items-center justify-center bg-gradient-to-br from-cyan-200 via-sky-100 to-indigo-200 text-4xl font-semibold text-info">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={primaryActionPending}
            onClick={() => onPrimaryAction?.(course.id)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {primaryActionPending ? "处理中..." : primaryActionLabel}
          </button>

          {canDelete ? (
            <button
              type="button"
              disabled={deletePending}
              onClick={() => onDelete?.(course.id)}
              className="rounded-md border border-destructive/45 bg-destructive-surface px-3 py-2 text-sm font-medium text-destructive disabled:opacity-50"
            >
              {deletePending ? "删除中..." : "删除"}
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
