# Google Maps Setup Guide

This guide explains how to set up Google Maps integration for venue location features in the Security Staff Portal.

## Features Enabled

- **Interactive venue location picker** during venue creation/editing
- **Visual map display** of venue locations in the venue list
- **Address autocomplete** with Google Places API
- **GPS-based check-in verification** for staff shifts
- **Directions links** to venue locations

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps JavaScript API** (for map display)
   - **Geocoding API** (for address to coordinates conversion)
   - **Places API** (for address autocomplete)
4. Go to **APIs & Services > Credentials**
5. Click **+ CREATE CREDENTIALS > API key**
6. Copy your API key

### 2. Configure API Key Restrictions (Recommended)

For security, restrict your API key:

1. Click on your API key in the Credentials page
2. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add your domain(s):
     - `http://localhost:3000/*` (for development)
     - `https://yourdomain.com/*` (for production)
3. Under **API restrictions**:
   - Select **Restrict key**
   - Choose: Maps JavaScript API, Geocoding API, Places API

### 3. Add API Key to Your Project

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### 4. Verify Setup

1. Go to **Admin > Venue Management**
2. Click **Add Venue**
3. You should see an interactive map in the "Venue Location" section
4. Search for an address to test the autocomplete functionality

## Security Notes

- **Never commit your API key** to version control
- The `.env` file is already in `.gitignore`
- Use environment variables in production
- Set up proper API key restrictions in Google Cloud Console
- Monitor your API usage to avoid unexpected charges

## Troubleshooting

### Map not loading?
- Check browser console for API key errors
- Verify your API key has the correct permissions
- Make sure the required APIs are enabled

### Autocomplete not working?
- Ensure Places API is enabled
- Check if your API key has Places API access

### "For development purposes only" watermark?
- This appears when using the API key without billing enabled
- Add a billing account to your Google Cloud project

## Cost Considerations

Google Maps APIs have usage limits:
- **Maps JavaScript API**: $7 per 1,000 loads
- **Geocoding API**: $5 per 1,000 requests  
- **Places API**: $17 per 1,000 requests

Each API includes monthly free tier:
- First $200 of usage is free each month
- Monitor usage in Google Cloud Console

## Support

If you need help setting up Google Maps:
1. Check the [Google Maps Platform documentation](https://developers.google.com/maps/documentation)
2. Review your API quotas and billing in Google Cloud Console
3. Ensure all required APIs are enabled for your project