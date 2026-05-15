# 数学教育智能体平台 · Vibe Coding Prompt 指南
## 总体规划

```
Phase 0 │ 部署基础数据库              ← 部署必备基础设施
Phase 1 │ 项目脚手架 & 基础设施        ← 跑通前后端开发环境
Phase 2 │ 用户认证系统                 ← 登录注册、JWT、RBAC
Phase 3 │ 课程 & 章节管理              ← 核心内容模块
Phase 4 │ 问答中心（教师答疑）          ← 社区互动
Phase 5 │ AI 答疑（RAG）               ← 智能核心
Phase 6 │ 笔记系统                     ← 学习工具
Phase 7 │ 代码实训（沙箱）             ← 实践环节
Phase 8 │ 在线测验系统                 ← 评估模块
Phase 9 │ 学习分析仪表盘               ← 数据洞察
Phase 10│ Lean 4 证明器                ← 高级功能
Phase 11│ 生产部署 & 监控              ← 上线准备
```

## Phase 8 · 在线测验系统

本阶段目标不是只做“学生答几道选择题”，而是完成一套能服务课程教学的在线测验闭环：

- 教师可以维护课程题库，创建草稿试卷，配置题目分值、时间窗口、限时、是否乱序、结果公布方式，并发布/关闭测验。
- 学生只能看到自己已选课程中已发布且可参加的测验，可以开始答题、自动保存、继续未完成作答、提交试卷并查看允许公开的结果。
- 系统自动批改单选、多选、填空题；简答题、证明题进入教师批阅队列；最终分数由自动评分和教师手动评分共同组成。
- 教师可以查看提交列表、批阅主观题、查看班级统计和题目正确率，为 Phase 9 学习分析提供数据基础。

### Prompt 8-1 · 测验后端

```
实现在线测验系统的完整后端，包含题库、组卷、发布、学生作答、自动保存、自动评分、教师批阅和测验统计。

【依赖】
- 不得引入 README 技术栈之外的新依赖。
- 所有数据库结构变更必须生成 Alembic 迁移文件。
- 保持 Router → Service → Model 分层，Router 不直接写复杂业务逻辑。

【数据库模型】app/models/exam.py
重构或补全当前 ExamQuestion / Exam / ExamAttempt，并新增 ExamQuestionInPaper / ExamAttemptAnswer。

1. ExamQuestion
   - id
   - course_id: FK courses.id，必填，index
   - chapter_id: FK chapters.id，可选，index；如果填写，必须属于 course_id
   - teacher_id: FK users.id，必填，index；创建题目的教师
   - type: single/multi/fill/short/proof
   - content: Text，Markdown + LaTeX 题干
   - options: JSON，可选；single/multi 使用 list[{id,label,content}]
   - answer: JSON/Text，标准答案；学生接口永不返回
     * single: "A"
     * multi: ["A","C"]
     * fill: ["答案1", "答案2"] 或单个字符串
     * short/proof: 参考答案文本
   - explanation: Text，可选；结果未公布前学生接口不返回
   - difficulty: int，1-5
   - tags: JSON，可选，如 ["极限", "导数"]
   - is_active: bool，默认 true；删除题目优先软删除，避免历史试卷丢题
   - created_at / updated_at

2. Exam
   - id
   - course_id: FK courses.id，必填，index
   - chapter_id: FK chapters.id，可选，index
   - teacher_id: FK users.id，必填，index
   - title: str，必填
   - description: Text，可选，Markdown
   - total_score: int，默认 100
   - pass_score: int，可选，默认 total_score * 0.6
   - time_limit_minutes: int，必填
   - start_time: datetime，可选
   - end_time: datetime，可选
   - max_attempts: int，默认 1
   - is_shuffled: bool，默认 false；只打乱题目顺序，不改变每题分值
   - show_result_policy: after_submit/after_end/manual，默认 after_submit
   - status: draft/published/closed，默认 draft
   - created_at / updated_at

3. ExamQuestionInPaper
   - id
   - exam_id: FK exams.id ondelete CASCADE，index
   - question_id: FK exam_questions.id，index
   - points: int，必须 > 0
   - order_index: int
   - created_at
   说明：试卷与题库是多对多关系，必须用该表保存题目顺序和本试卷内分值。不要只在 Exam 中保存 question_ids，否则无法稳定处理分值、排序和历史试卷。

4. ExamAttempt
   - id
   - exam_id: FK exams.id ondelete CASCADE，index
   - user_id: FK users.id，index
   - status: in_progress/submitted/pending_review/graded/expired
   - score: int，可空；有主观题未批阅时可为空或保存已得客观题分数
   - auto_score: int，默认 0
   - manual_score: int，默认 0
   - total_score: int，保存提交时试卷满分快照
   - question_order: JSON，保存本次作答题目顺序，支持乱序后稳定恢复
   - started_at
   - deadline_at: started_at + time_limit_minutes，同时不得超过 exam.end_time
   - last_saved_at
   - submitted_at，可空
   - graded_at，可空
   - violation_count: int，默认 0；记录离开全屏/切屏等前端上报次数

5. ExamAttemptAnswer
   - id
   - attempt_id: FK exam_attempts.id ondelete CASCADE，index
   - question_id: FK exam_questions.id，index
   - answer: JSON/Text，可空
   - is_correct: bool，可空；主观题批阅前为 null
   - auto_score: int，可空
   - manual_score: int，可空
   - final_score: int，可空
   - max_score: int，该题分值快照
   - teacher_comment: Text，可选
   - graded_by: FK users.id，可选
   - graded_at，可空
   - updated_at

【评分规则】
- 发布前必须至少有 1 道题，且所有题目分值之和必须等于 exam.total_score。
- 单选：answer 完全匹配。
- 多选：集合完全匹配，不因顺序不同扣分。
- 填空：默认去除首尾空白后完全匹配；支持多个可接受答案，任一匹配即正确。
- 简答/证明：提交后标记为待批阅，教师手动给分，分数范围 0 到该题 max_score。
- 试卷包含主观题时：
  * 学生提交后 attempt.status=pending_review
  * 教师完成全部主观题批阅后 attempt.status=graded
  * score = auto_score + manual_score
- 纯客观题提交后直接 attempt.status=graded。
- 超过 deadline_at 后禁止继续保存草稿；提交接口可自动按当前草稿交卷，并标记 expired 或 submitted。
- 学生可查看结果的内容受 show_result_policy 控制：
  * after_submit：提交后可看客观题对错、得分、答案和解析；主观题等批阅后显示教师评语。
  * after_end：考试结束后才显示标准答案和解析，提交后只显示总状态。
  * manual：教师手动开放结果前只显示“已提交/待批阅/已批阅”和总分。

【权限规则】
- student：
  * 只能看到自己已选课程中 status=published 的测验。
  * 只能开始和查看自己的 attempt。
  * 作答接口不能接收或返回标准答案、解析、其他学生信息。
- teacher：
  * 只能管理自己负责课程或自己创建的题库/试卷。
  * 可以查看本课程学生提交、批阅主观题、查看统计。
- admin：
  * 可管理全部题库、试卷、提交和统计。

【Schemas】app/schemas/exam.py
- QuestionOption: id, label, content
- ExamQuestionCreate:
  course_id, chapter_id(optional), type, content, options(optional),
  answer, explanation(optional), difficulty=1, tags(optional)
- ExamQuestionUpdate: 与 Create 相同字段但全部 optional
- ExamQuestionResponse:
  id, course_id, chapter_id, teacher_id, type, content, options,
  difficulty, tags, created_at, updated_at
  - teacher/admin 额外包含 answer, explanation
  - student 永不包含 answer；explanation 仅在结果允许公开时通过结果接口返回
- ExamQuestionInPaperCreate: question_id, points, order_index
- ExamCreate:
  course_id, chapter_id(optional), title, description(optional),
  total_score=100, pass_score(optional), time_limit_minutes,
  start_time(optional), end_time(optional), max_attempts=1,
  is_shuffled=false, show_result_policy="after_submit",
  questions: list[ExamQuestionInPaperCreate], status="draft"
- ExamUpdate: 所有字段 optional；questions 可整体替换
- ExamListItem:
  id, title, course_id, course_title, chapter_id, chapter_title,
  status, total_score, pass_score, time_limit_minutes,
  start_time, end_time, question_count, attempt_status(optional),
  best_score(optional), latest_attempt_id(optional)
- ExamResponse:
  完整试卷信息 + questions
  - 教师/admin 查看时包含每题 answer/explanation 和 points
  - 学生查看时只包含题干、选项、题型、分值，不含答案/解析
- AttemptStartResponse:
  attempt_id, exam_id, status, questions, time_limit_minutes,
  started_at, deadline_at, saved_answers
- AttemptSaveRequest: answers: dict[question_id, str|list[str]]
- AttemptSubmitRequest: answers: dict[question_id, str|list[str]]
- AttemptAnswerResult:
  question_id, user_answer, is_correct(optional), score(optional),
  max_score, standard_answer(optional), explanation(optional),
  teacher_comment(optional), pending_review(bool)
- AttemptResultResponse:
  attempt_id, exam_id, status, score(optional), auto_score,
  manual_score, total_score, pass_score, submitted_at, graded_at,
  can_view_detail, answers: list[AttemptAnswerResult]
- GradeAnswerRequest: question_id, score, teacher_comment(optional)
- GradeAttemptRequest: answers: list[GradeAnswerRequest]
- ExamStatsResponse:
  participants_count, submitted_count, pending_review_count,
  avg_score, pass_rate, max_score, min_score,
  score_distribution, question_stats
- ExamFilter:
  course_id, chapter_id, status, q, mine_only, page, page_size

【Service】app/services/exam_service.py
实现 ExamService，保持业务逻辑集中。

题库：
- create_question(db, data, user)
  - teacher/admin 权限
  - teacher 只能给自己负责课程创建题目
  - 校验 chapter_id 属于 course_id
  - 校验题型与 options/answer 结构匹配
- list_questions(db, user, filters, page, page_size)
  - 支持 course_id/chapter_id/type/difficulty/tags/q
  - teacher 仅看自己负责课程题目，admin 看全部
- update_question(db, question_id, data, user)
- delete_question(db, question_id, user)
  - 已被试卷使用的题目软删除 is_active=false

试卷：
- create_exam(db, data, user)
  - teacher/admin 权限
  - 校验课程权限、题目存在、题目属于同一课程、分值总和等于 total_score
  - 初始可保存 draft；status=published 时必须通过发布校验
- list_exams(db, user, filters, page, page_size)
  - 学生只看已选课程中 published/closed 试卷
  - 教师看自己课程/自己创建的试卷
  - 返回学生 attempt_status、best_score、latest_attempt_id
- get_exam(db, exam_id, user)
  - 根据用户角色脱敏答案和解析
- update_exam(db, exam_id, data, user)
  - 已有 attempt 的试卷仍可修改标题/描述/时间/状态
  - 若修改 questions/total_score，需要明确允许：新 attempt 使用新配置，历史 attempt 保留分值快照
- publish_exam(db, exam_id, user)
  - 校验题目数量、分值总和、时间配置
- close_exam(db, exam_id, user)

作答：
- start_attempt(db, exam_id, user)
  - 检查学生选课、试卷状态、start_time/end_time、max_attempts
  - 如果已有 in_progress attempt，返回该 attempt 和草稿答案，用于继续答题
  - 如果 is_shuffled=true，生成 question_order 并保存
- save_draft(db, attempt_id, user, answers)
  - 校验 attempt 归属、状态、deadline_at
  - upsert ExamAttemptAnswer，不评分
- submit_attempt(db, attempt_id, user, answers)
  流程：
  1. 校验 attempt 归属和状态，允许在截止时间边界提交
  2. 保存最终答案
  3. 自动批阅 single/multi/fill
  4. short/proof 创建待批阅记录
  5. 更新 auto_score/manual_score/score/status/submitted_at
  6. 根据 show_result_policy 返回脱敏后的结果
- expire_attempts(db)
  - 可被接口内懒执行：发现超过 deadline 的 in_progress attempt 时自动提交草稿或标记 expired
- report_violation(db, attempt_id, user, reason)
  - 前端离开全屏/切屏时上报，累加 violation_count；只记录，不直接判 0 分

批阅：
- list_pending_reviews(db, exam_id, user, page, page_size)
- grade_attempt(db, attempt_id, data, user)
  - teacher/admin 权限
  - 只能批阅 short/proof
  - 每题分数必须在 0..max_score
  - 所有主观题批阅完成后更新 attempt.status=graded、score、graded_at

统计：
- get_exam_stats(db, exam_id, user)
  - 仅 teacher/admin
  - 统计参与人数、提交人数、待批阅人数、平均分、通过率、分数分布
  - question_stats 包含每题作答人数、正确率、平均得分、主观题待批阅数

【Router】app/routers/exams.py，前缀 /api/v1/exams
所有响应遵循 README 的统一格式：分页 {"data": [...], "meta": {...}}，单条 {"data": {...}}。
在 app/routers/__init__.py 和 app/main.py 注册 router。

题库接口：
- GET /questions → 分页题库列表（teacher/admin）
- POST /questions → 201 创建题目（teacher/admin）
- GET /questions/{question_id} → 题目详情（teacher/admin）
- PUT /questions/{question_id} → 更新题目（teacher/admin）
- DELETE /questions/{question_id} → 删除/停用题目（teacher/admin）

试卷接口：
- GET / → 分页测验列表（学生/教师/admin）
- POST / → 201 创建试卷（teacher/admin）
- GET /{exam_id} → 试卷详情（按角色脱敏）
- PUT /{exam_id} → 更新试卷（teacher/admin）
- PATCH /{exam_id}/publish → 发布试卷（teacher/admin）
- PATCH /{exam_id}/close → 关闭试卷（teacher/admin）
- DELETE /{exam_id} → 删除草稿试卷；已有 attempt 的试卷只允许关闭，不物理删除

学生作答接口：
- POST /{exam_id}/attempts → 开始或继续作答
- PUT /attempts/{attempt_id} → 保存草稿，body: AttemptSaveRequest
- POST /attempts/{attempt_id}/submit → 最终提交
- GET /attempts/{attempt_id}/result → 查看本人结果
- POST /attempts/{attempt_id}/violations → 上报离开全屏/切屏等事件

教师批阅与统计接口：
- GET /{exam_id}/attempts → 查看本试卷提交列表（teacher/admin）
- GET /{exam_id}/reviews → 待批阅列表（teacher/admin）
- POST /attempts/{attempt_id}/grade → 批阅主观题（teacher/admin）
- GET /{exam_id}/stats → 统计数据（teacher/admin）

【错误处理】
- 题目/试卷/作答不存在：404
- 无权查看/修改/批阅：403
- 学生未选该课程：403
- 试卷未发布、未开始、已关闭：400
- 已超过最大作答次数：400
- 分值总和不等于 total_score：400
- 题型与选项/答案结构不匹配：422 或 400
- 超时后保存草稿：400，并返回当前 attempt 状态

【后端测试】backend/tests/test_exams.py
- teacher 可以创建题库题目和草稿试卷
- teacher 只能管理自己负责课程的题库和试卷，admin 可管理全部
- 发布试卷前必须有题目，且题目分值总和等于 total_score
- student 只能看到自己已选课程中已发布的测验
- student 查看试卷时看不到 answer/explanation
- start_attempt 会生成 deadline_at，重复开始返回未完成 attempt
- save_draft 可以保存并恢复答案
- submit_attempt 能自动批改单选、多选、填空题
- short/proof 提交后进入 pending_review，教师批阅后变 graded
- show_result_policy=after_end 时，考试结束前不泄露标准答案和解析
- 普通学生不能创建试卷、修改题库、查看统计或批阅
```

---

### Prompt 8-2 · 测验前端

```
实现在线测验系统的完整前端界面，包含学生答题端、教师题库/试卷管理端、主观题批阅和统计视图。

【路由】
在 frontend/src/App.tsx 中接入：
- /exam → ExamListPage（学生/教师都可访问）
- /exam/:id → ExamDetailPage（测验说明页；学生从这里开始/继续作答）
- /exam/:id/attempt/:attemptId → ExamPage（答题页）
- /exam/:id/result/:attemptId → ExamResultPage
- /exam/manage → ExamManagePage（teacher/admin）
- /exam/questions → QuestionBankPage（teacher/admin）
- /exam/new → ExamEditorPage（teacher/admin）
- /exam/:id/edit → ExamEditorPage（teacher/admin）
- /exam/:id/reviews → ExamReviewPage（teacher/admin）
- /exam/:id/stats → ExamStatsPage（teacher/admin）

【API 与 Hooks】frontend/src/lib/api.ts
不得在组件里直接 fetch，全部通过 TanStack Query hooks。

类型：
- ExamQuestion
- ExamQuestionInput
- ExamQuestionInPaper
- Exam
- ExamListItem
- ExamAttempt
- ExamAttemptAnswer
- AttemptStartResponse
- AttemptResult
- ExamStats
- ExamFilters

Hooks：
- useExams(filters, page)
- useExam(id)
- useCreateExam()
- useUpdateExam()
- usePublishExam()
- useCloseExam()
- useDeleteExam()
- useQuestions(filters, page)
- useQuestion(id)
- useCreateQuestion()
- useUpdateQuestion()
- useDeleteQuestion()
- useStartExamAttempt()
- useSaveExamDraft()
- useSubmitExamAttempt()
- useExamResult(attemptId)
- useReportExamViolation()
- useExamAttempts(examId, page, filters?)
- usePendingReviews(examId, page)
- useGradeExamAttempt()
- useExamStats(examId)

【学生端页面和组件】

1. src/pages/ExamListPage.tsx
   - 学生端：只显示自己已选课程可见的测验
   - 教师端：右上角显示“管理测验”“题库”“新建测验”入口，按钮样式与代码实训入口保持一致
   - 筛选：课程、章节、状态、关键词
   - 测验卡片：标题、课程、章节、题目数、总分、限时、开始/结束时间、状态标签
   - 状态标签：
     * 草稿：仅 teacher/admin 可见，红色文字
     * 未开始：灰色
     * 进行中：绿色
     * 已结束/已关闭：深色
     * 待批阅：橙色
     * 已完成：蓝色
   - 空状态、错误状态、loading 状态完整

2. src/pages/ExamDetailPage.tsx
   - 显示测验说明、所属课程/章节、总分、及格分、限时、时间范围、可作答次数
   - 学生按钮：
     * 未开始：按钮禁用并显示开始时间
     * 可开始：开始答题
     * 已有 in_progress：继续答题
     * 已提交：查看结果
     * 已超过次数：显示最近结果
   - 教师按钮：编辑、发布/关闭、查看提交、批阅、统计
   - 学生视角不展示题目答案和解析

3. src/pages/ExamPage.tsx（答题界面）
   布局：左侧题目导航 + 右侧答题区，移动端折叠为顶部答题卡。
   - 顶部：考试名称、倒计时、自动保存状态、提交按钮
   - 倒计时：
     * 剩余 < 5 分钟红色提醒
     * 时间归零自动提交当前草稿
   - 左侧答题卡：
     * 已作答：蓝色
     * 标记题：黄色角标
     * 未答：灰色
     * 当前题：边框高亮
   - 右侧题目：
     * 题号、题型标签、分值
     * MarkdownRenderer 渲染题干，支持 LaTeX
     * 单选：Radio Group
     * 多选：Checkbox Group
     * 填空：Input 或 Textarea
     * 简答：Textarea，支持 LaTeX 输入
     * 证明题：Monaco Editor 或 Textarea，适合输入证明过程
   - 底部操作：上一题 / 下一题 / 标记题目 / 保存草稿 / 提交试卷
   - localStorage 草稿缓存 key: exam_{attemptId}_draft
   - 自动保存：
     * 答案变化 debounce 2s 写入 localStorage
     * 每 30 秒 PUT /attempts/{id}
     * 页面关闭前 beforeunload 尝试保存
   - 提交前弹窗确认：显示未答题数量、标记题数量、剩余时间

4. src/pages/ExamResultPage.tsx
   - 顶部结果摘要：总分/满分、是否及格、状态（待批阅/已批阅）、提交时间
   - 得分圆环图（Recharts RadialBar 或现有图表方案）
   - 各题答题情况列表：
     * 正确：绿色
     * 错误：红色
     * 待批阅：橙色
     * 未公布详情：灰色提示
   - 允许查看详情时，展开每题显示：
     * 我的答案
     * 标准答案
     * 解析
     * 教师评语
   - show_result_policy 不允许时，不渲染标准答案和解析

【教师端页面和组件】

1. src/pages/QuestionBankPage.tsx
   - 题库列表：题型、题干摘要、课程、章节、难度、标签、创建时间、操作
   - 筛选：课程、章节、题型、难度、标签、关键词
   - 操作：新建题目、编辑、停用/删除
   - teacher 课程下拉只能选择自己负责的课程，admin 可选择全部

2. src/components/exam/QuestionEditor.tsx
   - 字段：课程、章节、题型、题干、选项、答案、解析、难度、标签
   - 题干/解析支持 Markdown 编辑 + 预览
   - 单选/多选：
     * 支持新增、删除、排序选项
     * 选项至少 2 个
     * 单选只能选 1 个正确答案，多选可选多个
   - 填空：
     * 支持多个可接受答案
   - 简答/证明：
     * 标准答案作为参考答案，供教师批阅和学生结果页查看
   - 前端校验题型与答案结构，后端仍需二次校验

3. src/pages/ExamManagePage.tsx
   - teacher/admin 专用页面
   - 表格列：标题、课程、章节、状态、总分、题目数、限时、时间范围、提交数、待批阅数、创建时间、操作
   - 筛选：课程、状态、关键词
   - 操作：
     * 编辑
     * 发布/关闭
     * 查看提交
     * 批阅
     * 统计
     * 删除草稿（红色危险按钮，二次确认）
   - 未发布草稿在状态列用红色“草稿”标注

4. src/pages/ExamEditorPage.tsx
   用于创建/编辑试卷。
   表单字段：
   - 标题
   - 所属课程（必选；teacher 只能选择自己负责的课程）
   - 所属章节（可选；选择课程后只显示该课程章节）
   - 描述（Markdown 编辑 + 预览）
   - 总分（默认 100）
   - 及格分（默认 60）
   - 限时分钟数
   - 开始时间 / 结束时间
   - 最大作答次数
   - 是否乱序
   - 结果公布方式 show_result_policy
   - 状态：保存草稿 / 保存并发布
   题目选择：
   - 从题库搜索并添加题目
   - 可直接新建题目并加入当前试卷
   - 已选题目支持拖拽排序
   - 每题设置分值
   - 页面实时显示“当前分值合计 / 总分”，不相等时禁止发布

5. src/pages/ExamReviewPage.tsx
   - 教师批阅主观题页面
   - 左侧提交列表：学生、提交时间、状态、当前得分、待批阅数量
   - 右侧批阅区：
     * 显示题干、参考答案、学生答案
     * 分数输入框，范围 0..该题分值
     * 教师评语 Textarea
     * 保存当前题 / 保存并下一题
   - 完成全部主观题后，状态更新为已批阅

6. src/pages/ExamStatsPage.tsx 或 src/components/exam/ExamStats.tsx
   - 指标卡：参与人数、提交人数、待批阅人数、平均分、通过率、最高分、最低分
   - 分数分布柱状图（Recharts BarChart）
   - 各题正确率/平均得分排行
   - 提交列表：学生、状态、得分、提交时间、违规次数
   - 支持导出 CSV（若不新增依赖，可用 Blob + URL.createObjectURL）

【防作弊与边界】
- 全屏模式：
  * 开始答题时提示进入全屏
  * 离开全屏、页面失焦、visibilitychange 时弹出警告并调用 /violations
  * 不要依赖禁用 F12 作为安全能力，只做前端提醒；核心防作弊是计时、随机顺序、日志记录
- 禁用右键菜单和常见复制粘贴可作为前端提示，但不要影响输入公式和证明文本的基本可用性。
- 刷新页面后应从后端草稿 + localStorage 恢复答案。
- 网络错误时显示“草稿保存在本地，恢复网络后请继续保存/提交”。

【交互与可用性】
- 所有异步操作必须有 loading / error / empty state。
- 发布、关闭、删除、提交试卷必须二次确认。
- 学生提交后 invalidate:
  * ['exams']
  * ['exams', id]
  * ['exam-result', attemptId]
- 教师保存题库/试卷/批阅后 invalidate:
  * ['exam-questions']
  * ['exams']
  * ['exams', id]
  * ['exam-attempts', examId]
  * ['exam-stats', examId]
- TypeScript 禁止 any；Props 用 interface。
- 单组件超过 200 行必须拆分。
- UI 风格与现有课程、笔记、代码实训页面保持一致，不做独立风格。
```

---

### Prompt 8-3 · 课程集成、验收与种子测验

```
完成 Phase 8 后，必须用 teacher 账户创建一套可真实验证的在线测验，并用 student 账户完成一次作答、提交和查看结果。

【课程页面集成】
- 在 CourseDetailPage 的章节学习界面中，章节下方增加“本章测验”区域：
  * 只显示该 course_id + chapter_id 下学生可见的测验
  * 显示测验状态、限时、总分、最近作答状态
  * 学生点击进入 /exam/:id
- 在 CourseEditorPage 中增加“测验”管理入口：
  * 展示当前课程下的测验
  * 可跳转新建测验，并自动带上 course_id
  * 可编辑已有测验

【种子题库与测验】
使用 teacher@example.com / Password123 登录，创建并发布：
- 课程：选择已有课程；如果没有课程，则先用教师账号创建一门“高等数学测验课”
- 章节：选择已有章节；如果没有章节，则创建“函数与极限”
- 测验标题：函数极限小测
- 总分：100
- 及格分：60
- 限时：30 分钟
- 最大作答次数：1
- 结果公布方式：after_submit
- 题目：
  1. 单选题，20 分
     题干：若 lim_{x→0} sin x / x = ?
     选项：A. 0；B. 1；C. ∞；D. 不存在
     答案：B
     解析：这是重要基本极限。
  2. 多选题，20 分
     题干：下列关于极限的说法正确的是？
     选项：A. 极限存在则左右极限相等；B. 左右极限相等则极限存在；C. 函数在点处无定义时极限一定不存在；D. 极限只与该点附近函数值有关
     答案：A、B、D
  3. 填空题，20 分
     题干：lim_{x→0} (1 - cos x) / x^2 = ___
     可接受答案：1/2、0.5
  4. 简答题，20 分
     题干：简述函数极限与函数值之间的关系。
     参考答案：极限描述自变量趋近某点时函数值的趋近趋势，函数在该点的取值不一定影响极限。
  5. 证明题，20 分
     题干：用夹逼定理证明 lim_{x→0} x^2 sin(1/x) = 0。
     参考答案：由 -1 <= sin(1/x) <= 1 得 -x^2 <= x^2 sin(1/x) <= x^2，左右两端极限均为 0，所以原极限为 0。

【手工验收】
1. 教师可以在题库中新建、编辑、删除/停用题目。
2. 教师创建试卷时只能选择自己负责课程；admin 可选择全部课程。
3. 教师保存草稿后，学生在 /exam 看不到该测验；发布后学生可见。
4. 发布前如果题目为空或分值合计不等于总分，应阻止发布并显示错误。
5. 学生只能看到自己已选课程的测验，不能看到未选课程测验。
6. 学生开始答题后刷新页面，可以继续答题并恢复草稿。
7. 自动保存每 30 秒执行一次；手动保存后再次进入能看到答案。
8. 倒计时归零时自动提交。
9. 学生提交后，单选/多选/填空自动评分，简答/证明显示待批阅。
10. 教师批阅主观题后，学生结果页显示最终得分和教师评语。
11. show_result_policy=after_end 时，结束前学生不能看到标准答案和解析。
12. 教师统计页显示参与人数、平均分、通过率、分数分布和每题正确率。
13. 普通学生访问 /exam/manage、/exam/questions、/exam/:id/reviews、/exam/:id/stats 或调用教师接口应被拒绝。

【自动化验证】
- 后端：新增/更新 pytest，覆盖权限、发布校验、答案脱敏、自动保存、客观题评分、主观题批阅、结果公布策略。
- 前端：至少运行 npm run build，确保 TypeScript 类型通过。
- 若已有前端测试框架，可补充关键页面渲染和 hook 类型测试；没有则不额外引入测试依赖。
- 完成后运行：
  * backend: python -m compileall app alembic/versions
  * backend: pytest tests
  * frontend: npm run build
```

---

### Prompt 8-4 · 在线测验后续优化

```
如果 Prompt 8-1 到 8-3 已完成，再根据时间选择实现以下增强项。增强项不得破坏已完成的基础闭环。

1. 自动组卷
   - 教师选择课程、章节、题型数量、难度范围、总分
   - 系统从题库随机抽题并生成草稿试卷
   - 抽题失败时明确提示缺少哪类题目

2. 批量导入题库
   - 支持教师上传 JSON 或 CSV
   - 导入前预览并校验题型、选项、答案格式
   - 部分失败时显示行号和错误原因

3. 结果开放控制
   - 教师可以手动开放/关闭某次测验的答案解析
   - 支持只开放分数、不开放标准答案

4. 错题回顾
   - 学生结果页可将错题加入笔记
   - 错题记录关联课程、章节和题型

5. 题目版本快照
   - 学生开始作答时保存题干、选项、答案、分值快照
   - 教师后续修改题库不影响历史 attempt 展示和评分
```
