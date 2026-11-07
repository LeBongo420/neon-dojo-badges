module.exports = {
  readFileSync() {
    throw new Error("Node file access is not available in the browser.");
  },
};
