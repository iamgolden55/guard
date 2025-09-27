// K6 Performance Test Script for Legal Compliance Reporting System
// SSMS-COMPLIANCE-2025 - Load testing and performance validation

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const requestCount = new Counter('total_requests');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 20 },   // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 50 },   // Stay at 50 users for 5 minutes
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users for 5 minutes
    { duration: '2m', target: 200 },  // Peak load test
    { duration: '3m', target: 200 },  // Hold peak load
    { duration: '2m', target: 0 },    // Ramp down
  ],

  thresholds: {
    // Performance requirements based on analysis
    'http_req_duration': ['p(95)<200'],      // 95% of requests under 200ms
    'http_req_duration{name:dashboard}': ['p(95)<2000'], // Dashboard under 2s
    'http_req_failed': ['rate<0.01'],        // Error rate under 1%
    'errors': ['rate<0.01'],
    'response_time': ['p(95)<200'],
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8000';

// Test data and authentication
let authToken = '';
const testUsers = [
  { username: 'test_staff', password: 'test123', role: 'staff' },
  { username: 'test_manager', password: 'test123', role: 'manager' },
  { username: 'test_admin', password: 'test123', role: 'admin' },
];

export function setup() {
  // Authenticate test users
  const tokens = {};

  testUsers.forEach(user => {
    const loginResponse = http.post(`${BASE_URL}/api/v1/auth/login/`, {
      username: user.username,
      password: user.password,
    });

    if (loginResponse.status === 200) {
      const body = JSON.parse(loginResponse.body);
      tokens[user.role] = body.access;
    }
  });

  console.log('Setup completed - Authentication tokens obtained');
  return { tokens };
}

export default function (data) {
  const { tokens } = data;

  // Randomly select user role for this iteration
  const roles = Object.keys(tokens);
  const userRole = roles[Math.floor(Math.random() * roles.length)];
  const token = tokens[userRole];

  if (!token) {
    console.error(`No token available for role: ${userRole}`);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Compliance Dashboard Load Test', () => {
    // 1. Dashboard Metrics (Most common endpoint)
    group('Dashboard Metrics', () => {
      const response = http.get(`${BASE_URL}/api/v1/compliance/dashboard/`, {
        headers,
        tags: { name: 'dashboard' },
      });

      const success = check(response, {
        'dashboard status is 200': (r) => r.status === 200,
        'dashboard response time < 2s': (r) => r.timings.duration < 2000,
        'dashboard has data': (r) => JSON.parse(r.body).status === 'success',
      });

      errorRate.add(!success);
      responseTimeTrend.add(response.timings.duration);
      requestCount.add(1);
    });

    // 2. Violation Summary
    group('Violation Summary', () => {
      const response = http.get(`${BASE_URL}/api/v1/compliance/violations/summary/`, {
        headers,
        tags: { name: 'violation_summary' },
      });

      check(response, {
        'violation summary status is 200': (r) => r.status === 200,
        'violation summary response time < 500ms': (r) => r.timings.duration < 500,
      });

      requestCount.add(1);
    });

    // 3. Real-time Compliance Check (Performance critical)
    group('Real-time Compliance Check', () => {
      const checkData = {
        user_id: Math.floor(Math.random() * 100) + 1,
        shift_start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        shift_end: new Date(Date.now() + 32400000).toISOString(),   // 9 hours from now
        venue_id: Math.floor(Math.random() * 10) + 1,
      };

      const response = http.post(`${BASE_URL}/api/v1/compliance/check/`,
        JSON.stringify(checkData),
        {
          headers,
          tags: { name: 'realtime_check' },
        }
      );

      check(response, {
        'compliance check status is 200': (r) => r.status === 200,
        'compliance check response time < 50ms': (r) => r.timings.duration < 50,
        'compliance check has result': (r) => JSON.parse(r.body).data !== undefined,
      });

      requestCount.add(1);
    });

    // 4. Violations List (Paginated)
    group('Violations List', () => {
      const page = Math.floor(Math.random() * 5) + 1; // Random page 1-5
      const response = http.get(`${BASE_URL}/api/v1/compliance/violations/?page=${page}&limit=50`, {
        headers,
        tags: { name: 'violations_list' },
      });

      check(response, {
        'violations list status is 200': (r) => r.status === 200,
        'violations list response time < 500ms': (r) => r.timings.duration < 500,
      });

      requestCount.add(1);
    });

    // 5. Compliance Alerts (Real-time data)
    group('Compliance Alerts', () => {
      const response = http.get(`${BASE_URL}/api/v1/compliance/alerts/`, {
        headers,
        tags: { name: 'alerts' },
      });

      check(response, {
        'alerts status is 200': (r) => r.status === 200,
        'alerts response time < 200ms': (r) => r.timings.duration < 200,
      });

      requestCount.add(1);
    });

    // 6. Trends Data (Heavy computation)
    if (Math.random() < 0.3) { // Only 30% of users request trends
      group('Trends Data', () => {
        const days = [7, 14, 30][Math.floor(Math.random() * 3)];
        const groupBy = ['day', 'week'][Math.floor(Math.random() * 2)];

        const response = http.get(
          `${BASE_URL}/api/v1/compliance/trends/?days=${days}&group_by=${groupBy}`,
          {
            headers,
            tags: { name: 'trends' },
          }
        );

        check(response, {
          'trends status is 200': (r) => r.status === 200,
          'trends response time < 1s': (r) => r.timings.duration < 1000,
        });

        requestCount.add(1);
      });
    }
  });

  // Manager/Admin specific endpoints
  if (userRole === 'manager' || userRole === 'admin') {
    group('Management Operations', () => {
      // Pending violations (managers only)
      const response = http.get(`${BASE_URL}/api/v1/compliance/violations/pending/`, {
        headers,
        tags: { name: 'pending_violations' },
      });

      check(response, {
        'pending violations accessible': (r) => r.status === 200,
        'pending violations fast': (r) => r.timings.duration < 300,
      });

      requestCount.add(1);
    });
  }

  // Simulate user think time
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Teardown function
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total requests made: ${requestCount.count}`);
}

// Custom scenarios for specific testing
export const scenarios = {
  // Normal user load
  normal_load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 0 },
    ],
  },

  // Spike testing
  spike_test: {
    executor: 'ramping-vus',
    startTime: '5m',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },

  // Dashboard specific load
  dashboard_load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '2m',
    exec: 'dashboardOnly',
  },
};

// Dashboard-only test function
export function dashboardOnly(data) {
  const { tokens } = data;
  const token = tokens.staff || tokens.manager;

  if (token) {
    const response = http.get(`${BASE_URL}/api/v1/compliance/dashboard/`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { name: 'dashboard_load' },
    });

    check(response, {
      'dashboard load test success': (r) => r.status === 200,
      'dashboard load test performance': (r) => r.timings.duration < 2000,
    });
  }
}