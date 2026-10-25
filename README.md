# 情归纸笔 · 班级周边订购系统

一个面向班级团购的小型订购与统计应用。学生用姓名和学号确认身份后挑选周边、提交订单；管理员用口令登录后台查看班级汇总、核对个人订单并导出 Excel 明细表。

## 功能

- **学生端**：花名册选人、商品分类与价目表、购物车、订单备注、提交 / 修改 / 删除订单、回执与订单查询
- **管理端**：口令登录、订购人数 / 件数 / 金额汇总、商品分类统计、按姓名或学号搜索、导出 Excel
- **服务端**：tRPC + Hono、Drizzle ORM + MySQL、请求级日志关联（浏览器与服务端共用一份 JSONL 日志）

## 技术栈

React 19 · TypeScript · Vite 7 · Tailwind CSS 3 · shadcn/ui · tRPC 11 · Hono · Drizzle ORM · MySQL · ExcelJS · Vitest

## 快速开始

要求 Node.js 20+ 和 MySQL 8+。

```bash
# 1. 安装依赖
npm ci

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写 DATABASE_URL 和 ADMIN_KEY

# 3. 生成本班花名册（不存在时会从示例复制）
npm run setup

# 4. 建表并写入花名册
npm run db:push
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

打开 <http://localhost:3000/letters/>，管理后台在 <http://localhost:3000/letters/admin>。

> 默认构建在 `/letters/` 子路径下。部署到根路径时用 `BASE=/ npm run build`。

### 花名册

真实花名册放在 `contracts/roster.ts`，该文件已被 `.gitignore` 忽略，**不要提交真实姓名和学号**。新环境请复制 `contracts/roster.example.ts` 后替换：

```ts
export const roster = [
  ["张三", "2026010101"],
  ["李四", "2026010102"],
] as const;
```

`npm run setup`、`npm run dev` 和 `npm run build` 会在文件缺失时自动复制示例。

## 环境变量

| 变量 | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | — | MySQL 连接串，如 `mysql://user:pass@127.0.0.1:3306/letters` |
| `ADMIN_KEY` | 生产环境 | — | 管理后台口令；生产环境未设置时服务拒绝启动 |
| `PORT` | 否 | `3000` | 服务端监听端口 |
| `LOG_DIR` | 否 | `./logs` | JSONL 日志目录（自动创建，已 gitignore） |
| `BASE` | 否 | `/letters/` | 构建期静态资源与路由前缀 |

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Vite 开发服务器（前后端同一进程） |
| `npm run build` | 构建前端与打包服务端到 `dist/` |
| `npm start` | 以生产模式运行 `dist/boot.js` |
| `npm run check` | TypeScript 全量类型检查 |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Vitest |
| `npm run db:push` | 将 schema 同步到数据库（开发环境） |
| `npm run db:generate` / `npm run db:migrate` | 生成 / 执行迁移 |
| `npm run db:seed` | 按花名册写入学生表 |

## 部署

### 直接运行

```bash
npm ci
npm run build
ADMIN_KEY=... DATABASE_URL=... npm start
```

### PM2

仓库内附 `ecosystem.config.cjs`，默认监听 3022 端口：

```bash
npm run build
pm2 start ecosystem.config.cjs
```

### Nginx 子路径

构建时保留前缀，反向代理时用带尾斜杠的 `proxy_pass` 去掉前缀：

```nginx
location /letters/ {
    proxy_pass http://127.0.0.1:3022/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### Docker

镜像不包含任何密钥，运行时注入环境变量：

```bash
docker build -t letters .
docker run --env-file .env -p 3000:3000 letters
```

## 项目结构

```
api/          Hono 服务端、tRPC 路由、查询与日志
contracts/    商品目录、花名册、错误与类型定义
db/           Drizzle schema、迁移与种子脚本
src/          React 前端（页面、组件、hooks、样式）
scripts/      构建辅助脚本
public/       商品图片等静态资源
```

## 数据与隐私

本项目最初为真实班级使用。公开或分享代码前请注意：

- 真实花名册只放在 `contracts/roster.ts`，该文件不会进入版本库
- 管理口令只通过 `ADMIN_KEY` 环境变量提供，源码中没有默认口令
- 订单数据存放在你自己的数据库中，不随代码分发
- 若曾把真实名单提交进 Git 历史，发布前请重建历史或使用 `git filter-repo` 清理

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
