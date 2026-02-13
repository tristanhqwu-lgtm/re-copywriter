# RE调香室 AI文案助手 - 设计文档

> 日期: 2026-02-13
> 状态: 已批准

## 1. 项目概述

RE调香室 AI文案助手是一个面向销售团队的小红书/抖音风格香水营销文案生成工具。用户可以学习博主的写作风格，结合产品信息，自动生成高质量的社交媒体文案。

### 核心功能
1. **博主风格学习** - 抓取/粘贴博主文章，AI 提取写作风格特征，支持多篇综合分析
2. **产品信息管理** - 管理 50+ 款香水产品，支持 CSV 批量导入
3. **文案生成** - 选择风格 + 产品 + 场景，一键生成多版本文案
4. **节日/场景模板** - 内置常见节日和场景，支持自定义
5. **用户账号系统** - 销售人员独立账号，追踪使用数据

## 2. 技术选型

| 层面 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python) |
| 数据库 | SQLite + SQLAlchemy |
| AI 模型 | Claude Sonnet 4.5 (Anthropic API) |
| 内容抓取 | Playwright (无头 Chromium) |
| 认证 | JWT Token |
| 异步任务 | FastAPI BackgroundTasks + SSE |
| 前端框架 | React + TypeScript + Vite |
| 样式 | Tailwind CSS |
| HTTP 客户端 | axios |

## 3. 系统架构

```
┌──────────────────────────────────────────────────┐
│                   Frontend (React + Vite)         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
│  │工作台│ │风格库│ │产品库│ │场景库│ │  我的  │ │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘ │
│     └─────┬──┴────┬───┴────┬───┴──────────┘      │
│           │  API Client (axios)  │                │
│           │  + SSE EventSource   │                │
└───────────┼──────────────────────┼────────────────┘
            │        HTTP         │ SSE
┌───────────┼──────────────────────┼────────────────┐
│           │   FastAPI Backend    │                 │
│  ┌────────┴──────────────────────┴───────────┐    │
│  │              API Router Layer              │    │
│  │  /auth  /products  /styles  /scenes /gen   │    │
│  └─────────────────┬─────────────────────────┘    │
│  ┌─────────────────┴─────────────────────────┐    │
│  │            Service Layer                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │    │
│  │  │ Scraper  │ │ Analyzer │ │ Generator  │ │    │
│  │  │Playwright│ │Claude API│ │ Claude API │ │    │
│  │  └──────────┘ └──────────┘ └────────────┘ │    │
│  └─────────────────┬─────────────────────────┘    │
│  ┌─────────────────┴─────────────────────────┐    │
│  │          SQLite + SQLAlchemy               │    │
│  │  Users | Products | Styles | Scenes | Copy │    │
│  └───────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

**关键架构决策：**
- **异步任务架构（方案 B）**：Playwright 抓取和 Claude API 调用都是耗时操作（5-30秒），使用 FastAPI BackgroundTasks 异步执行，通过 SSE 推送进度到前端
- 前后端通过 REST API 通信
- SQLite 存储所有数据，轻量部署
- JWT 认证

## 4. 数据模型

### User（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| username | str unique | 用户名 |
| password_hash | str | 密码哈希 |
| display_name | str | 显示名称 |
| role | str | admin / member |
| created_at | datetime | 创建时间 |

### Product（产品）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| name | str | 产品名称 |
| top_notes | str | 前调 |
| middle_notes | str | 中调 |
| base_notes | str | 后调 |
| price | float | 价格 |
| spec | str | 规格 |
| scenarios | JSON str | 适用场景 |
| brand_story | text | 品牌/产品故事 |
| image_url | str | 产品图片URL |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### StyleTemplate（风格模板）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| name | str | 模板名称 |
| description | str | 风格描述 |
| style_features | JSON | AI 提取的风格特征 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

**style_features JSON 结构：**
```json
{
  "tone": "活泼俏皮",
  "vocabulary": ["绝绝子", "yyds", "姐妹们"],
  "sentence_patterns": ["短句为主，多用感叹号"],
  "emoji_style": "大量使用🌸💕✨",
  "structure": "开头hook+中间体验+结尾推荐",
  "emotional_expression": "感性热情",
  "title_style": "疑问句+emoji开头",
  "summary": "整体风格总结..."
}
```

### StyleSource（风格来源文章）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| style_id | int FK | 关联风格模板 |
| platform | str | xiaohongshu / douyin |
| source_url | str | 原文链接（可选）|
| source_content | text | 原文内容 |
| created_at | datetime | 创建时间 |

### SceneTemplate（场景模板）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| name | str | 场景名称 |
| type | str | festival / scene / custom |
| description | text | 场景描述 |
| keywords | JSON str | 关键词 |
| prompt_hint | text | AI 场景提示语 |
| is_builtin | bool | 是否内置 |
| created_at | datetime | 创建时间 |

### GeneratedCopy（生成文案）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 主键 |
| user_id | int FK | 关联用户 |
| product_id | int FK | 关联产品 |
| style_id | int FK | 关联风格 |
| scene_id | int FK nullable | 关联场景 |
| title | str | 文案标题 |
| content | text | 文案正文 |
| hashtags | JSON str | 话题标签 |
| version | int | 版本号 |
| is_favorite | bool | 是否收藏 |
| rating | int | 用户评分 1-5 |
| created_at | datetime | 创建时间 |

### AsyncTask（异步任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | str UUID PK | 主键 |
| type | str | scrape / analyze / generate |
| status | str | pending / running / completed / failed |
| progress | int | 进度 0-100 |
| result | JSON | 任务结果 |
| error | str | 错误信息 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

## 5. API 设计

### 认证 `/api/auth`
| Method | Path | 说明 |
|--------|------|------|
| POST | `/register` | 注册 |
| POST | `/login` | 登录，返回 JWT |
| GET | `/me` | 当前用户信息 |

### 产品 `/api/products`
| Method | Path | 说明 |
|--------|------|------|
| GET | `/` | 列表（搜索、分页）|
| GET | `/{id}` | 详情 |
| POST | `/` | 添加 |
| PUT | `/{id}` | 编辑 |
| DELETE | `/{id}` | 删除 |
| POST | `/import` | CSV 批量导入 |

### 风格 `/api/styles`
| Method | Path | 说明 |
|--------|------|------|
| GET | `/` | 列表 |
| GET | `/{id}` | 详情（含来源文章）|
| POST | `/` | 创建 |
| PUT | `/{id}` | 编辑 |
| DELETE | `/{id}` | 删除 |
| POST | `/{id}/sources` | 添加来源文章 |
| DELETE | `/{id}/sources/{source_id}` | 删除来源文章 |
| POST | `/{id}/analyze` | 触发风格分析（异步）|

### 场景 `/api/scenes`
| Method | Path | 说明 |
|--------|------|------|
| GET | `/` | 列表（按类型筛选）|
| POST | `/` | 添加 |
| PUT | `/{id}` | 编辑 |
| DELETE | `/{id}` | 删除 |

### 文案生成 `/api/generate`
| Method | Path | 说明 |
|--------|------|------|
| POST | `/` | 发起生成（异步）|
| GET | `/history` | 历史列表 |
| GET | `/history/{id}` | 文案详情 |
| PUT | `/history/{id}` | 更新收藏/评分 |
| POST | `/refine` | 微调/重新生成 |

### 抓取 `/api/scrape`
| Method | Path | 说明 |
|--------|------|------|
| POST | `/` | 提交链接抓取（异步，小红书/抖音）|

### 任务 `/api/tasks`
| Method | Path | 说明 |
|--------|------|------|
| GET | `/{task_id}` | 查询状态 |
| GET | `/{task_id}/stream` | SSE 推送进度 |

## 6. 前端设计

### 页面结构（底部 Tab 导航）
1. **工作台** - 文案生成核心流程
2. **风格库** - 博主风格管理
3. **产品库** - 产品管理
4. **场景库** - 场景模板管理
5. **我的** - 历史记录 + 设置

### 工作台页面
- 三步操作流：选风格 → 选产品 → 选场景（可选）
- 横向滑动卡片选择，选中高亮
- 「生成文案」按钮，可选生成数量（1-3篇）
- 生成中展示进度动画
- 结果卡片：复制全文、收藏、重新生成、微调

### 风格库页面
- 搜索 + 新增按钮
- 卡片列表（风格名称、平台图标、来源文章数、风格标签）
- 添加流程：输入名称 → 选平台（小红书/抖音）→ 粘贴内容或链接 → 可添加多篇 → AI 分析
- 详情页：分析结果 + 来源文章列表

### 产品库页面
- 搜索 + 新增/导入按钮
- 卡片列表（产品名 + 价格 + 调性摘要）
- 详情/编辑表单
- CSV 导入（含模板下载）

### 场景库页面
- 节日模板 / 场景模板分区
- 内置（不可删除）+ 自定义（可编辑）
- 卡片：场景名 + 关键词 + 描述

### 我的页面
- 历史文案列表（时间倒序）
- 收藏专区
- 个人信息设置

### UI 风格
- 主色：#8B2252（酒红色）
- 辅色：#F5E6CC（暖米色）、#FFF5EE（浅肉色背景）
- 圆角卡片：border-radius 16px
- 柔和阴影
- 底部固定导航栏
- 移动端优先（430px 基准）

## 7. 核心模块设计

### 7.1 内容抓取模块 (Scraper)

**支持平台：**
- **小红书**：`xhslink.com` 短链 + `xiaohongshu.com` 长链
- **抖音**：`v.douyin.com` 短链 + `douyin.com` 长链

**实现：**
- Playwright 无头 Chromium 浏览器
- 打开链接 → 等待渲染 → 提取正文、标题、标签
- 小红书：笔记标题 + 正文 + 话题标签
- 抖音：视频描述 + 话题标签（图文则提取完整内容）
- 自动识别平台类型
- 失败时返回错误，引导手动粘贴

### 7.2 风格分析引擎 (Analyzer)

**流程：**
1. 收集风格模板下所有来源文章
2. Claude API 分析提取：
   - 语气调性、用词习惯、句式结构
   - 情感表达、排版特征、Emoji 使用
   - 标题风格、整体总结
3. 多篇文章时综合分析找共性
4. 结果存入 style_features JSON

### 7.3 文案生成引擎 (Generator)

**输入：** 风格模板 + 产品信息 + 场景（可选）+ 生成数量

**Prompt 策略：**
- System prompt 设定角色（专业小红书香水文案写手）
- 注入风格特征 + 原文样本
- 注入产品详细信息
- 可选注入场景描述和关键词
- 要求输出：标题（15-25字含emoji）+ 正文（300-500字）+ 话题标签（5-8个）
- 支持多版本生成

**微调：** 传入原文案 + 修改意见，AI 在原基础上调整。

## 8. 项目结构

```
re-copywriter/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置（API keys, DB path）
│   ├── database.py          # SQLAlchemy 连接
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic schemas
│   ├── auth.py              # JWT 认证
│   ├── routers/
│   │   ├── auth.py          # 认证路由
│   │   ├── products.py      # 产品路由
│   │   ├── styles.py        # 风格路由
│   │   ├── scenes.py        # 场景路由
│   │   ├── generate.py      # 生成路由
│   │   ├── scrape.py        # 抓取路由
│   │   └── tasks.py         # 任务状态路由
│   ├── services/
│   │   ├── scraper.py       # Playwright 抓取
│   │   ├── analyzer.py      # 风格分析（Claude API）
│   │   └── generator.py     # 文案生成（Claude API）
│   ├── seed.py              # 初始数据（内置场景）
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api/             # API 客户端
│   │   │   └── client.ts
│   │   ├── pages/
│   │   │   ├── Workbench.tsx
│   │   │   ├── StyleLibrary.tsx
│   │   │   ├── ProductLibrary.tsx
│   │   │   ├── SceneLibrary.tsx
│   │   │   └── Profile.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── ...
│   │   └── types/
│   │       └── index.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── docs/
│   └── plans/
└── CLAUDE.md
```

## 9. 部署

- 开发环境：前端 `vite dev` (port 5173) + 后端 `uvicorn` (port 8000)
- 前端代理后端 API（vite.config.ts proxy）
- 环境变量：`.env` 文件配置 ANTHROPIC_API_KEY、JWT_SECRET 等
- 后续可部署到云服务器（Docker 打包）
