export const storage = {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(localStorage.getItem(key));
  },

  setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },

  deleteItem(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};
