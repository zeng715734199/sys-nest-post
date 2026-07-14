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
}
