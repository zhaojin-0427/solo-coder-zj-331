const express = require('express');
const bodyParser = require('body-parser');

const cardRoutes = require('./routes/card');
const ruleRoutes = require('./routes/rule');
const historyRoutes = require('./routes/history');
const statsRoutes = require('./routes/stats');
const appointmentRoutes = require('./routes/appointment');
const homeVisitRoutes = require('./routes/homeVisit');

const { errorHandler } = require('./utils/response');

const app = express();
const PORT = 9452;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: {
      service: 'elder-card-service',
      status: 'running',
      port: PORT
    }
  });
});

app.use('/api/card', cardRoutes);
app.use('/api/rule', ruleRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/appointment', appointmentRoutes);
app.use('/api/home-visit', homeVisitRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`长者卡证办理服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
