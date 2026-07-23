import { ChatOllama, ChatOllamaInput } from '@langchain/ollama';
import { config } from './config';

export class BaseLLM {
  llm: ChatOllama;
  constructor(extra: ChatOllamaInput = {}) {
    this.llm = new ChatOllama({
      model: config.ollama.chatModel,
      baseUrl: config.ollama.baseUrl,
      temperature: 0.3,
      think: false,
      numPredict: 1024,
      ...extra,
    });
  }
}
