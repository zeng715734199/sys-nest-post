import { Injectable } from '@nestjs/common';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { config } from '../config';
@Injectable()
export class RagService {
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
  // MemoryVectorStore：内存向量库（无需部署 Chroma）
  // 适合学习演示，生产环境换成 Chroma
  private vectorStore: MemoryVectorStore | null = null;
  // 记录已加载的文档数量
  private docCount = 0;

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
    this.vectorStore = await MemoryVectorStore.fromDocuments(
      allDocs,
      this.embeddings,
    );
    this.docCount = documents.length;

    return {
      success: true,
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `成功加载 ${documents.length} 篇文档，共切成 ${allDocs.length} 个块`,
    };
  }
  // ── 纯向量检索，不通过大模型 ─────────────────────────────────────────
  async search(query: string, topK = 3) {
    if (!this.vectorStore) {
      return { error: '请先调用 /rag/load 加载文档' };
    }
    /**
     * similaritySearchWithScore
     * 1. 把 query（用户提问内容） 向量化（调用embedding.embedQuery）
     * 2. 和向量库里面的所有文档进行 向量计算 余弦相似度
     * 3. 按照相似度排序，返回前 topK 个文档
     */
    const results = await this.vectorStore.similaritySearchWithScore(
      query,
      topK,
    );
    return {
      query,
      results: results.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source as string,
        score: parseFloat(score.toFixed(4)),
      })),
    };
  }
  // ── 查询知识库状态 ────────────────────────────────────
  getStatus() {
    return {
      loaded: this.vectorStore !== null,
      docCount: this.docCount,
      message: this.vectorStore
        ? `知识库已加载 ${this.docCount} 篇文档`
        : '知识库为空，请先加载文档',
    };
  }
}
