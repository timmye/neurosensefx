# Running NeuroSense FX Locally

## Overview
NeuroSense FX is a real-time forex trading visualization system with a Svelte frontend and Node.js backend that connects to cTrader's Open API.

## Prerequisites
- Node.js (v16 or higher)
- npm
- cTrader account with Open API access
- Access token from cTrader (see Authentication section)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd neurosensefx-2
```

### 2. Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd ctrader_tick_backend
npm install
cd ..
```

### 3. Configure Environment
Create a `.env` file in the `ctrader_tick_backend` directory:
```bash
# ctrader_tick_backend/.env
CTRADER_CLIENT_ID=your_client_id_here
CTRADER_SECRET=your_secret_here
CTRADER_ACCESS_TOKEN=your_access_token_here
```

**Getting cTrader Credentials:**
1. Log into your cTrader account
2. Go to Settings → API Access
3. Create a new application
4. Copy the Client ID, Secret, and Access Token
5. Paste these values into your `.env` file

### 4. Start the Application
Use the provided startup script:
```bash
./startup_local_dev.sh
```

This script will:
- Start the backend server on port 8080
- Start the frontend dev server on port 5173
- Open your browser to http://localhost:5173

### 5. Verify Everything is Working
- Frontend: http://localhost:5173 should display the trading dashboard
- Backend: http://localhost:8080/health should return "Upgrade Required" (WebSocket endpoint)
- WebSocket: ws://localhost:8080 should accept connections

## Manual Startup (Alternative)

If you prefer to start services manually:

**Terminal 1 - Backend:**
```bash
cd ctrader_tick_backend
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Troubleshooting

### Common Issues

#### 1. "CH_ACCESS_TOKEN_INVALID" Error
**Cause:** Invalid or expired cTrader access token
**Solution:**
- Verify your access token in the `.env` file
- Generate a new token from cTrader if needed
- Ensure the token has proper permissions for market data access

#### 2. "TypeError: this.connection.close is not a function"
**Cause:** WebSocket connection state management issue
**Solution:** This has been fixed in the latest code. Pull the latest changes if you encounter this.

#### 3. Port Already in Use
**Backend port 8080 in use:**
```bash
lsof -ti:8080 | xargs kill -9
```

**Frontend port 5173 in use:**
```bash
lsof -ti:5173 | xargs kill -9
```

#### 4. CORS Issues
**Cause:** Frontend can't connect to backend
**Solution:** Ensure both servers are running and check browser console for specific error messages.

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| CTRADER_CLIENT_ID | Your cTrader application client ID | Yes |
| CTRADER_SECRET | Your cTrader application secret | Yes |
| CTRADER_ACCESS_TOKEN | Your cTrader access token | Yes |
| PORT | Backend server port (default: 8080) | No |
| VITE_BACKEND_URL | Frontend backend URL (default: ws://localhost:8080) | No |

### Development Commands

```bash
# Frontend only
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend only
cd ctrader_tick_backend
npm start           # Start backend server
npm run debug       # Start with debug logging

# Full system
./startup_local_dev.sh     # Start everything
./cleanup_dev_env.sh       # Clean up processes
```

### Checking System Status

```bash
# Check if services are running
curl http://localhost:8080/health
curl http://localhost:5173

# Check processes
ps aux | grep -E "(node|python)"

# View logs
tail -f ctrader_tick_backend/debug.log
```

### Browser Testing
1. Open http://localhost:5173
2. Open browser DevTools (F12)
3. Check Console tab for any JavaScript errors
4. Check Network tab for WebSocket connections to ws://localhost:8080

## Architecture Overview

```
┌─────────────────┐    WebSocket    ┌──────────────────┐
│   Svelte        │ ◄──────────────► │   Node.js        │
│   Frontend      │   (port 5173)   │   Backend        │
│   (localhost:   │                 │   (localhost:    │
│    5173)        │                 │    8080)         │
└─────────────────┘                 └──────────────────┘
                                          │
                                          │ WebSocket
                                          │ (cTrader API)
                                          ▼
                                   ┌──────────────────┐
                                   │   cTrader        │
                                   │   Open API       │
                                   │   (Live Market   │
                                   │    Data)         │
                                   └──────────────────┘
```

## Support
For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `ctrader_tick_backend/debug.log`
3. Check browser console for frontend errors
4. Ensure all environment variables are correctly set