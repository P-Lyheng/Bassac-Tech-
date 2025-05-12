// Input validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          message: 'Validation error', 
          details: error.details[0].message 
        });
      }
      next();
    };
  };
  
  // Sanitize user input to prevent XSS
  const sanitizeInputs = (req, res, next) => {
    // Function to sanitize a string
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[<>]/g, (match) => {
        return match === '<' ? '&lt;' : '&gt;';
      });
    };
  
    // Recursively sanitize all strings in an object
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
  
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
  
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    };
  
    // Sanitize body, query, and params
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
  
    next();
  };
  
  // Validate request parameters
  const validateParams = (req, res, next) => {
    // Check if id parameters are valid numbers
    for (const key in req.params) {
      if (key.includes('Id') && !isNaN(req.params[key])) {
        req.params[key] = parseInt(req.params[key]);
      }
    }
    next();
  };
  
  module.exports = {
    validateInput,
    sanitizeInputs,
    validateParams
  };