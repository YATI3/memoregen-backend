module.exports = {
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ premium: true }) }),
        set: async () => undefined
      })
    })
  })
};
