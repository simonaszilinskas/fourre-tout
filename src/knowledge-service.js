// src/knowledge-service.js
import SecureStorageService from './secure-storage.js';

const KnowledgeService = {
  // Database state
  db: null,
  isInitialized: false,

  // Constants
  BATCH_SIZE: 5,
  MAX_VECTOR_COUNT: 1000,
  STORAGE_KEYS: {
    VECTORS: 'vectors',
    LAST_CLEANUP: 'last_vector_cleanup'
  },

  // Initialize IndexedDB for vector storage
  async initDB() {
    if (this.isInitialized) {
      return this.db;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('knowledgeDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('vectors')) {
            const store = db.createObjectStore('vectors', { 
              keyPath: 'id', 
              autoIncrement: true 
            });
            store.createIndex('timestamp', 'timestamp');
            store.createIndex('lastAccessed', 'lastAccessed');
            store.createIndex('accessCount', 'accessCount');
          }
        };
      });

      this.isInitialized = true;
      return this.db;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Database initialization failed');
    }
  },

  async getDB() {
    if (!this.isInitialized) {
      await this.initDB();
    }
    return this.db;
  },

  // Store knowledge with batching and optimization
  async storeKnowledge(texts, urls, titles) {
    try {
      // Convert single items to arrays
      const textArray = Array.isArray(texts) ? texts : [texts];
      const urlArray = Array.isArray(urls) ? urls : [urls];
      const titleArray = Array.isArray(titles) ? titles : [titles];

      // Validate input lengths match
      if (textArray.length !== urlArray.length || textArray.length !== titleArray.length) {
        throw new Error('Mismatched input arrays');
      }

      // Get API key
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Process in batches
      for (let i = 0; i < textArray.length; i += this.BATCH_SIZE) {
        const batch = textArray.slice(i, i + this.BATCH_SIZE);
        const batchUrls = urlArray.slice(i, i + this.BATCH_SIZE);
        const batchTitles = titleArray.slice(i, i + this.BATCH_SIZE);

        // Get embeddings for batch
        const embeddings = await this.getEmbeddingsBatch(batch, apiKey);
        
        // Store vectors
        await this.storeVectorBatch(batch, embeddings, batchUrls, batchTitles);
      }

      // Cleanup if necessary
      await this.performCleanupIfNeeded();

      return true;
    } catch (error) {
      console.error('Error storing knowledge:', error);
      throw new Error(`Failed to store knowledge: ${error.message}`);
    }
  },

  // Get embeddings for a batch of texts
  async getEmbeddingsBatch(texts, apiKey) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: texts,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate embeddings');
    }

    const data = await response.json();
    return data.data.map(item => item.embedding);
  },

  // Store a batch of vectors
  async storeVectorBatch(texts, embeddings, urls, titles) {
    const db = await this.getDB();
    const tx = db.transaction('vectors', 'readwrite');
    const store = tx.objectStore('vectors');

    const now = Date.now();
    const vectors = texts.map((text, i) => ({
      text: text,
      embedding: embeddings[i],
      url: urls[i],
      title: titles[i],
      timestamp: now,
      lastAccessed: now,
      accessCount: 0
    }));

    // Store each vector
    await Promise.all(vectors.map(vector => 
      new Promise((resolve, reject) => {
        const request = store.add(vector);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ));

    // Complete transaction
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Search knowledge with optimized similarity search
  async searchKnowledge(query) {
    try {
      const apiKey = await SecureStorageService.getApiKey();
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Get query embedding
      const queryEmbedding = (await this.getEmbeddingsBatch([query], apiKey))[0];
      
      // Search vectors
      const results = await this.findSimilarVectors(queryEmbedding);

      // Update access metrics for found vectors
      await this.updateVectorAccessMetrics(results.map(r => r.id));

      return results.map(({ text, url, title, similarity }) => ({
        text,
        url,
        title,
        similarity
      }));
    } catch (error) {
      console.error('Error searching knowledge:', error);
      throw new Error(`Failed to search knowledge: ${error.message}`);
    }
  },

  // Find similar vectors using optimized similarity search
  async findSimilarVectors(queryEmbedding) {
    const db = await this.getDB();
    const tx = db.transaction('vectors', 'readonly');
    const store = tx.objectStore('vectors');

    const vectors = await new Promise((resolve, reject) => {
      const vectors = [];
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          vectors.push({ id: cursor.key, ...cursor.value });
          cursor.continue();
        } else {
          resolve(vectors);
        }
      };
      request.onerror = () => reject(request.error);
    });

    // Calculate similarities using Web Workers for parallel processing
    const similarities = await this.calculateSimilaritiesParallel(vectors, queryEmbedding);

    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  },

  // Calculate similarities in parallel using Web Workers
  async calculateSimilaritiesParallel(vectors, queryEmbedding) {
    const workerCode = `
      self.onmessage = function(e) {
        const { vectors, queryEmbedding, startIdx, endIdx } = e.data;
        
        function cosineSimilarity(vecA, vecB) {
          const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
          const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
          const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
          return dotProduct / (magnitudeA * magnitudeB);
        }
        
        const results = [];
        for (let i = startIdx; i < endIdx; i++) {
          const vector = vectors[i];
          const similarity = cosineSimilarity(queryEmbedding, vector.embedding);
          results.push({
            id: vector.id,
            text: vector.text,
            url: vector.url,
            title: vector.title,
            similarity
          });
        }
        
        self.postMessage(results);
      };
    `;

    // Create blob and worker
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    // Determine number of workers based on CPU cores
    const numWorkers = navigator.hardwareConcurrency || 4;
    const chunkSize = Math.ceil(vectors.length / numWorkers);

    // Create workers and process chunks
    const workers = [];
    const results = [];

    for (let i = 0; i < numWorkers; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, vectors.length);

      const worker = new Worker(workerUrl);
      workers.push(worker);

      results.push(new Promise((resolve) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.postMessage({
          vectors,
          queryEmbedding,
          startIdx,
          endIdx
        });
      }));
    }

    // Wait for all workers to complete
    const similarities = (await Promise.all(results)).flat();

    // Cleanup
    workers.forEach(worker => worker.terminate());
    URL.revokeObjectURL(workerUrl);

    return similarities;
  },

  // Update access metrics for vectors
  async updateVectorAccessMetrics(vectorIds) {
    const db = await this.getDB();
    const tx = db.transaction('vectors', 'readwrite');
    const store = tx.objectStore('vectors');

    const now = Date.now();

    await Promise.all(vectorIds.map(id =>
      new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const vector = request.result;
          if (vector) {
            vector.lastAccessed = now;
            vector.accessCount += 1;
            store.put(vector);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      })
    ));

    // Complete transaction
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Perform cleanup of old vectors
  async performCleanupIfNeeded() {
    const db = await this.getDB();
    const tx = db.transaction('vectors', 'readwrite');
    const store = tx.objectStore('vectors');

    // Get count of vectors
    const count = await new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (count > this.MAX_VECTOR_COUNT) {
      const countToDelete = count - this.MAX_VECTOR_COUNT;
      const index = store.index('lastAccessed');
      let deleted = 0;

      await new Promise((resolve, reject) => {
        const request = index.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && deleted < countToDelete) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
  }
};

export default KnowledgeService;