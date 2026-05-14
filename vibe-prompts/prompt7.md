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

## Phase 7 · 代码实训（沙箱）

本阶段目标不是只做“学生写代码并运行”，而是完成一套可用于教学闭环的代码实训系统：

- 学生可以按课程/章节找到实训题，阅读题面，编辑代码，运行公开样例，正式提交并查看得分与历史记录。
- 教师可以为自己负责的课程/章节创建、修改、发布、下架实训题，维护公开样例和隐藏评分用例，查看学生提交结果。
- 系统用 Docker 沙箱隔离执行代码，按测试用例自动评分，并保证隐藏测试内容不会泄露给学生。

### Prompt 7-1 · 代码实训后端

```
实现代码实训的完整后端，包含教师出题、题目修改、测试用例管理、Docker 沙箱执行和自动评分。

【依赖】
- 如果项目尚未安装 docker SDK：uv add docker
- 不得引入 README 技术栈之外的新依赖。

【数据库模型】app/models/codelab.py
需要补全或重构现有 CodeLab / CodeSubmission，并新增 CodeLabTestCase。
所有数据库变更必须生成 Alembic 迁移文件。

1. CodeLab
   - id
   - course_id: FK courses.id，必填，index
   - chapter_id: FK chapters.id，可选，index；如果填写，必须属于 course_id
   - teacher_id: FK users.id，必填，index；创建题目的教师
   - title: str，必填
   - description: Text，Markdown 题面，必填
   - language: python/javascript/cpp
   - starter_code: Text，必填
   - difficulty: int，1-5
   - time_limit_ms: int，默认 30000
   - memory_limit_mb: int，默认 256
   - is_published: bool，默认 false；未发布题目只有创建教师和 admin 可见
   - created_at / updated_at

2. CodeLabTestCase
   - id
   - codelab_id: FK codelabs.id ondelete CASCADE，index
   - name: str，例如“样例1”“边界情况”
   - input_data: Text，作为 stdin 输入
   - expected_output: Text，标准输出
   - is_hidden: bool，默认 false；隐藏用例不向学生返回 input/output/expected_output
   - points: int，默认 10；必须 > 0
   - order_index: int，用于教师端排序
   - created_at / updated_at

3. CodeSubmission
   - id
   - codelab_id: FK codelabs.id ondelete CASCADE，index
   - user_id: FK users.id，index
   - code: Text
   - mode: run/submit；run 只跑公开样例，submit 跑全部用例并计入成绩
   - status: pending/running/success/failed/error/timeout
   - score: int，默认 0
   - max_score: int，默认所有参与评分用例 points 之和
   - tests_passed: int
   - tests_total: int
   - result_json: JSON/Text，保存每个用例的执行结果；学生视角必须隐藏隐藏用例 input/expected_output
   - logs: Text，可选，保存编译错误/运行错误摘要
   - execution_time_ms: int，可选
   - submitted_at

【评分规则】
- 教师创建/修改题目时至少要有 1 个测试用例，否则不能发布。
- “运行”只执行 is_hidden=false 的公开样例，不更新学生最高成绩。
- “提交”执行全部测试用例，score = 通过用例 points 之和，max_score = 全部用例 points 之和。
- status 判定：
  * success：全部参与评分用例通过
  * failed：代码正常运行但至少一个用例输出不匹配
  * timeout：任意用例超时
  * error：编译失败、运行时异常、Docker 异常或沙箱不可用
- 输出比较：
  * 去除末尾空白后比较 stdout 与 expected_output
  * 保留中间空格和换行，避免误判数学/矩阵类输出
- 学生可见结果：
  * 公开用例显示 input_data、expected_output、actual_output、passed、points
  * 隐藏用例只显示 name（或“隐藏用例1”）、passed、points，不显示输入、期望输出和实际输出
- 学生列表和详情页显示 latest_submission 和 best_score。

【Schemas】app/schemas/codelab.py
- TestCaseCreate: name, input_data, expected_output, is_hidden=false, points=10, order_index
- TestCaseUpdate: 所有字段 optional
- TestCasePublicResponse: id, name, is_hidden, points, order_index, input_data(optional), expected_output(optional)
  - 学生接口中隐藏用例的 input_data / expected_output 必须为 None
- CodeLabCreate:
  title, description, course_id, chapter_id(optional), language, starter_code,
  difficulty, time_limit_ms=30000, memory_limit_mb=256, is_published=false,
  test_cases: list[TestCaseCreate]
- CodeLabUpdate: 与 CodeLabCreate 相同字段但全部 optional，test_cases 可整体替换
- CodeLabResponse:
  完整题目信息 + course_title + chapter_title(optional) + teacher(id/username)
  + test_cases(学生只看公开用例，教师看全部)
  + latest_submission(optional) + best_score(optional)
- CodeLabListItem:
  id, title, course_id, course_title, chapter_id, chapter_title,
  language, difficulty, is_published, max_score, latest_submission, best_score, submissions_count
- SubmitCodeRequest: code
- RunCodeRequest: code
- TestCaseRunResult:
  test_case_id, name, is_hidden, passed, points, actual_output(optional),
  expected_output(optional), input_data(optional), error(optional), execution_time_ms(optional)
- SubmissionResponse:
  id, codelab_id, user_id, mode, status, score, max_score, tests_passed,
  tests_total, results: list[TestCaseRunResult], logs, execution_time_ms, submitted_at
- CodeLabFilter:
  course_id, chapter_id, language, difficulty, is_published, q

【Sandbox Service】app/services/sandbox_service.py
实现 async def run_code_against_tests(code, language, test_cases, time_limit_ms, memory_limit_mb) -> dict。

要求：
- 使用 docker SDK 执行代码，不得用 subprocess 直接在宿主机运行学生代码。
- docker SDK 是同步 API，必须用 asyncio.get_running_loop().run_in_executor 包裹。
- 每次运行使用 tempfile.TemporaryDirectory 创建隔离工作目录。
- 容器配置：
  * Python: image=python:3.12-slim，文件 main.py，cmd=["python","main.py"]
  * JavaScript: image=node:22-slim，文件 main.js，cmd=["node","main.js"]
  * C++: image=gcc:14，文件 main.cpp，先在容器内编译为 /tmp/main，再执行 /tmp/main
- 安全限制：
  * network_mode="none"
  * mem_limit=f"{memory_limit_mb}m"
  * cpu_quota=50000
  * read_only 尽量开启；需要写临时编译产物时只允许容器内 /tmp
  * 每个测试用例 timeout = time_limit_ms / 1000，默认最多 30s
  * 容器运行完成后必须 remove(force=True)
- 执行方式：
  * 对每个测试用例分别运行，向 stdin 写入 input_data
  * 捕获 stdout/stderr/退出码/耗时
  * C++ 编译失败直接返回 error，所有测试用例标记失败，不继续执行
- 返回：
  {
    "status": "success|failed|timeout|error",
    "score": int,
    "max_score": int,
    "tests_passed": int,
    "tests_total": int,
    "results": [...],
    "logs": str | None,
    "execution_time_ms": int
  }

【CodeLab Service】app/services/codelab_service.py
实现 CodeLabService，保持 Router → Service → Model 分层。

- list_codelabs(db, user, filters, page, page_size)
  - 学生只看 is_published=true
  - 教师看自己课程/自己创建的题目；admin 看全部
  - 支持 course_id/chapter_id/language/difficulty/q 筛选
  - 返回 latest_submission、best_score、submissions_count
- get_codelab(db, codelab_id, user)
  - 学生只能访问已发布题目
  - 教师只能访问自己课程/自己创建的题目，admin 不受限
  - 根据 user.role 决定是否返回隐藏测试详情
- create_codelab(db, data, teacher)
  - teacher/admin 权限
  - 校验 course 存在
  - teacher 只能给自己负责的 course 创建题目，admin 不受限
  - 校验 chapter_id 属于 course_id
  - 校验 language、difficulty、time_limit_ms、memory_limit_mb、test_cases
- update_codelab(db, codelab_id, data, user)
  - teacher/admin 权限
  - 仅创建教师、课程教师或 admin 可修改
  - 如果传入 test_cases，则整体替换并保持 order_index
  - 已有提交不删除；修改题目后新提交按新用例评分
- delete_codelab(db, codelab_id, user)
  - teacher/admin 权限
  - 仅创建教师、课程教师或 admin 可删除
  - 删除题目时级联删除测试用例和提交
- publish_codelab(db, codelab_id, user, is_published)
  - 发布前必须至少有 1 个测试用例
  - 发布后学生可见
- run_sample(db, codelab_id, user_id, code)
  - 只跑公开样例，创建 CodeSubmission(mode="run")
- submit_code(db, codelab_id, user_id, code)
  - 跑全部测试用例，创建 CodeSubmission(mode="submit")
  - 保存 result_json；隐藏用例完整结果可入库，但学生响应必须脱敏
- get_my_submissions(db, codelab_id, user_id, page, page_size)
- get_submission_detail(db, submission_id, user)
  - 学生只能看自己的提交且隐藏测试脱敏
  - 题目教师/admin 可查看完整提交详情
- get_codelab_submissions_for_teacher(db, codelab_id, user, page, page_size, student_id optional)
  - 教师/admin 查看某题所有学生提交

【Router】app/routers/codelabs.py，前缀 /api/v1/codelabs
所有响应遵循 README 的统一格式：分页 {"data": [...], "meta": {...}}，单条 {"data": {...}}。
在 app/routers/__init__.py 和 app/main.py 注册 router。

学生/通用接口：
- GET / → 分页列表，查询参数 course_id, chapter_id, language, difficulty, is_published, q, page, page_size
- GET /{codelab_id} → CodeLabResponse
- POST /{codelab_id}/run → 201 SubmissionResponse，只跑公开样例
- POST /{codelab_id}/submit → 201 SubmissionResponse，正式评分
- GET /{codelab_id}/submissions → 当前用户自己的提交历史
- GET /submissions/{submission_id} → SubmissionResponse

教师接口：
- POST / → 201 CodeLabResponse（teacher/admin）
- PUT /{codelab_id} → CodeLabResponse（teacher/admin）
- DELETE /{codelab_id} → 204（teacher/admin）
- PATCH /{codelab_id}/publish → CodeLabResponse，body: {"is_published": true}
- GET /{codelab_id}/teacher → CodeLabResponse，返回全部测试用例（teacher/admin）
- GET /{codelab_id}/submissions/all → 分页查看所有学生提交（teacher/admin）

【错误处理】
- 题目不存在：404
- 无权查看/修改：403
- 发布时没有测试用例：400
- chapter_id 不属于 course_id：400
- language 非 python/javascript/cpp：422 或 400
- Docker 不可用：返回提交 status=error，同时 API 不应崩溃为 500

【后端测试】backend/tests/test_codelabs.py
- teacher 可以创建题目并添加公开/隐藏测试用例
- student 列表只能看到已发布题目
- student 查看题目时看不到隐藏用例输入和期望输出
- run 只执行公开样例，不计入正式最高分
- submit 执行全部用例并按 points 计算 score
- 普通学生不能创建、修改、删除、发布题目
- 非课程教师不能修改其他教师课程中的题目
```

---

### Prompt 7-2 · 代码实训前端

```
实现代码实训的完整前端界面，包含学生练习端和教师题目管理端。

【路由】
在 frontend/src/App.tsx 中接入：
- /codelab → CodeLabListPage（学生/教师都可访问，学生默认只看已发布）
- /codelab/:id → CodeLabDetailPage
- /codelab/manage → CodeLabManagePage（teacher/admin）
- /codelab/new → CodeLabEditorPage（teacher/admin）
- /codelab/:id/edit → CodeLabEditorPage（teacher/admin）

【API 与 Hooks】frontend/src/lib/api.ts
不得在组件里直接 fetch，全部通过 TanStack Query hooks。

类型：
- CodeLabListItem
- CodeLab
- CodeLabTestCase
- CodeLabSubmission
- CodeLabRunResult
- CodeLabCreateInput
- CodeLabUpdateInput

Hooks：
- useCodeLabs(filters, page)
- useCodeLab(id)
- useTeacherCodeLab(id)
- useCreateCodeLab()
- useUpdateCodeLab()
- useDeleteCodeLab()
- usePublishCodeLab()
- useRunCode()
- useSubmitCode()
- useMyCodeSubmissions(codelabId, page)
- useTeacherCodeSubmissions(codelabId, page, studentId?)

【学生端页面和组件】

1. src/pages/CodeLabListPage.tsx
   - 顶部搜索框：按标题/题面关键词搜索，debounce 500ms
   - 筛选：课程、章节、语言、难度
   - 实训卡片：标题、课程、章节、语言标签、难度星级、最高分/满分、提交次数、完成状态
   - teacher/admin 右上角显示“管理题目”“新建题目”入口
   - 空状态和错误状态必须完整

2. src/pages/CodeLabDetailPage.tsx
   布局：
   - 桌面端：左侧题面，右侧代码编辑器，下方控制台；区域可拖拽调整
   - 移动端：题面 / 编辑器 / 控制台纵向排列
   内容：
   - 题面使用 MarkdownRenderer，支持 LaTeX
   - 显示课程、章节、语言、难度、最高分、最近提交状态
   - 公开样例区域显示 input 和 expected_output
   - Monaco Editor 使用 starter_code 初始化
   - localStorage 草稿缓存 key: codelab_{id}_draft
   - 代码变更 debounce 2s 自动保存草稿
   - “重置代码”恢复 starter_code，并二次确认
   - “运行样例”调用 POST /run
   - “提交评分”调用 POST /submit
   - 提交满分 success 时触发 canvas-confetti

3. src/components/codelab/CodeEditor.tsx
   - Monaco Editor，主题 vs-dark
   - 顶部工具栏：语言标签、重置、全屏
   - 右侧按钮：运行样例、提交评分
   - 运行中禁用按钮并显示 loading

4. src/components/codelab/ConsolePanel.tsx
   - Tab：输出 / 测试结果 / 提交历史
   - 输出：monospace 展示 logs、编译错误、运行错误
   - 测试结果：
     * 进度条显示 score / max_score
     * 公开用例显示输入、期望输出、实际输出
     * 隐藏用例只显示是否通过和分值，不显示任何隐藏内容
   - 提交历史：时间、模式(run/submit)、状态、得分、用例通过数、耗时

5. src/components/codelab/SubmissionHistory.tsx
   - 列表显示历史提交
   - 点击行展开只读代码和测试结果
   - 状态徽章：
     success 绿色 / failed 红色 / error 橙色 / timeout 紫色 / running 蓝色

【教师端页面和组件】

1. src/pages/CodeLabManagePage.tsx
   - teacher/admin 专用页面
   - 表格列：标题、课程、章节、语言、难度、发布状态、满分、测试用例数、提交次数、创建时间、操作
   - 筛选：课程、发布状态、语言、难度、关键词
   - 操作：
     * 编辑题目
     * 发布/下架
     * 查看提交
     * 删除题目（红色危险按钮，二次确认）
   - 教师只能看到自己负责课程或自己创建的题目，admin 可看到全部

2. src/pages/CodeLabEditorPage.tsx
   用于新建和编辑题目。
   表单字段：
   - 标题
   - 所属课程（必选）
   - 所属章节（可选；选择课程后只显示该课程章节）
   - 语言（python/javascript/cpp）
   - 难度（1-5）
   - 时间限制 time_limit_ms
   - 内存限制 memory_limit_mb
   - starter_code（Monaco Editor）
   - description（Markdown 编辑 + 预览）
   - is_published 开关
   - 测试用例编辑器
   保存逻辑：
   - “保存草稿”：is_published=false
   - “保存并发布”：前端先校验至少 1 个测试用例，再提交
   - 后端返回发布失败时显示具体错误

3. src/components/codelab/TestCaseEditor.tsx
   - 支持新增、编辑、删除、排序测试用例
   - 字段：名称、输入 stdin、期望输出 stdout、分值、是否隐藏
   - 公开样例和隐藏评分用例视觉上区分
   - 分值必须为正整数
   - 至少保留一个测试用例
   - 隐藏用例在教师端可完整编辑，在学生端绝不渲染输入/期望输出

4. src/components/codelab/TeacherSubmissionTable.tsx
   - 在管理页或题目详情教师区域展示
   - 列：学生、提交时间、状态、得分、通过用例数、耗时、模式
   - 点击查看提交代码和完整测试结果
   - 支持按 student_id 筛选

【课程页面集成】
- 在 CourseDetailPage 的章节学习界面中，章节下方增加“本章实训”区域：
  * 只显示该 course_id + chapter_id 下已发布的题目
  * 学生点击进入 /codelab/:id
- 在 CourseEditorPage 中增加“实训题目”管理入口：
  * 展示当前课程下的题目
  * 可跳转新建题目，并自动带上 course_id
  * 可编辑已有题目

【交互与可用性】
- 所有异步操作必须有 loading / error / empty state。
- 删除、重置代码、下架题目必须二次确认。
- 学生提交后 invalidate:
  * ['codelabs']
  * ['codelabs', id]
  * ['codelabs', id, 'submissions']
- 教师保存题目后 invalidate:
  * ['codelabs']
  * ['codelabs', id]
  * ['teacher-codelabs']
- TypeScript 禁止 any；Props 用 interface。
- 单组件超过 200 行必须拆分。
```

---

### Prompt 7-3 · 代码实训验收与种子题

```
完成 Phase 7 后，必须用 teacher 账户创建一组可真实验证的实训题，并用 student 账户完成一次运行和提交。

【种子题】
使用 teacher@example.com / Password123 登录，创建并发布：
- 课程：选择已有课程；如果没有课程，则先用教师账号创建一门“高等数学实训课”
- 章节：选择已有章节；如果没有章节，则创建“函数与极限”
- 题目标题：计算数列前 n 项和
- 语言：python
- 难度：2
- 题面：
  给定正整数 n，输出 1 + 2 + ... + n 的结果。
  输入一行整数 n，输出一行整数。
- starter_code:
  n = int(input())
  # 在这里补全代码
- 公开样例：
  * name: 样例1，input: 5，expected_output: 15，points: 10
  * name: 样例2，input: 100，expected_output: 5050，points: 10
- 隐藏用例：
  * name: 边界 n=1，input: 1，expected_output: 1，points: 20
  * name: 大数 n=10000，input: 10000，expected_output: 50005000，points: 60
- 满分：100

【手工验收】
1. 教师可以在 /codelab/manage 看到题目，编辑题面和测试用例后保存成功。
2. 未发布时学生在 /codelab 看不到题目；发布后可见。
3. 学生进入题目详情，只能看到公开样例，看不到隐藏用例输入和期望输出。
4. 学生点击“运行样例”，只执行公开样例并显示 20/20。
5. 学生提交错误代码，返回 failed，分数按通过用例 points 计算。
6. 学生提交正确代码，返回 success，score=100，触发庆祝动画。
7. 教师可以查看该题所有学生提交和完整测试结果。
8. 普通学生访问 /codelab/manage 或调用教师接口应被拒绝。

【自动化验证】
- 后端：新增/更新 pytest，覆盖权限、隐藏用例脱敏、评分、run/submit 区分。
- 前端：至少运行 npm run build，确保 TypeScript 类型通过。
- 如果 Docker 未启动，后端接口应返回提交 status=error，而不是让 API 服务崩溃。
```
