import { useCourse, useCourses } from "../../lib/api";

interface NoteRelationFieldsProps {
  courseId: string;
  chapterId: string;
  onCourseChange: (courseId: string) => void;
  onChapterChange: (chapterId: string) => void;
}

export function NoteRelationFields({
  courseId,
  chapterId,
  onCourseChange,
  onChapterChange,
}: NoteRelationFieldsProps) {
  const coursesQuery = useCourses(1, 100);
  const courseDetailQuery = useCourse(courseId || undefined);
  const chapters = courseDetailQuery.data?.chapters ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <select
        value={courseId}
        onChange={(event) => {
          onCourseChange(event.target.value);
          onChapterChange("");
        }}
        className="rounded-md border border-border bg-surface px-3 py-2"
      >
        <option value="">不关联课程</option>
        {(coursesQuery.data?.data ?? []).map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>

      <select
        value={chapterId}
        onChange={(event) => onChapterChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-60"
        disabled={!courseId}
      >
        <option value="">不关联章节</option>
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.title}
          </option>
        ))}
      </select>
    </div>
  );
}
