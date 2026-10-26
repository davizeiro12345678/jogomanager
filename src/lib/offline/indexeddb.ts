import * as keyval from "idb-keyval";
import type { UseStore } from "idb-keyval";

/** Same database/layout as idb-keyval's default; no schema migration or deletion. */
export function createBoundedStore(
  databaseName: string,
  storeName: string,
  openTimeoutMs = 1000,
  transactionTimeoutMs = 2000,
): UseStore {
  let opening: Promise<IDBDatabase> | undefined;
  let connection: IDBDatabase | undefined;
  const open = () => {
    if (opening) return opening;
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName);
    } catch (error) {
      return Promise.reject(error);
    }
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        opening = undefined;
        reject(new Error("Prazo de abertura do armazenamento excedido."));
      }, openTimeoutMs);
      request.onupgradeneeded = () => {
        if (expired) {
          request.transaction?.abort();
          return;
        }
        if (!request.result.objectStoreNames.contains(storeName))
          request.result.createObjectStore(storeName);
      };
      request.onerror = () => {
        clearTimeout(timer);
        if (!expired) opening = undefined;
        reject(request.error ?? new Error("Não foi possível abrir o armazenamento."));
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        const database = request.result;
        // An open request cannot be cancelled. Its late success must never start an operation.
        if (expired) {
          database.close();
          return;
        }
        connection = database;
        const invalidate = () => {
          if (connection === database) {
            connection = undefined;
            opening = undefined;
          }
        };
        database.onclose = invalidate;
        database.onversionchange = () => {
          database.close();
          invalidate();
        };
        resolve(database);
      };
    });
    return opening;
  };
  return (mode, callback) =>
    open().then(
      (database) =>
        new Promise((resolve, reject) => {
          let transaction: IDBTransaction;
          try {
            transaction = database.transaction(storeName, mode);
          } catch (error) {
            connection = undefined;
            opening = undefined;
            reject(error);
            return;
          }
          let callbackDone = false;
          let committed = false;
          let result: unknown;
          let deadlineError: Error | undefined;
          const finish = () => {
            if (callbackDone && committed) resolve(result as never);
          };
          const abort = () => {
            try {
              transaction.abort();
            } catch {
              /* Already committed/aborted: let the native terminal event decide the result. */
            }
          };
          const timer = setTimeout(() => {
            deadlineError = new Error("Prazo da transação de armazenamento excedido.");
            abort();
          }, transactionTimeoutMs);
          transaction.addEventListener(
            "complete",
            () => {
              clearTimeout(timer);
              committed = true;
              finish();
            },
            { once: true },
          );
          transaction.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(
                deadlineError ??
                  transaction.error ??
                  new Error("Transação de armazenamento abortada."),
              );
            },
            { once: true },
          );
          try {
            Promise.resolve(callback(transaction.objectStore(storeName))).then(
              (value) => {
                result = value;
                callbackDone = true;
                finish();
              },
              (error: unknown) => {
                abort();
                clearTimeout(timer);
                reject(error);
              },
            );
          } catch (error) {
            abort();
            clearTimeout(timer);
            reject(error);
          }
        }),
    );
}

const store = createBoundedStore("keyval-store", "keyval");
export const get = <T>(key: IDBValidKey) => keyval.get<T>(key, store);
export const getMany = <T>(keys: IDBValidKey[]) => keyval.getMany<T>(keys, store);
export const set = (key: IDBValidKey, value: unknown) => keyval.set(key, value, store);
export const setMany = (entries: [IDBValidKey, unknown][]) => keyval.setMany(entries, store);
export const update = <T>(key: IDBValidKey, updater: (value: T | undefined) => T) =>
  keyval.update(key, updater, store);
export const del = (key: IDBValidKey) => keyval.del(key, store);
export const clear = () => keyval.clear(store);
