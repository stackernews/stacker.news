/**
 * Create a queue to run tasks sequentially
 * @returns {Object} - the queue
 * @returns {function} enqueue - Function to add a task to the queue
 * @returns {function} lock - Function to lock the queue
 * @returns {function} wait - Function to wait for the queue to be empty
 */
export default function createTaskQueue () {
  const queue = {
    queue: Promise.resolve(),
    /**
     * Enqueue a task to be run sequentially
     * @param {function} fn - The task function to be enqueued
     * @returns {Promise} - A promise that resolves with the result of the task function
     */
    enqueue (fn) {
      return new Promise((resolve, reject) => {
        queue.queue = queue.queue.then(async () => {
          try {
            resolve(await fn())
          } catch (e) {
            reject(e)
          }
        })
      })
    },
    /**
     * Lock the queue so that it can't move forward until unlocked
     * @param {boolean} [wait=true] - Whether to wait for the lock to be acquired
     * @returns {Promise<function>} - A promise that resolves with the unlock function
     */
    async lock (wait = true) {
      let unlock
      const lock = new Promise((resolve) => { unlock = resolve })
      const locking = new Promise((resolve) => {
        queue.queue = queue.queue.then(() => {
          resolve()
          return lock
        })
      })
      if (wait) await locking
      return unlock
    },
    /**
     * Wait for the queue to be empty
     * @returns {Promise} - A promise that resolves when the queue is empty
     */
    async wait () {
      return queue.queue
    }
  }

  return queue
}
