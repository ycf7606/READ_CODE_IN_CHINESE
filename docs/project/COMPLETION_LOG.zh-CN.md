# 完成记录

[English](COMPLETION_LOG.md) · [简体中文](COMPLETION_LOG.zh-CN.md) · [项目看板](WORKBOARD.zh-CN.md)

原来超过 1100 行的任务日志已经无损拆成多个时间归档。浏览里程碑时优先使用[阶段索引](STAGE_INDEX.zh-CN.md)，只有需要实现级历史细节时才进入下方英文归档。

## 历史归档

| 阶段 | 主要内容 | 归档 |
| --- | --- | --- |
| 0–7 | 项目基础、解释闭环、术语、知识和测试 | [查看](completion/STAGES_00_07.md) |
| 8–10 | 运行体验、模型可靠性、设置和 Token 缓存 | [查看](completion/STAGES_08_10.md) |
| 11–15 | Token/文件预处理和面向用户水平的词典 | [查看](completion/STAGES_11_15.md) |
| 16–19 | 模型筛选、分批处理、缓存完整性和作用域树 | [查看](completion/STAGES_16_19.md) |
| 20–28 | 选区体验、LSP 提取和稳定基线回退 | [查看](completion/STAGES_20_28.md) |
| 29–33 | 预处理回退、端点故障转移、运行安全和隐私 | [查看](completion/STAGES_29_33.md) |

## 最新文档任务

### S34-01 将文档重组为双语分类导航

- 阶段：34
- 结果：把过长入口页改成精简导航；拆分使用指南、架构、阶段和完成历史；增加英文默认页与简体中文镜像。
- 总结：[阶段 34](summaries/2026-07-17-stage-34.zh-CN.md)
- 验证结果：记录在阶段 34 总结中。

## 查询方式

- 在 `docs/project/completion/` 中搜索 `S18-02` 之类的任务编号。
- 通过[阶段索引](STAGE_INDEX.zh-CN.md)浏览里程碑结果。
- 通过 [CHANGELOG.md](../../CHANGELOG.md)浏览用户可见变化。
- 历史归档会保留旧路径和原始文字，便于追溯。
