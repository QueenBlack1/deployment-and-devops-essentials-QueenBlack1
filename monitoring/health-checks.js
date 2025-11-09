// Health check monitoring script
const axios = require('axios');

class HealthMonitor {
  constructor(config) {
    this.endpoints = config.endpoints;
    this.interval = config.interval || 300000; // 5 minutes
    this.webhookUrl = config.webhookUrl;
  }

  async checkEndpoint(endpoint) {
    try {
      const startTime = Date.now();
      const response = await axios.get(endpoint.url, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      const responseTime = Date.now() - startTime;

      return {
        name: endpoint.name,
        status: 'healthy',
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: endpoint.name,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkAll() {
    const results = await Promise.all(
      this.endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    const unhealthy = results.filter(result => result.status === 'unhealthy');
    
    if (unhealthy.length > 0 && this.webhookUrl) {
      await this.sendAlert(unhealthy);
    }

    return results;
  }

  async sendAlert(unhealthyEndpoints) {
    const message = {
      text: `🚨 Health Check Alert - ${unhealthyEndpoints.length} service(s) down`,
      attachments: unhealthyEndpoints.map(endpoint => ({
        color: 'danger',
        fields: [
          {
            title: 'Service',
            value: endpoint.name,
            short: true
          },
          {
            title: 'Error',
            value: endpoint.error,
            short: false
          },
          {
            title: 'Time',
            value: endpoint.timestamp,
            short: true
          }
        ]
      }))
    };

    try {
      await axios.post(this.webhookUrl, message);
    } catch (error) {
      console.error('Failed to send alert:', error.message);
    }
  }

  start() {
    console.log('Starting health monitoring...');
    this.checkAll(); // Initial check
    
    setInterval(() => {
      this.checkAll();
    }, this.interval);
  }
}

// Configuration
const config = {
  endpoints: [
    {
      name: 'Backend API',
      url: process.env.BACKEND_URL + '/health'
    },
    {
      name: 'Frontend App',
      url: process.env.FRONTEND_URL
    },
    {
      name: 'Database',
      url: process.env.BACKEND_URL + '/api/bugs' // Simple API call to test DB
    }
  ],
  interval: 300000, // 5 minutes
  webhookUrl: process.env.SLACK_WEBHOOK_URL
};

module.exports = HealthMonitor;