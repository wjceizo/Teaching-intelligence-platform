# 数学教育智能体平台

> **⚠️ AI 编码助手必读 — 本文件是最高优先级约束，任何情况下不得违反**

---

## 项目简介

面向高校数学教学的 AI 驱动学习平台，提供智能问答、课程管理、代码实训、在线测验和学习分析功能。

---

## 严格约束（AI 助手必须遵守）

### 🚫 禁止行为

1. **禁止自行引入未在本文件列出的任何第三方库**
   - 如果认为需要新依赖，必须先暂停并向用户说明：需要哪个库、用途、为什么现有库无法满足
   - 用户确认后才可以安装

2. **禁止改变项目目录结构**
   - 不得新增顶层目录
   - 不得将文件移动到约定位置以外的地方
   - 不得重命名已有的模块/包

3. **禁止替换已选定的技术方案**
   - 例：不得用 Django / Flask 替换 FastAPI
   - 例：不得用 axios 替换 fetch
   - 例：不得用 Prisma / Tortoise 替换 SQLAlchemy
   - 例：不得用 Redux / Jotai 替换 Zustand
   - 例：不得用 SWR 替换 TanStack Query

4. **禁止生成"示意代码"或"伪代码"**
   - 所有代码必须真实可运行，不得出现 `# TODO`、`pass`（除接口占位）、`...` 省略关键逻辑

5. **禁止跳过错误处理**
   - 每个 API 路由必须有 try/except 或 FastAPI HTTPException 处理
   - 每个前端异步操作必须有 error state 处理

6. **禁止使用 `any` 类型（TypeScript）**
   - 所有变量、函数参数、返回值必须有明确类型
   - 确实无法确定类型时使用 `unknown` 并做类型收窄

7. **禁止在 async 路由中使用同步阻塞调用**
   - 不得使用 `time.sleep()`，使用 `asyncio.sleep()`
   - 不得在 async 函数中直接调用同步 I/O，使用 `run_in_executor`

8. **禁止硬编码任何配置值**
   - URL、密钥、超时时间、模型名称等全部从 `config.py` / `.env` 读取

9. **禁止在生产代码中使用 `print()`**
   - 后端统一使用 `structlog` 记录日志
   - 前端统一使用 `console.error()` 仅记录错误，不用 `console.log`

10. **禁止直接修改数据库 Schema**
    - 所有数据库变更必须通过 Alembic 迁移文件完成
    - 不得手写 `CREATE TABLE` / `ALTER TABLE` 直接执行

---

## 技术栈（锁定版本，不得更改）

### 后端

| 库 | 版本约束 | 用途 | 禁止替换为 |
|----|---------|------|-----------|
| Python | 3.12+ | 运行时 | — |
| FastAPI | 0.115+ | Web 框架 | Flask, Django, Litestar |
| Pydantic | v2（2.7+） | 数据验证 | marshmallow, attrs |
| SQLAlchemy | 2.0+（async） | ORM | Tortoise, Prisma, raw SQL |
| Alembic | 1.13+ | 数据库迁移 | 手写 DDL |
| asyncpg | 0.29+ | PG 异步驱动 | psycopg2, psycopg3 |
| redis.asyncio | 5.0+ | 缓存 | aioredis（已合并） |
| python-jose | 3.3+ | JWT | PyJWT |
| passlib + bcrypt | 最新 | 密码哈希 | hashlib |
| anthropic | 最新 | Claude API | — |
| langchain | 0.3+ | RAG 框架 | llama-index |
| langchain-anthropic | 最新 | Claude LangChain 集成 | — |
| langchain-openai | 最新 | Embedding | — |
| pymilvus | 2.4+ | 向量数据库客户端 | weaviate, qdrant |
| celery | 5.3+ | 异步任务队列 | rq, arq |
| structlog | 最新 | 结构化日志 | loguru, logging |
| docker（SDK） | 7.0+ | 沙箱执行 | subprocess 直接调用 |
| pytest + httpx | 最新 | 测试 | unittest |
| uv | 最新 | 包管理 | pip, poetry, conda |

### 前端

| 库 | 版本约束 | 用途 | 禁止替换为 |
|----|---------|------|-----------|
| React | 19+ | UI 框架 | Vue, Svelte, Solid |
| TypeScript | 5.5+ | 类型系统 | JavaScript（禁止降级） |
| Vite | 6+ | 构建工具 | webpack, parcel, esbuild |
| Tailwind CSS | 4+ | 样式 | styled-components, emotion, CSS Modules |
| shadcn/ui | 最新 | 组件库 | MUI, Ant Design, Chakra |
| React Router | 7+ | 路由 | Next.js, TanStack Router |
| Zustand | 5+ | 全局状态 | Redux, Jotai, Recoil, MobX |
| TanStack Query | v5 | 服务端状态 | SWR, React Query v3, useSWR |
| react-markdown | 最新 | Markdown 渲染 | marked, markdown-it |
| remark-math + rehype-katex | 最新 | LaTeX 渲染 | MathJax |
| Monaco Editor | 0.50+ | 代码编辑器 | CodeMirror, Ace |
| Recharts | 2+ | 图表 | Chart.js, ECharts, Victory |
| React Hook Form | 7+ | 表单 | Formik |
| Zod | 3+ | Schema 验证 | Yup, Joi |
| @dnd-kit/sortable | 最新 | 拖拽排序 | react-beautiful-dnd |
| canvas-confetti | 最新 | 庆祝动效 | — |

### 基础设施

| 服务 | 版本 | 禁止替换为 |
|------|------|-----------|
| PostgreSQL | 16+ | MySQL, SQLite（生产） |
| Redis | 7.2+ | Memcached |
| Milvus | 2.4+ | Chroma, Weaviate, Pinecone |
| MinIO | 最新 | AWS S3（本地开发） |
| Docker + Docker Compose | 最新 | Podman |
| Nginx | 最新 | Caddy, Traefik（除非用户指定） |

---

## 目录结构（不得更改）

```
math-edu-platform/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── models/          # SQLAlchemy 模型
│   │   ├── schemas/         # Pydantic v2 模型
│   │   ├── routers/         # FastAPI 路由
│   │   ├── services/        # 业务逻辑
│   │   └── tasks/           # Celery 任务
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui 组件（只读，不手写）
│   │   │   ├── layout/
│   │   │   ├── course/
│   │   │   ├── qa/
│   │   │   ├── note/
│   │   │   ├── exam/
│   │   │   ├── codelab/
│   │   │   ├── proof/
│   │   │   └── dashboard/
│   │   ├── pages/
│   │   ├── stores/          # Zustand stores（仅 authStore + uiStore）
│   │   ├── lib/
│   │   │   ├── api.ts       # fetch 封装 + TanStack Query hooks
│   │   │   └── utils.ts
│   │   ├── hooks/           # 自定义 React Hooks
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml       # 开发环境
├── docker-compose.prod.yml  # 生产环境
├── .env.example
└── README.md                # 本文件
```

---

## 代码规范

### 后端规范

**分层职责（严格遵守，不得跨层调用）：**
```
Router → Service → Model（通过 SQLAlchemy session）
         ↓
      外部服务（AI、Redis、Milvus、Docker）
```

- `routers/`：只做参数解析、调用 service、返回响应，**不写业务逻辑**
- `services/`：所有业务逻辑，**不直接操作 HTTP request/response 对象**
- `models/`：只有 SQLAlchemy 模型定义，**不写业务方法**
- `schemas/`：只有 Pydantic 模型，**不引入 SQLAlchemy**

**命名规范：**
```python
# 路由文件：复数名词
routers/courses.py, routers/questions.py

# Service 类：单数 + Service
class CourseService, class AIService

# Schema：动词/形容词 + 名词 + 场景
class CourseCreate, class CourseResponse, class CourseUpdate

# 异步函数：全部 async def
async def get_course(db: AsyncSession, course_id: str) -> Course | None:
```

**统一响应格式：**
```python
# 成功（分页）
{"data": [...], "meta": {"page": 1, "page_size": 20, "total": 100}}

# 成功（单条）
{"data": {...}}

# 错误
{"detail": "错误信息"}  # FastAPI 默认格式，不得自定义为其他 key
```

**数据库操作规范：**
```python
# ✅ 正确：使用 SQLAlchemy 2.0 select 语法
from sqlalchemy import select
result = await db.execute(select(Course).where(Course.id == course_id))
course = result.scalar_one_or_none()

# ❌ 错误：使用旧版 Query API
course = db.query(Course).filter(Course.id == course_id).first()
```

### 前端规范

**组件规范：**
- 单个组件文件不超过 **200 行**，超过必须拆分
- Props 必须定义 `interface`，不用 `type`（保持一致性）
- 不得在组件内直接 `fetch`，统一通过 `lib/api.ts` 的 TanStack Query hooks

**状态管理规范：**
```typescript
// Zustand 只存两类数据：
// 1. authStore：认证信息（user, token）
// 2. uiStore：UI 状态（sidebarOpen, theme）

// 服务端数据全部用 TanStack Query 管理，不放进 Zustand
// ❌ 禁止这样做：
const useCourseStore = create(() => ({ courses: [] }))

// ✅ 正确做法：
const { data: courses } = useCourses(page, pageSize)
```

**TanStack Query 规范：**
```typescript
// queryKey 命名规范：['资源名', id?, 参数对象?]
queryKey: ['courses']
queryKey: ['courses', courseId]
queryKey: ['courses', courseId, 'chapters']
queryKey: ['questions', { courseId, type, status }]
```

**样式规范：**
- 只用 Tailwind CSS utility class，**不写内联 style**（除动态计算值）
- 不新建 `.css` 文件（除 `globals.css`）
- 暗色模式通过 `dark:` 前缀实现，不用 JS 切换 class 以外的方式

---

## 环境变量（必须全部在 .env 中配置）

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://app:secret@localhost:5432/mathplatform

# 缓存
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=<随机32字符以上>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7


# 向量数据库
MILVUS_HOST=localhost
MILVUS_PORT=19530

# 对象存储
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=math-platform

# 应用
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000
APP_VERSION=0.1.0
```

---

## 开发启动流程

```bash
# 1. 启动基础设施
docker compose up -d postgres redis milvus minio

# 2. 后端
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# 3. 前端
cd frontend
npm install
npm run dev          # 启动在 http://localhost:3000

# 4. Celery Worker（AI 索引任务）
cd backend
uv run celery -A app.tasks.celery_app worker --loglevel=info
```

---

## AI 助手行为准则

> 以下规则适用于所有 AI 编码助手（Claude Code、Cursor、Windsurf 等）

### 遇到以下情况时，必须先询问用户，不得自行决定：

| 情况 | 正确行为 |
|------|---------|
| 认为需要引入新的第三方库 | 说明需求，等待用户确认 |
| 现有目录结构无法满足需求 | 提出方案，等待用户确认 |
| 需要修改数据库 Schema | 说明变更内容，生成 Alembic 迁移文件，等待确认后执行 |
| 对技术选型有不同意见 | 可以提出，但最终听从本文件的规定 |
| 任务超出当前 Phase 范围 | 明确告知用户，不擅自实现 |

### 每次生成代码前，必须确认：

- [ ] 所有导入的库都在本文件的技术栈列表中
- [ ] 文件位置符合目录结构规范
- [ ] 没有硬编码的配置值
- [ ] 异步函数没有同步阻塞调用
- [ ] TypeScript 代码没有 `any` 类型
- [ ] 有完整的错误处理

### 代码修改原则：

- **最小改动**：只修改任务要求的代码，不"顺手"重构其他文件
- **不删除注释**：已有的注释和 TODO 不得删除（除非用户明确要求）
- **保持风格一致**：新代码的命名和格式与周围代码保持一致
- **测试优先**：新增功能时同步在 `tests/` 下添加对应测试

---

*本文件由项目负责人维护，AI 助手不得修改本文件内容。*
