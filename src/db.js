(function () {
  const DB_NAME = "promptforge-builder";
  const DB_VERSION = 1;
  const STORES = ["prompts", "versions", "testRuns", "settings"];

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("prompts")) {
          const prompts = db.createObjectStore("prompts", { keyPath: "id" });
          prompts.createIndex("updated_at", "updated_at");
          prompts.createIndex("category", "category");
        }
        if (!db.objectStoreNames.contains("versions")) {
          const versions = db.createObjectStore("versions", { keyPath: "id" });
          versions.createIndex("prompt_id", "prompt_id");
        }
        if (!db.objectStoreNames.contains("testRuns")) {
          const testRuns = db.createObjectStore("testRuns", { keyPath: "id" });
          testRuns.createIndex("prompt_id", "prompt_id");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(storeName, mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const result = callback(store);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).finally(() => db.close());
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  window.PromptForgeDb = {
    all(storeName) {
      return withStore(storeName, "readonly", (store) => requestToPromise(store.getAll()));
    },
    get(storeName, key) {
      return withStore(storeName, "readonly", (store) => requestToPromise(store.get(key)));
    },
    put(storeName, value) {
      return withStore(storeName, "readwrite", (store) => {
        store.put(value);
        return value;
      });
    },
    delete(storeName, key) {
      return withStore(storeName, "readwrite", (store) => {
        store.delete(key);
        return key;
      });
    },
    async byIndex(storeName, indexName, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const index = transaction.objectStore(storeName).index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      });
    },
    storeNames: STORES
  };
})();
