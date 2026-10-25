# 参与贡献

感谢你愿意改进这个项目。提交代码前请先阅读下面的约定。

## 开发环境

```bash
npm ci
cp .env.example .env
npm run setup
npm run db:push
npm run db:seed
npm run dev
```

## 提交前检查

```bash
npm run check
npm run lint
npm test
npm run build
```

请确保以上命令全部通过。

## 提交规范

提交信息使用 Conventional Commits 前缀，例如：

- `feat: 支持按分类筛选商品`
- `fix: 修正导出金额的四舍五入`
- `docs: 补充 Docker 部署说明`

## 代码约定

- 前端沿用 `src/` 中已有的组件与样式写法，服务端沿用 `api/` 的分层结构
- 数据库结构变更请同时生成迁移文件
- 不为显而易见的代码添加注释；注释只解释不明显的取舍

## 隐私红线

- **不要提交任何真实学生姓名、学号或订单数据**
- 真实花名册只能放在被忽略的 `contracts/roster.ts`
- 不要把 `.env`、管理口令、数据库连接串写进代码或提交历史
- 测试与示例请使用虚构数据

## Pull Request

1. 从 `master` 切出功能分支
2. 保持改动聚焦，说明动机与验证方式
3. 若改变行为，请同步更新 README

提交贡献即表示你同意以本项目的 [MIT 许可证](LICENSE) 发布你的改动。
