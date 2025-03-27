# Spotiguide

Spotiguide is a web application that mixes tracks from your Spotify playlists with AI-generated speech. It creates a personalized radio-like experience by combining music with spoken content.

## Features

- Spotify authentication and integration
- Browse and select from your Spotify playlists
- Mix music tracks with AI-generated speech
- Control playback and mixing options
- Responsive design for desktop and mobile

## Technologies Used

- React with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Zustand for state management
- Spotify Web API SDK for Spotify integration
- React Spotify Web Playback for music playback

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or bun
- Spotify Premium account (required for playback)
- Spotify Developer account (for API access)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/spotiguide.git
   cd spotiguide
   ```

2. Install dependencies:

   ```
   npm install
   ```

   or

   ```
   bun install
   ```

3. Create a `.env` file in the root directory with your Spotify credentials:

   ```
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
   VITE_REDIRECT_URI=http://localhost:5173/callback
   ```

4. Start the development server:

   ```
   npm run dev
   ```

   or

   ```
   bun dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Backend Integration

Spotiguide connects to a backend service that generates speech content based on your selected playlist. The backend should provide an API endpoint that returns speech segments in the following format:

```json
{
  "segments": [
    {
      "id": "segment-1",
      "text": "This is a speech segment about the playlist",
      "audioUrl": "https://your-backend.com/audio/segment-1.mp3",
      "duration": 15
    }
  ]
}
```

Configure the backend URL in the application by updating the `backendUrl` in the store.

## Building for Production

To build the application for production:

```
npm run build
```

The built files will be in the `dist` directory and can be served by any static file server.

## License

[MIT](LICENSE)
