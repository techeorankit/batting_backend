const cron = require('node-cron');

cron.schedule('0 0 */7 * *', async () => {
  return;
});