# 导入知识文档

[English](IMPORTING_KNOWLEDGE.md) · [简体中文](IMPORTING_KNOWLEDGE.zh-CN.md) · [文档中心](../README.zh-CN.md)

插件可以从用户导入到当前工作区的本地文档中检索相关内容。

## 支持格式

- `.md`
- `.txt`
- `.json`

## JSON 格式

可以导入一个 JSON 对象或对象数组。每项使用以下结构：

```json
{
  "title": "文档标题",
  "content": "用于检索的完整正文",
  "tags": ["可选", "关键词"]
}
```

## 常见用途

- 框架 API 笔记
- 标准库说明
- 本地整理的官方语法参考
- 项目专用架构文档

## 官方文档同步

执行以下命令可以向同一个知识库加入内置参考文档：

- **Read Code In Chinese: Sync Official Docs For Active Language**

命令会下载当前语言的预设文档、切分内容，并写入工作区知识库。

## 检索行为

- 使用关键词匹配。
- 最相关的内容会附加到解释请求。
- 本地模型和远程模型都可以使用导入片段。
- 标题和标签匹配的权重高于正文匹配。

## 存储位置

导入知识保存在工作区缓存中：

```text
.read-code-in-chinese/knowledge/library.json
```
