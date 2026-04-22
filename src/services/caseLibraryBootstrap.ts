import { embeddingService } from './embeddingService';

const EMBEDDING_MODEL_ID = 'text-embedding-004';
const embeddingApiKey = import.meta.env.VITE_GEMINI_EMBEDDING_KEY as string | undefined;

if (embeddingApiKey && embeddingApiKey.trim().length > 0 && !embeddingService.isInitialized()) {
  try {
    embeddingService.initialize(embeddingApiKey, EMBEDDING_MODEL_ID);
  } catch (error) {
    console.error('Failed to initialize Case Library embeddings:', error);
  }
}
