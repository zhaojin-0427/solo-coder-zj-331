function success(data, message = 'success') {
  return {
    code: 0,
    message,
    data
  };
}

function fail(code, message, data = null) {
  return {
    code,
    message,
    data
  };
}

function errorHandler(err, req, res, next) {
  console.error('服务器错误:', err);
  res.status(500).json(fail(500, '服务器内部错误', err.message));
}

module.exports = {
  success,
  fail,
  errorHandler
};
