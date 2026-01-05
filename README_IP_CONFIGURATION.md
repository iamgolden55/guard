# IP Configuration for Mobile Development

## Quick Setup (When Your IP Changes)

When your WiFi network changes and you need to update the mobile app configuration:

### One-Command Solution

```bash
cd mobile
./update-ip.sh
```

That's it! The script will:
1. ✅ Auto-detect your current IP address
2. ✅ Update the mobile `.env` file
3. ✅ Show you the next steps

### Manual Steps (After Running the Script)

1. **Restart Backend** (if not already running):
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```

2. **Reload Mobile App**:
   - Press `r` in the Expo terminal, or
   - Shake your device and tap "Reload"

## How It Works

### Backend Configuration
- The backend is configured to accept **all IP addresses** in development mode
- `DJANGO_ALLOWED_HOSTS=*` in `backend/.env`
- No need to manually add IPs anymore!

### Mobile Configuration
- Only the mobile `.env` file needs the IP address
- The script auto-detects and updates it
- File: `mobile/.env` → `API_BASE_URL=http://YOUR_IP:8000`

## Important Notes

⚠️ **Production**: The `DJANGO_ALLOWED_HOSTS=*` setting is ONLY for development. In production, you must specify exact hostnames!

✅ **Security**: This setup is safe for local development since:
- Backend only listens on your local network
- Mobile app is only for internal testing
- CORS is properly configured

## Troubleshooting

### Script can't detect IP
```bash
# Manually check your IP
ipconfig getifaddr en0  # macOS
hostname -I             # Linux

# Then manually update mobile/.env
API_BASE_URL=http://YOUR_IP:8000
```

### Backend still shows "DisallowedHost"
Make sure you restarted the backend server after updating `.env` files!

### Mobile app can't connect
1. Check both devices are on the same WiFi
2. Verify backend is running: `curl http://YOUR_IP:8000/api/v1/shifts/`
3. Check firewall isn't blocking port 8000
