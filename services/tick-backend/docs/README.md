# Backend Documentation

## Primary Documentation

### **WebSocket API Documentation** (Current Source of Truth)
📍 **File**: `WebSocket_API.md`
📖 **Purpose**: Definitive protocol specification for backend WebSocket API
✅ **Status**: Current and accurate - reflects actual production implementation

**This is the authoritative source of truth for all backend communication protocols.**

---

## Legacy Documentation (Archive)

### **API_Documentation.md** - ⚠️ DEPRECATED
- Contains outdated protocol information
- Documents message types no longer implemented
- Should not be used for new development

### **Architecture_Documentation.md** - 📚 REFERENCE
- High-level system architecture overview
- Useful for understanding overall design
- Does not contain current protocol specifications

### **initial api/** - 🗑️ LEGACY
- Contains historical setup guides
- No longer relevant to current implementation
- Kept for reference only

---

## Quick Reference

### WebSocket Endpoints
- **Development**: `ws://localhost:8080`
- **Production**: `ws://localhost:8081`

### Core Message Types

**Client → Server:**
- `get_symbol_data_package` - Request symbol data for single symbol
- `subscribe` - Request symbol data for multiple symbols
- `unsubscribe` - Stop receiving data

**Server → Client:**
- `status` - Connection status
- `ready` - Backend ready for requests
- `symbolDataPackage` - Complete symbol data
- `tick` - Real-time price updates
- `error` - Error messages

### Environment Variables
```bash
# Required for cTrader API integration
CTRADER_CLIENT_ID=
CTRADER_CLIENT_SECRET=
CTRADER_ACCESS_TOKEN=
CTRADER_ACCOUNT_ID=
HOST=live.ctraderapi.com
PORT=

# Backend configuration
WS_PORT=8080
NODE_ENV=development
```

---

## Development Setup

```bash
# From services/tick-backend/
npm install
npm start
```

The backend will automatically:
1. Connect to cTrader API
2. Load available symbols
3. Start WebSocket server on configured port
4. Accept client connections

---

**Always reference `WebSocket_API.md` for the most current and accurate protocol specification.**