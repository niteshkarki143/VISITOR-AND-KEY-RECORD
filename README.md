# Visitor Management System

A web-based visitor management system with dual camera integration, real-time data management, and PDF export capabilities.

## Features

- Real-time visitor data management
- Dual camera photo capture system
- Search and filtering of visitor records
- Date-based filtering
- PDF export functionality
- Admin authentication
- Toast notifications for user feedback
- Responsive design

## Project Structure

```
visitor-management-system/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── camera.js
│   │   ├── new-entry.js
│   │   └── visitor-data.js
│   ├── index.html
│   ├── new_entry.html
│   └── visitor_data.html
├── data/
│   ├── photos/
│   └── visitors.json
├── server.js
└── package.json
```

## Prerequisites

- Node.js (v14 or higher)
- Modern web browser with camera access support

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd visitor-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Access the application at `http://localhost:3000`

## Usage

1. **New Visitor Entry**
   - Navigate to "New Visitor" page
   - Fill in visitor details
   - Capture front and back photos
   - Submit the form

2. **View Visitor Data**
   - Navigate to "Visitor Data" page
   - Search and filter visitor records
   - View captured photos
   - Export data to PDF

## Deployment

### Local Hosting

1. Start the server locally:
```bash
npm start
```
Access the application at `http://localhost:3000`

### Cloudflare Tunnel Hosting

1. Install Cloudflare Tunnel (cloudflared):
```bash
winget install --id Cloudflare.cloudflared
```

2. Run the Cloudflare Tunnel script:
```bash
cloudflare_tunnel.bat
```

The script will:
- Start the local Node.js server
- Create a secure tunnel using Cloudflare
- Provide a public URL for accessing your application

**Note:** Ensure you're logged into your Cloudflare account before running the tunnel.

## Technical Details

- Backend: Express.js with file-based storage
- Frontend: Vanilla JavaScript with modern ES6+ features
- Photo Storage: Base64 encoded JPG files
- Data Storage: JSON file system
- Logging: Winston logger implementation

## Security Features

- Helmet middleware for HTTP security
- CORS protection
- Input validation and sanitization
- Secure file handling

## Error Handling

- Comprehensive error logging
- User-friendly error messages
- Toast notifications for feedback
- Graceful fallbacks for camera access

## License

MIT License