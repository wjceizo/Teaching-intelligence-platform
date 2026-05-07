# 数学教育智能体平台 · Vibe Coding Prompt 指南（Phase 0 & 1）

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

---

## Phase 0 · 部署基础数据库

### Prompt 0-1 · 使用 Docker Compose 启动基础设施

```text
你是一名资深 DevOps 工程师。请在项目根目录 `math-edu-platform/` 完成基础设施部署配置，严格遵守以下约束并输出可直接运行的文件内容。

【硬性约束（必须遵守）】
1. 不新增顶层目录，不改动既有目录结构。
2. 只修改/创建以下文件：
   - docker-compose.yml
   - .env.example
3. 服务必须可通过 `docker compose up -d postgres redis milvus minio` 启动。
4. 端口与 README 对齐：
   - PostgreSQL: 5432
   - Redis: 6379
   - Milvus: 19530（可保留管理端口 9091）
   - MinIO: 9000（API）与 9001（Console）
5. 配置需要支持后端 `asyncpg` 连接（即 DATABASE_URL 使用 `postgresql+asyncpg://...`）。

【服务要求】
1. postgres:16
   - 初始化库名、用户名、密码（与 .env.example 对齐）
   - 持久化 volume
   - 健康检查
2. redis:7.2
   - 持久化 volume
   - 健康检查
3. milvus:v2.4（standalone）
   - 可运行的最小依赖（若需要 etcd/minio 依赖请在 compose 内声明）
   - 对外暴露 19530
4. minio
   - Root 用户名/密码来自 .env.example
   - 对外暴露 9000 和 9001
   - 持久化 volume

【.env.example 要求】
至少包含并给出示例值：
- DATABASE_URL=postgresql+asyncpg://app:secret@localhost:5432/mathplatform
- REDIS_URL=redis://localhost:6379/0
- MILVUS_HOST=localhost
- MILVUS_PORT=19530
- MINIO_ENDPOINT=localhost:9000
- MINIO_ACCESS_KEY=minioadmin
- MINIO_SECRET_KEY=minioadmin
- MINIO_BUCKET=math-platform
- DEBUG=true
- ALLOWED_ORIGINS=http://localhost:3000
- APP_VERSION=0.1.0

【输出要求】
1. 给出完整 `docker-compose.yml`（可直接运行）。
2. 给出完整 `.env.example`。
3. 给出启动和验证命令：
   - `docker compose up -d postgres redis milvus minio`
   - `docker compose ps`
   - 每个服务的健康检查方式。
```

---

## Phase 1 · 项目脚手架 & 基础设施

### Prompt 1-1 · 后端项目初始化（FastAPI）

```text
你是一名资深 Python 后端工程师。请初始化 `backend/` 项目，要求严格遵守以下规范并输出完整可运行代码。

【技术栈（仅限以下，不得引入其他库）】
- Python 3.12+
- 包管理：uv
- FastAPI 0.115+
- Pydantic v2
- SQLAlchemy 2.0（异步）+ asyncpg
- Alembic
- redis.asyncio
- python-jose
- passlib + bcrypt
- celery
- structlog
- pytest + httpx
- anthropic、langchain、langchain-anthropic、langchain-openai、pymilvus（先安装，后续 Phase 使用）

【目录结构（必须严格一致）】
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── dependencies.py
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   ├── routers/
│   │   └── __init__.py
│   ├── services/
│   │   └── __init__.py
│   └── tasks/
│       ├── __init__.py
│       └── celery_app.py
├── alembic/
├── tests/
│   └── test_health.py
├── pyproject.toml
└── .env.example

【具体要求】
1. `pyproject.toml`
   - 使用 uv 可管理的标准格式（project + dependencies）。
   - 配置开发依赖（pytest、httpx）。
2. `config.py`
   - 不使用未在技术栈中的三方配置库。
   - 从环境变量读取并集中管理：
     `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`JWT_ALGORITHM`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`REFRESH_TOKEN_EXPIRE_DAYS`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`MILVUS_HOST`、`MILVUS_PORT`、`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`、`DEBUG`、`ALLOWED_ORIGINS`、`APP_VERSION`。
3. `database.py`
   - `create_async_engine` + `async_sessionmaker`。
   - 提供 `Base` 与 `get_db()`（async generator）。
4. `main.py`
   - 创建 FastAPI 应用。
   - 注册 CORS（来源于 config）。
   - 提供统一异常处理（HTTPException 与兜底异常）。
   - 提供 `GET /health`，返回 `{ "data": { "status": "ok", "version": "..." } }`。
5. `dependencies.py`
   - 提供 `get_db` re-export。
   - 预留 `get_current_user` 的安全占位实现（不写伪代码，需可运行并有错误处理）。
6. `tasks/celery_app.py`
   - 初始化 Celery app，broker/backend 来自 `REDIS_URL`。
7. `.env.example`
   - 与 README 保持一致，补齐后端所有必填变量。
8. 测试
   - `tests/test_health.py` 使用 `httpx` + `pytest` 验证 `/health` 200 与返回结构。

【编码规范】
- 不得出现 `print()`。
- 所有错误有明确处理。
- 不得出现伪代码或省略号。
- 保持后续可扩展到 Router → Service → Model 分层。

请输出所有新增/修改文件的完整代码。
```

---

### Prompt 1-2 · 前端项目初始化（Vite + React + TS）

```text
你是一名资深前端工程师。请初始化 `frontend/` 项目，要求如下，并输出完整可运行代码。

【技术栈（仅限以下）】
- React 19 + TypeScript 5.5+
- Vite 6+
- Tailwind CSS 4+
- shadcn/ui
- React Router 7+
- Zustand 5+
- TanStack Query v5
- react-markdown
- remark-math + rehype-katex
- Monaco Editor
- Recharts
- React Hook Form
- Zod
- @dnd-kit/sortable
- canvas-confetti

【目录结构（必须严格一致）】
frontend/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │       ├── AppLayout.tsx
│   │       ├── TopNav.tsx
│   │       └── Sidebar.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── DashboardPage.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json

【具体要求】
1. Tailwind
   - 配置 Tailwind CSS 4。
   - 在 `globals.css` 定义亮色/暗色主题变量：`--background`、`--foreground`、`--primary`、`--muted`、`--border`。
2. 状态管理
   - `authStore.ts`：仅包含 `user`、`token`、`isAuthenticated`、`login`、`logout`，使用 `persist`。
   - `uiStore.ts`：仅包含 `sidebarOpen`、`theme` 与切换方法。
   - 严禁把课程/问答等服务端数据放进 Zustand。
3. `lib/api.ts`
   - 封装 `fetch` 请求。
   - 自动注入 `Authorization: Bearer <token>`。
   - 遇到 401 自动调用 `authStore.logout()`。
   - 提供基础 query hooks 示例（TanStack Query）。
4. 布局组件
   - `AppLayout`：TopNav + Sidebar + 主内容区，桌面与移动端可用。
   - `TopNav`：Logo、主题切换、用户菜单（个人中心、退出）。
   - `Sidebar`：仪表盘、课程、问答、笔记、实训、测验导航入口。
5. 路由
   - `App.tsx` 配置 `React Router`。
   - 提供 `ProtectedRoute`，未登录跳转 `/login`。
6. 工程配置
   - `vite.config.ts` 配置 `/api` 代理到 `http://localhost:8000`。
7. 代码质量
   - TypeScript 禁止使用 `any`。
   - 每个异步操作有错误处理。
   - 单文件尽量不超过 200 行。

请输出完整代码，确保 `npm install && npm run dev` 可启动。
```

---

### Prompt 1-3 · 前后端联调自检

```text
请在不引入新依赖的前提下，完成 Phase 1 的联调自检清单并输出结果：

1. 后端：`uv run uvicorn app.main:app --reload --port 8000` 可启动。
2. 前端：`npm run dev` 可启动在 `http://localhost:3000`。
3. 打开前端后，请验证：
   - 未登录访问受保护路由会跳转 `/login`
   - 登录态写入 localStorage（persist）
   - 携带 token 的 API 请求头正确
   - 后端 `/health` 可访问
4. 输出：
   - 运行命令
   - 关键验证截图/日志要点
   - 发现的问题与修复建议（若无则明确写“无阻塞问题”）
```

---

以上 Prompt 可直接按 `Phase 0 -> Phase 1-1 -> Phase 1-2 -> Phase 1-3` 顺序执行。
