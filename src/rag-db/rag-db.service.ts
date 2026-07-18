import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
// 内存存储
// import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { PGVectorStore, DistanceStrategy } from '@langchain/pgvector';
import { Pool } from 'pg';
import { config } from '../config';
import { StringOutputParser } from '@langchain/core/output_parsers';
@Injectable()
export class RagDbService implements OnModuleInit, OnModuleDestroy {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.1, // RAG 场景用低温度，让回答更准确
  });
  // OllamaEmbeddings：把文本转成向量（用于相似度检索）
  private embeddings = new OllamaEmbeddings({
    model: config.ollama.embedModel,
    baseUrl: config.ollama.baseUrl,
  });
  // postgresql pgvector 连接池
  private pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // 最大连接数
    idleTimeoutMillis: 30000, // 连接空闲超时时间，单位毫秒
    connectionTimeoutMillis: 2000, // 连接超时时间，单位毫秒
  });
  // pgvectorStore的配置
  private pgVectorConfig = {
    pool: this.pgPool,
    // ── collectionName ────────────────────────────────────
    // 当前这个 Service 实例负责的"逻辑分区"名称
    //
    // 本质：一个字符串标识符，存在 langchain_pg_collection 表的 name 字段
    // 作用：查询时自动加 WHERE collection_id = (SELECT uuid WHERE name = 'rag-knowledge-base')
    //       只返回属于这个 collection 的数据，不会查到其他 collection 的内容
    //
    // 什么时候改：
    //   不同业务模块用不同 collectionName，实现数据隔离
    //   例如：
    //     HR 知识库  → collectionName: 'hr-policy'
    //     产品文档   → collectionName: 'product-docs'
    //     技术手册   → collectionName: 'tech-manual'
    //
    collectionName: 'rag-knowledge-base',

    // ── collectionTableName ───────────────────────────────
    // 存储"有哪些 collection"的那张表的名字
    //
    // 本质：这是 LangChain 自动创建的一张索引表的物理表名
    // 作用：记录每个 collection 的 UUID 和名称，供向量表通过外键关联
    //
    // 一般不需要改，除非：
    //   1. 你的数据库有命名规范要求（如表名必须带前缀）
    //   2. 同一个数据库里想跑多套完全隔离的 LangChain 系统
    //
    // 如果你改了这个名字，LangChain 会创建一张新的索引表
    //
    collectionTableName: 'langchain_pg_collection',

    // ── tableName ─────────────────────────────────────────
    // 真正存向量和文档内容的那张表的物理名
    //
    // 本质：所有 collection 的向量数据都存在这一张表里
    //       通过 collection_id 字段区分属于哪个 collection
    //
    // 和 collectionTableName 的关系：
    //   collectionTableName（索引表）存的是 collection 的元数据
    //   tableName（数据表）存的是真实的向量和文档内容
    //   两张表通过 collection_id 外键关联
    //
    // 一般不需要改，除非有特殊表名要求
    //
    tableName: 'langchain_pg_embedding',

    // ── columns ───────────────────────────────────────────
    // 告诉 LangChain 每个字段在数据库里叫什么名字
    //
    // 如果你用的是 LangChain 自动建的表 → 不需要改，保持默认
    // 如果你手动建了表且字段名不同 → 按实际字段名填
    //
    columns: {
      idColumnName: 'id', // 主键字段（UUID）
      vectorColumnName: 'embedding', // 向量字段（vector(1024)）
      contentColumnName: 'document', // 文档内容字段（TEXT）
      metadataColumnName: 'cmetadata', // 元数据字段（JSONB）
    },

    // ── distanceStrategy ──────────────────────────────────
    // 向量相似度的计算方式
    //
    // 'cosine'（余弦距离）← 绝大多数场景用这个
    //   特点：只看方向，不看长度；对文本语义检索最准确
    //   SQL 运算符：<=>
    //
    // 'innerProduct'（内积）
    //   特点：同时考虑方向和长度；适合推荐系统
    //   SQL 运算符：<#>
    //   注意：要求向量必须归一化（L2 范数 = 1）才能用内积代替余弦
    //
    // 'euclidean'（欧式距离）
    //   特点：计算两点的空间距离；适合图像特征向量
    //   SQL 运算符：<->
    //
    distanceStrategy: 'cosine' as DistanceStrategy,
  };

  private vectorStore: PGVectorStore | null = null;

  // 记录已加载的文档数量
  private docCount = 0;

  // 在组件加载时只初始化一次
  async onModuleInit() {
    try {
      this.vectorStore = await PGVectorStore.initialize(
        this.embeddings,
        this.pgVectorConfig,
      );

      console.log('PGVector 初始化成功');
    } catch (err) {
      console.error('PGVector 初始化失败', err);
      throw err;
    }
  }

  // ── 加载文档到向量库 ───────────────────────────────────
  async loadDocuments(
    documents: { id: string; content: string; source?: string }[],
  ) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500, // 每个 chunk 的最大字符数
      chunkOverlap: 50, // 相邻 chunk 的重叠字符数
    });
    const allDocs: Document[] = [];
    for (const doc of documents) {
      const chunks = await splitter.createDocuments(
        [doc.content],
        [{ source: doc.source || doc.id, docId: doc.id }],
      );
      allDocs.push(...chunks);
    }
    // pgvectorStore 存入 pgvector 数据库
    // pgvectorStore.fromDocuments内部会调用this.embedding.embedDocuments 把文本转成向量
    // 1. 首次调用 自动创建表结构 (langchan_pg_collection 储存文档，langchain_pg_embedding 储存向量)
    // 2. 后续调用 自动把向量数据插入 (langchain_pg_embedding表，文档数据插入 langchain_pg_collection 表)
    await this.vectorStore!.addDocuments(allDocs);
    this.docCount += documents.length;

    return {
      success: true,
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `成功加载 ${documents.length} 篇文档，共切成 ${allDocs.length} 个块`,
    };
  }
  // ── 纯向量检索，不通过大模型 ─────────────────────────────────────────
  async search(query: string, topK = 3) {
    const results = await this.vectorStore!.similaritySearchWithScore(
      query,
      topK,
    );
    return {
      query,
      results: results.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source as string,
        similarity: (1 - parseFloat(score.toFixed(4))).toFixed(4), // 余弦相似度 = 1 - 余弦距离
        rawDistance: parseFloat(score.toFixed(4)), // 余弦距离
      })),
    };
  }
  // ── 查询知识库状态 ────────────────────────────────────
  async getStatus() {
    try {
      const results = await this.pgPool.query(
        `SELECT COUNT(*) FROM ${this.pgVectorConfig.tableName} WHERE collection_id = (SELECT uuid from ${this.pgVectorConfig.collectionTableName} WHERE name = $1)`,
        [this.pgVectorConfig.collectionName],
      );
      const vectorCount = parseInt(results.rows[0]?.count, 10);
      return {
        mode: 'pgvector',
        loaded: vectorCount > 0,
        vectorCount,
        collection: this.pgVectorConfig.collectionName,
        message:
          vectorCount > 0
            ? `postgresql向量数据已加载有 ${vectorCount} 个向量块`
            : '状态加载成功，但知识库为空',
      };
    } catch (e) {
      console.error('失败：', e);
      return {
        mode: 'pgvector',
        loaded: false,
        vectorCount: 0,
        message: '状态获取失败',
      };
    }
  }
  // ── 完整 RAG 问答 ─────────────────────────────────────
  async query(question: string, topK = 3) {
    // step 1: 检索向量库相关内容
    const retrieved = await this.vectorStore!.similaritySearchWithScore(
      question,
      topK,
    );
    // 过滤余弦距离 <= 0.5 的结果，越低越接近
    const filtered = retrieved.filter(([, score]) => score <= 0.5);
    if (filtered.length === 0) {
      return {
        question,
        answer: '知识库中暂无相关内容',
        sources: [],
      };
    }
    // step 2: 把检索结果拼接成 context 字符串，作为大模型输入
    // [1]第一块内容...\n\n[2]第二块内容...
    // 编号方便模型在回答时引用，根据[1]...,根据[2]...
    const context = filtered
      .map(([doc], idx) => {
        return `[${idx + 1}] ${doc.pageContent}`;
      })
      .join('\n\n');
    // Step 3：构建 RAG Prompt
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是知识库问答助手，严格基于以下参考资料回答问题。

规则：
1. 只根据参考资料内容回答，不要使用资料外的知识
2. 如果资料中没有相关信息，回答"知识库中暂无相关内容"
3. 回答简洁准确，使用中文
4. 可以说明答案来自第几条参考资料

参考资料：
{context}`,
      ],
      ['human', '{question}'],
    ]);
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ question, context });

    return {
      question,
      answer,
      sources: retrieved.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source as string,
        similarity: (1 - parseFloat(score.toFixed(4))).toFixed(4), // 余弦相似度 = 1 - 余弦距离
        rawDistance: parseFloat(score.toFixed(4)), // 余弦距离
      })),
    };
  }
  // ── 清空知识库 ────────────────────────────────────────
  async clearKnowledge() {
    await this.pgPool.query(
      `DELETE FROM ${this.pgVectorConfig.tableName} WHERE collection_id = (SELECT uuid FROM ${this.pgVectorConfig.collectionTableName} WHERE name = $1)`,
      [this.pgVectorConfig.collectionName],
    );
    await this.pgPool.query(
      `DELETE FROM ${this.pgVectorConfig.collectionTableName} WHERE name = $1`,
      [this.pgVectorConfig.collectionName],
    );
    this.docCount = 0;
    return {
      success: true,
      message: '知识库已清空',
    };
  }

  async onModuleDestroy() {
    await this.pgPool.end();
    console.log('PostgreSQL 连接已关闭');
  }
}
