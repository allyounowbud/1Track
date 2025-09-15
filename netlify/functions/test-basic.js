exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': '*' 
    },
    body: JSON.stringify({ 
      success: true, 
      message: 'Basic test function works!',
      timestamp: new Date().toISOString()
    })
  };
};
