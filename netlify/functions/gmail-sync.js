// Temporary stub so the "Sync now" button doesn't 404 while
// you wire up message fetching later.
exports.handler = async () => {
  return { statusCode: 200, body: JSON.stringify({ imported: 0 }) };
};
